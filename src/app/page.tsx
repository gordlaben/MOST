import { Suspense } from 'react';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  const enableRegistration = process.env.ENABLE_REGISTRATION !== 'false';
  
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>}>
      <Dashboard enableRegistration={enableRegistration} />
    </Suspense>
  );
}
