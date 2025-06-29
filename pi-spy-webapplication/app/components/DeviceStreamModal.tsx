
type Device = {
    id: string;
    name: string;
}
type deviceMediaStreamModalProps = {
    videoRef: React.RefCallback<HTMLVideoElement | null>
    device?: Device
    onClose: () => void;
}

const DeviceMediaStreamModal: React.FC<deviceMediaStreamModalProps> = ({ videoRef }) => {

    return (
        <div className="modal">
            <h2>Device Stream</h2>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute top-0 left-0 border border-red-500 w-full h-auto rounded"
            />
        </div>
    )
}


export default DeviceMediaStreamModal