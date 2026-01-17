'use client';

import { useState, useEffect } from 'react';
import { formatDate, type DateFormat } from '@/lib/date-format';

interface Profile {
  id: string;
  createdAt: string;
  username: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateFormat, setDateFormat] = useState<DateFormat>('mdy');

  useEffect(() => {
    const storedPassword = sessionStorage.getItem('adminPassword');
    if (storedPassword) {
      setPassword(storedPassword);
      verifyPassword(storedPassword);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.filters?.dateFormat) {
          setDateFormat(data.filters.dateFormat);
        }
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const verifyPassword = async (pwd: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });

      if (res.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem('adminPassword', pwd);
        fetchProfiles(pwd);
      } else {
        setError('Invalid password');
        sessionStorage.removeItem('adminPassword');
      }
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async (pwd: string) => {
    try {
      const res = await fetch('/api/admin/profiles', {
        headers: { 'Authorization': pwd }
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch {
      console.error('Failed to fetch profiles');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    verifyPassword(password);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this profile? This cannot be undone.')) return;

    try {
      const res = await fetch('/api/admin/profiles', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': password 
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setProfiles(profiles.filter(p => p.id !== id));
      } else {
        alert('Failed to delete profile');
      }
    } catch {
      alert('Error deleting profile');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-2xl">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Enter Admin Password"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setPassword('');
              sessionStorage.removeItem('adminPassword');
            }}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-900/50 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Profile ID</th>
                  <th className="px-6 py-4">Trakt User</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm">{profile.id}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        profile.username !== 'Not Connected' 
                          ? 'bg-green-900/50 text-green-400' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {profile.username}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatDate(profile.createdAt, dateFormat) || 'Invalid Date'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <a
                        href={`/stremio/${profile.id}/configure`}
                        target="_blank"
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleDelete(profile.id)}
                        className="text-red-400 hover:text-red-300 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No profiles found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
