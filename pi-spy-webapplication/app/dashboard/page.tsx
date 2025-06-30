'use client'
import DeviceList from '@/app/components/DeviceList';

const Dashboard = () => {
    return (
        <div className='flex flex-grow flex-col text-black bg-neutral-200 min-h-screen w-full'>
            <div className='flex flex-col w-full h-full justify-center text-white'>
                <div className='flex flex-col bg-neutral-200'>
                    <h1 className='text-neutral-800 ml-10 mt-2 pt-2 text-xl font-stretch-ultra-condensed'>Your Devices</h1>
                </div>
                <div className='flex flex-row'>
                    <DeviceList />
                </div>
            </div>
        </div>
    )
}


export default Dashboard