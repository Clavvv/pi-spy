import { RiSpyLine } from "react-icons/ri";


const Navbar = () => {
    return (
        <div className='flex flex-row h-15 w-screen justify-between items-center bg-[#121212] drop-shadow-lg'>
            <div className='flex flex-row ml-10 justify-center space-x-1.5'>
                <RiSpyLine size={32} className='' />
                <h1 className='text-xl justify-center mt-1'>Pi-Spy</h1>
            </div>
            <div className='mr-10'>
                profile img
            </div>

        </div>

    )
}

export default Navbar;