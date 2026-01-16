import { Suspense } from 'react';
import Dashboard from '@/components/Dashboard';
import { getAppConfig } from '@/lib/config';

export default function Home() {
  const { enableRegistration } = getAppConfig();
  
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>}>
      <Dashboard enableRegistration={enableRegistration} />
    </Suspense>
  );
}
