import Image from 'next/image';


type Device = {
    id: string,
    name: string,
    thumbnailSrc?: string
}

type DeviceCardProps = {
    device: Device,
    onConnect: (device: Device) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({device, onConnect}) => {
    const { id, name, thumbnailSrc } = device;

    return (
        <div
            className="rounded-lg shadow-md cursor-pointer hover:shadow-2xl transition-shadow duration-300 my-2 p-3"
            onClick={() => onConnect(device)}
        >
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
    );
};

export default DeviceCard;