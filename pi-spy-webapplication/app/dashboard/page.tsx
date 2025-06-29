'use client'
import DeviceList from '@/app/components/DeviceList';

const Dashboard = () => {
    return (
        <div className='flex flex-grow flex-col text-black bg-neutral-900 min-h-screen w-full'>
            <div className='flex flex-col w-full h-30 justify-center text-white'>
                <h1>Your Devices</h1>
                <div className='flex flex-row'>
                    {/*
                        Component must have a button for opening live feed from the camera
                    */}
                    <DeviceList />
                </div>
            </div>
            <div className='flex flex-col w-full h-30 justify-center text-white'>
                <h1>
                    Clips
                </h1>
                <div className='flex flex-row'>
                    Logic for getting all recordings by user
                </div>
            </div>
        </div>
    )
}


export default Dashboard