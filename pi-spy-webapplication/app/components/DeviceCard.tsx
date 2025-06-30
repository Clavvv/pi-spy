import Image from 'next/image';
import { FaEdit } from "react-icons/fa";
import { MdDelete } from "react-icons/md";

type Device = {
    id: string,
    name: string,
    thumbnailSrc?: string
}

type DeviceCardProps = {
    device: Device,
    onConnect: (device: Device) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onConnect }) => {
    const { id, name, thumbnailSrc } = device;

    return (
        <div className='w-full h-full p-1'>

            <div
                className="flex flex-row rounded-lg shadow-md cursor-pointer hover:border-amber-400 border-2 border-transparent \
                 hover:shadow-2xl transition-shadow duration-300 m-2 p-3 justify-between"
                onClick={() => onConnect(device)}
            >
                <div>

                    <Image
                        src={thumbnailSrc || "/sample.jpg"}
                        alt={`${name} thumbnail`}
                        width={300}
                        height={200}
                        className="rounded object-cover h-[72px] w-[140px]"
                    />
                    <div className="mt-2">
                        <h3 className="text-sm font-medium text-neutral-600">{name}</h3>
                        <p className="text-xs text-neutral-600">Device ID: {id}</p>
                    </div>
                </div>
                <div className='flex flex-col justify-between items-center'>
                    <div className='flex flex-row text-neutral-700'>
                        <FaEdit className='mx-2 hover:scale-120 transition-transform duration-100' />
                        <MdDelete className='mx-2 hover:scale-120 transition-transform duration-100' />
                    </div>

                    <Image 
                        className='rotate-90 my-2 ml-7 p-1 hover:scale-120 transition-transform duration-200'
                        src="chevron-right.svg"
                        alt="info"
                        width={24}
                        height={24}
                         />

                </div>
            </div>
        </div>
    );
};

export default DeviceCard;