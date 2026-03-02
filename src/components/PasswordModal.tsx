import { useState, useEffect, useRef, useCallback } from 'react';

interface PasswordModalProps {
  isOpen: boolean;
  onSubmit: (password: string) => void;
  error?: string;
}

export default function PasswordModal({ isOpen, onSubmit, error }: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
        aria-describedby="password-description"
        className="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 p-6 animate-in zoom-in-95 duration-200"
      >
        <h2 id="password-title" className="text-xl font-bold text-white mb-4">Profile Access</h2>
        <p id="password-description" className="text-gray-400 mb-6">
          This dashboard is password protected. Please enter the password to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="profile-password" className="sr-only">Password</label>
          <input
            id="profile-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Enter password"
            autoFocus
          />

          {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

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
