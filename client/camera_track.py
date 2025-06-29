from aiortc import VideoStreamTrack
from av import VideoFrame
from picamera2 import Picamera2
import asyncio

class PicameraStreamTrack(VideoStreamTrack):
    def __init__(self, picam2):
        super().__init__()
        self.picam2 = Picamera2
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
