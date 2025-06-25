import asyncio
import json
import websockets
from websockets.protocol import State
import os
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
from aiortc.contrib.media import MediaPlayer

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


    

class CameraClient:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.pc = None
        self.websocket = None
        self.media = None

    async def listen(self):
        print('listening for socket messages')
        try:
            while True:
                message = await self.websocket.recv()
                print(f'Received Message: {message}')
                data = json.loads(message)
                command = data.get('command')
                body = data.get('body')
                if command == 'activate':
                    await self.start_webrtc()

                elif command == 'answer':
                    await self.handle_answer(body)

                elif command == 'ice':
                    await self.handle_remote_ice(body)

                elif command == 'deactivate':
                    await self.stop_webrtc()
        except Exception as e:
            print(f'Websocket error {e}')

    async def start_webrtc(self):

        if self.pc:
            print("A WebRTC connection has already been established...")
            return
        
        self.pc = RTCPeerConnection()
        self.media = MediaPlayer("/dev/video0", format="v412", options={ 'video_size': '640x480' })
        print('initiated camera feed')

        @self.pc.on('icecandidate')
        async def on_icecandidate(event):
            if event.candidate:
                await self.websocket.send(json.dumps({
                    'command': 'ice',
                    'body': {
                        'candidate': event.candidate.to_sdp(),
                        'sdpMid': event.candidate.sdpMid,
                        'sdpMLineIndex': event.candidate.sdpMLineIndex
                    }
                }))

        @self.pc.on('connectionstatechange')
        async def on_connectionstatechange():
            print(f'connection state: {self.pc.connectionState}')

            if self.pc.connectionState == 'failed':
                await self.stop_webrtc()
                print('WebRTC connection failed to establish')

        offer = await self.pc.createOffer()
        print('offer created')
        await self.pc.setLocalDescription(offer)
        # await answer
        await self.websocket.send(json.dumps({
            'command': 'offer',
            'body': {
                'type': self.pc.localDescription.type,
                'sdp': self.pc.localDescription.sdp
            }
        }))
        print('Offer sent')

    async def handle_answer(self, body):
        if not self.pc:
            print('No active peer connections exist to apply answer to...')
            return
        
        answer = RTCSessionDescription(sdp=body['sdp'], type=body['type'])
        await self.pc.setRemoteDescription(answer)

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

    async def connect(self):
        self.websocket = await websockets.connect(self.ws_url)
        device_id = load_config()
        if device_id:
            await self.websocket.send(json.dumps({
                'type': 'register',
                'id': device_id
            }))
            print(f'websocket is pen: {self.websocket.state == State.OPEN}')
            await self.listen()
        
        else:
            print('Device is not yet registerred')
            return



async def main():
    client = CameraClient('ws://192.168.1.162:5151')
    await client.connect()

if __name__ == '__main__':
    device_id = load_config()
    if not device_id:
        print('device not reigsterred')
    asyncio.run(main())