import asyncio
import json
import websockets
from websockets.protocol import State
import os
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
from aiortc.contrib.media import MediaPlayer
from typing import TypedDict, Literal, NotRequired, Union
from typing_extensions import NotRequired

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
        self.media = MediaPlayer('/dev/video0', format='V4l2', options={
                        'video_size': '640x480'
                    })
        print('initiated camera feed')
        @self.pc.on('track')
        def on_track(track):
            print('Track received', track.kind)

        @self.pc.on('icecandidate')
        async def on_icecandidate(event):
            if event.candidate and self.websocket and self.target:
                candidate_message: CandidateMessage = {
                    'type': 'command',
                    'command': 'ice',
                    'target': self.target,
                    'timestamp': int(asyncio.get_event_loop.time() * 1000),
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
        
        candidate = RTCIceCandidate(
            candidate=body['candidate'],
            sdpMid=body['sdpMid'],
            sdpMLineIndex=body['sdpMLineIndex']
        )
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