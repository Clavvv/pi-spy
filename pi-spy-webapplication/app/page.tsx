
export default function Home() {
  return (
    <div className='flex flex-col h-screen w-screen justify-center items-center'>
      <h1 className='my-10 font-bold text-4xl'>Pi-Spy</h1>
      <p>Open source video doorbell software</p>
      <div className='flex flex-row space-x-5 mb-4'>
        <a href='dashboard' className='bg-cyan-700 border rounded-lg p-2'>
          Get Started
        </a>
        <a href='//github.com' className='bg-fuchsia-700 border rounded-lg p-2'>
          Contribute
        </a>
      </div>
    </div>
  );
}
