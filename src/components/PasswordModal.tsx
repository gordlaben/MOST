import { useState } from 'react';

interface PasswordModalProps {
  isOpen: boolean;
  onSubmit: (password: string) => void;
  error?: string;
}

export default function PasswordModal({ isOpen, onSubmit, error }: PasswordModalProps) {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 p-6 animate-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-white mb-4">Profile Access</h2>
        <p className="text-gray-400 mb-6">
          This dashboard is password protected. Please enter the password to continue.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Enter password"
            autoFocus
          />
          
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
          >
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
