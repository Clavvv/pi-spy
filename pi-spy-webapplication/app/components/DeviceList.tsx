/*
TO-DO:

    Debug:
        Need to associate the frontend with an id so it can sign the activate command and get the proper device id.
        Will update the websocket interface to include a 'sender' tag so the device knows where to begin streaming.
        Well just start with a uuid and then later register that by user and register devices as well
*/

import { useState, useEffect, useRef, useCallback } from 'react';
import DeviceCard from './DeviceCard';
import Image from 'next/image';
import DeviceMediaStreamModal from './DeviceStreamModal';
import { WebRTCClient } from '../utils/WebRTCClient';
import { v4 as uuidv4 } from 'uuid';

type Device = {
    id: string,
    name: string
}

const DeviceList: React.FC = () => {

    const [devices, setDevices] = useState<Device[]>([])
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const WebRTCClientRef = useRef<WebRTCClient | null>(null);
    const frontendUserIdRef = useRef<string>(uuidv4())

    const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
        setVideoEl(node)
    }, [])

    useEffect(() => {
        fetch('/data.json')
            .then((res) => res.json())
            .then((data: Device[]) => {
                setDevices(data);
            })
            .catch((error) => {
                console.error('Error loading devices:', error);
            });
        
        if (!WebRTCClientRef.current) {
            WebRTCClientRef.current = new WebRTCClient(`ws://192.168.1.162:5151`, frontendUserIdRef.current)
            WebRTCClientRef.current.start();
        }

        return () => {
            WebRTCClientRef.current?.close()
        }
    }, []);

    useEffect(() => {
        if (videoEl) {
            WebRTCClientRef.current?.setVideoElement(videoEl)
        }
    }, [videoEl])

    const onConnect = (device: Device) => {
        setSelectedDevice(device);
        setModalOpen(true)

        if (videoRef.current) {
            WebRTCClientRef.current?.setVideoElement(videoRef.current)
        }
        WebRTCClientRef.current?.setTarget(device.id)
        WebRTCClientRef.current?.sendActivate(device.id.toString())
    }

    const closeModal = () => {
        WebRTCClientRef.current?.close();
        setModalOpen(false);
        setSelectedDevice(null);
    };

    /*
        yet to add functionality for registerring new device
    */
    const newDevice = (
        <div className="flex flex-col rounded-lg shadow-md cursor-pointer hover:shadow-2xl transition-shadow duration-300 my-2 p-3 justify-center items-center">
            <h3 className="text-neutral-600 pt-1 mb-1">
                Add New Device
            </h3>
            <Image
                src={'/plus-icon.svg'}
                alt=""
                width={300}
                height={200}
                className="rounded object-cover h-[72px] w-[140px]"
            />
        </div>
    )

    const deviceIsSelect = (obj: Device | null): obj is Device => {
        // this is a type guard gunction to stop the squiggle on the conditional rendering
        // obj is Device is type narrowing.
        /*

        its basically doing this:

        const myVar = Device | null
        scope thinks that this can be either of two possibility null or the device type
        when I do 
        if (myVar) {
            // inside here we know the type can no longer be null since we cannot access this part of the code if it is
        }

        The obj is Device is called a Type predicate and it just lets Typescript know that we are validating the type here to narrow it
        we gotta use it to get rid of that annoying squiggle because for some reason checking 'selectedDevice' is not sufficent for typescript
        to stop screaming at me.
        */
        return (obj !== null);
    }


    return (
        <div className='grid grid-cols-3 h-full w-full bg-neutral-200 justify-center px-5 space-x-5'>
            {devices.map(device => (
                <DeviceCard key={device.id} device={device} onConnect={onConnect} />
            ))}

            {modalOpen && deviceIsSelect(selectedDevice) && (
                    <DeviceMediaStreamModal videoRef={videoRefCallback} device={selectedDevice} onClose={closeModal} />)}
        </div>
    )

}

export default DeviceList;