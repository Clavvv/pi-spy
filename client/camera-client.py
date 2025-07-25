import asyncio
import json
import websockets
from websockets.protocol import State
import os
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, VideoStreamTrack
from av import VideoFrame
from aiortc.contrib.media import MediaPlayer
from aiortc.sdp import candidate_from_sdp
from typing import TypedDict, Literal, NotRequired, Union
from typing_extensions import NotRequired
from picamera2 import Picamera2

# -- Custom Video Track --
class PicameraStreamTrack(VideoStreamTrack):
    def __init__(self):
        super().__init__()
        self.picam2 = Picamera2()
        video_config = self.picam2.create_video_configuration({"format": "YUV420"})
        self.picam2.configure(video_config)
        self.picam2.start()

    async def recv(self):
        frame_array = self.picam2.capture_array("main")
        frame = VideoFrame.from_ndarray(frame_array, format="yuv420p")
        pts, time_base = await self.next_timestamp()
        frame.pts = pts
        frame.time_base = time_base
        return frame
    
    def stop_camera(self):
        self.picam2.stop()

# -- Message Typing Definitions --
class BaseMessage(TypedDict):
    type: str
    sender: str
    target: NotRequired[str]
    timestamp: NotRequired[int]

class OfferMessage(BaseMessage):
    type: Literal['offer']
    sdp: dict

class AnswerMessage(BaseMessage):
    type: Literal['answer']
    sdp: dict

class CandidateMessage(BaseMessage):
    type: Literal['candidate']
    candidate: dict

class CommandMessage(BaseMessage):
    type: Literal['command']
    command: str
    payload: NotRequired[dict]

SignallingMessage = Union[
    OfferMessage,
    AnswerMessage,
    CandidateMessage,
    CommandMessage
]

# -- Config Helpers --
CONFIG_PATH = './device-config.json'
def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as config:
            data = json.load(config)
            return data.get('deviceID')
    return None

def save_device_id(device_id:str):
    with open(CONFIG_PATH, 'w') as config:
        json.dump({'deviceID': device_id}, config)
    return


# -- WebRTC Device Client ---
class CameraClient:
    '''
    Need to restructure the class to keep connect -> listen -> start -> offer -> answer -> candidates -> close
    that should be the lifecycle so this should help readability
    '''
    def __init__(self, ws_url:str, device_id:str):
        self.ws_url = ws_url
        self.pc = None
        self.websocket = None
        self.media = None
        self.target = None
        self.device_id = device_id

    async def connect(self):
        self.websocket = await websockets.connect(self.ws_url)
        if self.websocket.state == State.OPEN:
            print('Websocket Connected')

            register_message: CommandMessage = {
                    'type': 'command',
                    'sender': self.device_id,
                    'command': 'register'
            }
            await self.websocket.send(json.dumps(register_message))
            await self.listen()
        
        else:
            print('Websocket Connection Failed')

    async def listen(self):
        print('listening for socket messages')
        try:
            while True:
                message = await self.websocket.recv()
                print(f'Received Message: {message}')
                data: SignallingMessage = json.loads(message)

                if data['type'] == 'command':
                    command = data['command']
                    
                    if command == 'activate':
                        self.target = data['sender']
                        await self.start_webrtc()
                    
                    elif command == 'deactivate':
                        await self.stop_webrtc()

                elif data['type'] == 'answer':
                    await self.handle_answer(data['sdp'])
                
                elif data['type'] == 'candidate':
                    await self.handle_remote_ice(data['candidate'])

        except Exception as e:
            print('Invalid Malformed Websocket Message', e)

    async def start_webrtc(self):

        if self.pc:
            print("A WebRTC connection has already been established...")
            return
        
        self.pc = RTCPeerConnection()
        track = PicameraStreamTrack()
        self.pc.addTrack(track)
        #self.media = MediaPlayer('/dev/video0', format='v4l2')
        print('initiated camera feed')
        #self.pc.addTrack(self.media.video)
        @self.pc.on('track')
        def on_track(track):
            print('Track received', track.kind)

        @self.pc.on('icecandidate')
        async def on_icecandidate(event):
            print(f'generated ICE Candidate: {event.candidate}')
            if event.candidate and self.websocket and self.target:
                candidate_message: CandidateMessage = {
                    'type': 'candidate',
                    'target': self.target,
                    'sender': self.device_id,
                    'timestamp': int(asyncio.get_event_loop().time() * 1000),
                    'candidate': {
                        'candidate': event.candidate.to_sdp(),
                        'sdpMid': event.candidate.sdpMid,
                        'sdpMLineIndex': event.candidate.sdpMLineIndex
                    }
                }
                await self.websocket.send(json.dumps(candidate_message))

        @self.pc.on('connectionstatechange')
        async def on_connectionstatechange():
            print(f'connection state: {self.pc.connectionState}')
            if self.pc.connectionState == 'failed':
                await self.stop_webrtc()

        offer = await self.pc.createOffer()
        print(offer)
        await self.pc.setLocalDescription(offer)
        offer_message: OfferMessage = {
            'type': 'offer',
            'sender': self.device_id,
            'target': self.target,
            'sdp': {
                'type': self.pc.localDescription.type,
                'sdp': self.pc.localDescription.sdp
            }
        }
        # await answer
        await self.websocket.send(json.dumps(offer_message))
        print('Offer sent')

    async def handle_answer(self, sdp):
        if not self.pc:
            print('No active peer connections exist to apply answer to...')
            return

        answer = RTCSessionDescription(sdp=sdp['sdp'], type=sdp['type'])
        await self.pc.setRemoteDescription(answer)
        print('Answer applied')

    async def handle_remote_ice(self, body):
        if not self.pc:
            print('No active RTCPerrConnection to apply ice candidates to...')
            return
        print(f'\n\nReceived Ice Candidate: {body}\n\n')
        candidate_str = body.get('candidate')
        if not candidate_str:
            print('Empty candidate (end of candidate signal)\nignoring')
            return
        candidate = candidate_from_sdp(body['candidate'])
        candidate.sdpMid = body.get('sdpMid')
        candidate.sdpMLineIndex = body.get('sdpMidLineIndex')

        await self.pc.addIceCandidate(candidate)
        print("Remote ice candidate added")

    async def stop_webrtc(self):
        if self.pc:
            await self.pc.close()
            self.pc = None
            print('WebRTC connection closed')


# -- execute stuff --
async def main():

    device_id = load_config()
    if not device_id:
        print('device not reigsterred')
        return

    client = CameraClient('ws://192.168.1.162:5151', device_id)
    await client.connect()

if __name__ == '__main__':
    asyncio.run(main())