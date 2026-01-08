'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { DashboardList } from '@/hooks/useDashboard';

interface SettingsProps {
  profileId?: string;
}

export default function Settings({ profileId: propProfileId }: SettingsProps) {
  const [clientId, setClientId] = useState('');
  const [rpdbKey, setRpdbKey] = useState('');
  const [lists, setLists] = useState<DashboardList[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<{
    totalItems: number;
    movies: number;
    shows: number;
    lastSync: string | null;
    nextSync: string | null;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [origin, setOrigin] = useState('http://localhost:3000');
  
  const searchParams = useSearchParams();
  // Fallback to query param if prop is not provided (legacy support)
  const profileId = propProfileId || searchParams.get('id');

  const fetchStats = useCallback(() => {
    if (!profileId) return;
    fetch(`/api/settings/stats?profileId=${profileId}`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, [profileId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
    
    const query = profileId ? `?profileId=${profileId}` : '';
    
    fetch(`/api/settings${query}`)
      .then((res) => res.json())
      .then((data) => {
        setClientId(data.clientId || '');
        setRpdbKey(data.rpdbKey === 't0-free-rpdb' ? '' : data.rpdbKey || '');
        setLists(data.selectedLists || []);
        setLoading(false);
      });
      
    fetchStats();
  }, [profileId, fetchStats]);

  const handleRefreshLists = async () => {
    setRefreshing(true);
    setMessage('Refreshing lists... This may take a while.');
    try {
      const res = await fetch('/api/settings/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      if (res.ok) {
        setMessage('Lists refreshed successfully!');
        fetchStats();
      } else {
         setMessage('Failed to refresh lists.');
      }
    } catch {
      setMessage('Error triggering refresh.');
    } finally {
      setRefreshing(false);
    }
  };

  const persistSettings = async (listsOverride?: DashboardList[]) => {
    setLoading(true);
    setMessage('');
    const listsToSave = listsOverride || lists;

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profileId, // Pass profileId to save to specific profile
          rpdbKey,
          selectedLists: listsToSave
        }),
      });
      setMessage('Settings saved successfully!');
    } catch {
      setMessage('Error saving settings.');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistSettings();
  };
  
  const handleExport = () => {
    const customLists = lists.filter(l => l.type === 'custom');
    if (customLists.length === 0) {
      setMessage('No custom lists to export.');
      return;
    }
    const dateStr = new Date().toISOString().split('T')[0];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customLists, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `bingarr_custom_lists_${dateStr}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleCopyToClipboard = () => {
    const customLists = lists.filter(l => l.type === 'custom');
    if (customLists.length === 0) {
      setMessage('No custom lists to copy.');
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(customLists, null, 2))
      .then(() => {
        setMessage('Custom lists copied to clipboard!');
        setTimeout(() => setMessage(''), 3000);
      })
      .catch((err) => {
        console.error('Clipboard error:', err);
        setMessage('Failed to copy to clipboard. Check permissions.');
      });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          if (event.target?.result) {
            const importedLists = JSON.parse(event.target.result as string);
            if (Array.isArray(importedLists)) {
              const validImports = importedLists.filter(l => l.type === 'custom' && l.id && l.title);
              
              let newLists = [...lists];
              let addedCount = 0;
              let updatedCount = 0;

              if (overwriteExisting) {
                 const listMap = new Map(lists.map(l => [l.id, l]));
                 
                 validImports.forEach(l => {
                    if (listMap.has(l.id)) {
                        listMap.set(l.id, l);
                        updatedCount++;
                    } else {
                        listMap.set(l.id, l);
                        addedCount++;
                    }
                 });
                 newLists = Array.from(listMap.values());
              } else {
                  const existingIds = new Set(lists.map(l => l.id));
                  validImports.forEach(l => {
                    if (!existingIds.has(l.id)) {
                      newLists.push(l);
                      existingIds.add(l.id);
                      addedCount++;
                    }
                  });
              }

              setLists(newLists);
              await persistSettings(newLists);
              
              let msg = `Imported ${addedCount} new lists`;
              if (updatedCount > 0) msg += ` and updated ${updatedCount} existing lists`;
              msg += '. Settings saved automatically.';
              setMessage(msg);
            } else {
              setMessage('Error: Invalid JSON format (expected an array).');
            }
          }
        } catch {
          setMessage('Error parsing JSON file.');
        }
      };
    }
    // Reset input
    e.target.value = '';
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <a href={profileId ? `/stremio/${profileId}/configure` : "/"} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </a>
          <h1 className="text-2xl md:text-3xl font-bold">Settings {profileId ? '(Profile)' : ''}</h1>
        </div>
        
        {!clientId && (
        <div className="bg-gray-800 p-4 md:p-6 rounded-xl border border-gray-700 mb-8">
          <h2 className="text-lg md:text-xl font-semibold mb-4 text-purple-400">How to get your Trakt API Keys</h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-300 text-sm">
            <li>
              Go to <a href="https://trakt.tv/oauth/applications" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Trakt API Applications</a> and click <strong>New Application</strong>.
            </li>
            <li>
              Enter a <strong>Name</strong> (e.g., &quot;Bingarr&quot;).
            </li>
            <li>
              Set <strong>Redirect URI</strong> to:
              <code className="block mt-1 bg-black/50 p-2 rounded text-green-400 font-mono select-all break-all text-xs md:text-sm">
                {origin}/api/auth/callback
              </code>
            </li>
            <li>
              Set <strong>Javascript (CORS) origins</strong> to:
              <code className="block mt-1 bg-black/50 p-2 rounded text-green-400 font-mono select-all break-all text-xs md:text-sm">
                {origin}
              </code>
            </li>
            <li>
              Click <strong>Save App</strong>. Copy the <strong>Client ID</strong> and <strong>Client Secret</strong>.
            </li>
            <li>
              Add them to your <code>docker-compose.yml</code> or environment variables:
              <pre className="mt-2 bg-black/50 p-3 rounded text-gray-300 font-mono text-xs md:text-sm overflow-x-auto">
{`environment:
  - TRAKT_CLIENT_ID=your_client_id
  - TRAKT_CLIENT_SECRET=your_client_secret`}
              </pre>
            </li>
          </ol>
        </div>
        )}

        {!clientId && (
          <div className="bg-gray-800 p-4 md:p-6 rounded-xl border border-yellow-700/50 mb-8">
            <h2 className="text-lg md:text-xl font-semibold mb-4 text-yellow-400">Configuration Missing</h2>
            <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-yellow-200 text-sm">
              ⚠️ Please set <code>TRAKT_CLIENT_ID</code> and <code>TRAKT_CLIENT_SECRET</code> in your environment variables or Docker configuration.
            </div>
          </div>
        )}

        {profileId && (
        <form onSubmit={saveSettings} className="space-y-6 bg-gray-800 p-4 md:p-6 rounded-xl border border-gray-700">

            {/* Library Stats & Actions */}
            <div className="border-b border-gray-700 pb-6 mb-6">
              <h2 className="text-xl font-bold mb-4 text-purple-400">Library Stats & Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                 <div className="bg-gray-700 p-3 rounded text-center">
                    <div className="text-gray-400 text-xs uppercase tracking-wider">Total Items</div>
                    <div className="text-2xl font-bold text-white">{stats?.totalItems || 0}</div>
                 </div>
                 <div className="bg-gray-700 p-3 rounded text-center">
                    <div className="text-gray-400 text-xs uppercase tracking-wider">Movies</div>
                    <div className="text-2xl font-bold text-white">{stats?.movies || 0}</div>
                 </div>
                 <div className="bg-gray-700 p-3 rounded text-center">
                    <div className="text-gray-400 text-xs uppercase tracking-wider">Series</div>
                    <div className="text-2xl font-bold text-white">{stats?.shows || 0}</div>
                 </div>
                 <div className="bg-gray-700 p-3 rounded text-center">
                    <div className="text-gray-400 text-xs uppercase tracking-wider">Last Sync</div>
                    <div className="text-sm font-bold mt-1 text-white">
                      {stats?.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never'}
                    </div>
                 </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleRefreshLists}
                  disabled={refreshing}
                  className={`flex-1 py-3 px-4 rounded font-bold text-white transition-all shadow-lg ${
                    refreshing 
                      ? 'bg-blue-900/50 cursor-not-allowed border border-blue-800' 
                      : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/20 active:scale-[0.98]'
                  }`}
                >
                  {refreshing ? (
                    <span className="flex items-center justify-center gap-2">
                       <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Syncing Library...
                    </span>
                  ) : (
                    '↻ Refresh All Lists Now'
                  )}
                </button>
              </div>
            </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-purple-400">Custom Lists Management</h3>
            
            <div className="flex items-center mb-4">
                <input
                    type="checkbox"
                    id="overwriteExisting"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                />
                <label htmlFor="overwriteExisting" className="ml-2 text-sm font-medium text-gray-300">
                    Overwrite existing lists on import
                </label>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <button
                type="button"
                onClick={handleExport}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors border border-gray-600"
              >
                Export to File
              </button>
               <button
                type="button"
                onClick={handleCopyToClipboard}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors border border-gray-600"
              >
                Copy to Clipboard
              </button>
              <label className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors border border-purple-600 text-center cursor-pointer">
                Import JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Export your custom lists to a JSON file or import them from a backup.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-purple-400">Poster Settings (Optional)</h3>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              RPDB API Key
            </label>
            <input
              type="text"
              value={rpdbKey}
              onChange={(e) => setRpdbKey(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Enter your RPDB API Key (leave empty for free tier)"
            />
            <p className="text-xs text-gray-500 mt-2">
              Leave empty to use the free tier. Set to &quot;disabled&quot; to use standard Trakt posters.
              <br />
              Get a key at <a href="https://ratingposterdb.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ratingposterdb.com</a> for more features.
            </p>
          </div>

          {message && (
            <div className={`p-4 rounded ${message.includes('Error') ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
        )}


      </div>
    </div>
  );
}
