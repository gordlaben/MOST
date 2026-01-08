'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 text-white p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-6xl font-bold text-red-600">Oops!</h1>
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <p className="text-neutral-400">
          We encountered an unexpected error. Please try again later.
        </p>
        <div className="pt-6 space-x-4">
          <button
            onClick={
              // Attempt to recover by trying to re-render the segment
              () => reset()
            }
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-950 transition-colors"
          >
            Try again
          </button>
          <Link 
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-neutral-800 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-950 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
