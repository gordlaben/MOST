'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatDateTime, type DateFormat } from '@/lib/date-format';
import type { DashboardList } from '@/hooks/useDashboard';

interface SettingsProps {
  profileId?: string;
}

type SelectOption = { value: string; label: string };

function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select...'
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find((opt) => opt.value === value);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full bg-gray-950/70 border border-gray-800/80 rounded-xl px-4 py-2.5 pr-10 text-left text-white focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/30 outline-none transition-colors"
      >
        <span className={selected ? 'text-white' : 'text-gray-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-gray-800/80 bg-gray-950/95 shadow-xl shadow-black/40 backdrop-blur">
          <ul className="max-h-56 overflow-y-auto py-1 text-sm">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left transition-colors ${opt.value === value ? 'bg-purple-600/20 text-purple-200' : 'text-gray-200 hover:bg-gray-800/60'}`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Settings({ profileId: propProfileId }: SettingsProps) {
  const [clientId, setClientId] = useState('');
  const [rpdbKey, setRpdbKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [loadingGeminiModels, setLoadingGeminiModels] = useState(false);
  const [dateFormat, setDateFormat] = useState<DateFormat>('mdy');
  const [lists, setLists] = useState<DashboardList[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<{
    totalItems: number;
    movies: number;
    shows: number;
    lastSync: string | null;
    nextSync: string | null;
  } | null>(null);
  const [cacheStats, setCacheStats] = useState<{
    totalCount: number;
    totalBytes: number;
    unusedCount: number;
    unusedBytes: number;
    usedCount: number;
    usedBytes: number;
    missingCount: number;
    errorCount: number;
    lastError?: { url: string; reason: string; at: string } | null;
  } | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [message, setMessage] = useState('');
  const [origin, setOrigin] = useState('http://localhost:3000');
  const hasLoadedSettings = useRef(false);
  
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

  const fetchCacheStats = useCallback(() => {
    if (!profileId) return;
    fetch(`/api/settings/cache?profileId=${profileId}`)
      .then(res => res.json())
      .then(data => setCacheStats(data))
      .catch(console.error);
  }, [profileId]);

  const fetchGeminiModels = useCallback(async () => {
    const query = profileId ? `?profileId=${profileId}` : '';
    setLoadingGeminiModels(true);
    try {
      const res = await fetch(`/api/settings/gemini-models${query}`);
      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models.map((m: { name: string }) => m.name) : [];
      setGeminiModels(models);
    } catch {
      setGeminiModels([]);
    } finally {
      setLoadingGeminiModels(false);
    }
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
        setGeminiKey(data.geminiKey || '');
        setLists(data.selectedLists || []);
        setDateFormat(data.filters?.dateFormat || 'mdy');
        setGeminiModel(data.filters?.geminiModel || '');
        setLoading(false);
        hasLoadedSettings.current = true;
      });
      
    fetchStats();
    fetchCacheStats();
    fetchGeminiModels();
  }, [profileId, fetchStats, fetchCacheStats, fetchGeminiModels]);

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

  const handleClearUnusedCache = async () => {
    if (!profileId || clearingCache) return;
    const confirmed = window.confirm('Clear unused cached posters? This cannot be undone.');
    if (!confirmed) return;

    setClearingCache(true);
    setMessage('Clearing unused cached posters...');
    try {
      const res = await fetch('/api/settings/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, action: 'clear-unused' })
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`Removed ${data.removedCount} unused posters.`);
        setCacheStats({
          totalCount: data.totalCount,
          totalBytes: data.totalBytes,
          unusedCount: data.unusedCount,
          unusedBytes: data.unusedBytes,
          usedCount: data.usedCount,
          usedBytes: data.usedBytes,
          missingCount: data.missingCount,
          errorCount: data.errorCount,
          lastError: data.lastError
        });
      } else {
        setMessage('Failed to clear unused cache.');
      }
    } catch {
      setMessage('Error clearing unused cache.');
    } finally {
      setClearingCache(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const persistSettings = async (listsOverride?: DashboardList[], silent = false) => {
    if (!silent) {
      setLoading(true);
      setMessage('');
    } else {
      setSavingSettings(true);
    }
    const listsToSave = listsOverride || lists;

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profileId, // Pass profileId to save to specific profile
          rpdbKey,
          geminiKey,
          selectedLists: listsToSave,
          DATE_FORMAT: dateFormat,
          GEMINI_MODEL: geminiModel
        }),
      });
      if (!silent) {
        setMessage('Settings saved successfully!');
      }
    } catch {
      if (!silent) {
        setMessage('Error saving settings.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      } else {
        setSavingSettings(false);
      }
    }
  };

  useEffect(() => {
    if (!profileId || !hasLoadedSettings.current) return;
    const timer = setTimeout(() => {
      persistSettings(undefined, true);
    }, 700);
    return () => clearTimeout(timer);
  }, [profileId, rpdbKey, geminiKey, geminiModel, dateFormat]);
  
  const handleExport = () => {
    const customLists = lists.filter(l => l.type === 'custom' || l.type === 'ai');
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
    const customLists = lists.filter(l => l.type === 'custom' || l.type === 'ai');
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
              const validImports = importedLists.filter(l => (l.type === 'custom' || l.type === 'ai') && l.id && l.title);
              
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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start gap-4 mb-8">
          <a href={profileId ? `/stremio/${profileId}/configure` : "/"} className="p-2 bg-gray-900/70 rounded-xl border border-gray-800/80 hover:bg-gray-800/80 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </a>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Settings {profileId ? '(Profile)' : ''}</h1>
            <p className="text-sm text-gray-400 mt-1">Manage your profile preferences, caching, and integrations.</p>
          </div>
        </div>
        
        {!clientId && (
        <div className="bg-gray-900/60 p-5 md:p-6 rounded-2xl border border-gray-800/80 shadow-lg shadow-black/20 mb-8">
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
          <div className="bg-gray-900/60 p-5 md:p-6 rounded-2xl border border-yellow-700/50 shadow-lg shadow-black/20 mb-8">
            <h2 className="text-lg md:text-xl font-semibold mb-4 text-yellow-400">Configuration Missing</h2>
            <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-yellow-200 text-sm">
              ⚠️ Please set <code>TRAKT_CLIENT_ID</code> and <code>TRAKT_CLIENT_SECRET</code> in your environment variables or Docker configuration.
            </div>

          </div>
        )}

        {profileId && (
        <div className="space-y-7">

            {/* Library Stats & Actions */}
              <div className="bg-gray-900/60 p-5 md:p-6 rounded-2xl border border-gray-800/80 shadow-lg shadow-black/20">
              <h2 className="text-xl font-bold mb-4 text-purple-400">Library Stats & Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                    <div className="text-gray-400 text-xs uppercase tracking-wider">Total Items</div>
                    <div className="text-2xl font-bold text-white">{stats?.totalItems || 0}</div>
                 </div>
                 <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                    <div className="text-gray-400 text-xs uppercase tracking-wider">Movies</div>
                    <div className="text-2xl font-bold text-white">{stats?.movies || 0}</div>
                 </div>
                 <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                    <div className="text-gray-400 text-xs uppercase tracking-wider">Series</div>
                    <div className="text-2xl font-bold text-white">{stats?.shows || 0}</div>
                 </div>
                 <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                    <div className="text-gray-400 text-xs uppercase tracking-wider">Last Sync</div>
                    <div className="text-sm font-bold mt-1 text-white">
                      {stats?.lastSync ? (formatDateTime(stats.lastSync, dateFormat) || 'Invalid Date') : 'Never'}
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

            {/* Cache Stats */}
            <div className="bg-gray-900/60 p-5 md:p-6 rounded-2xl border border-gray-800/80 shadow-lg shadow-black/20">
              <h2 className="text-xl font-bold mb-4 text-purple-400">Cached Posters</h2>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">Cached Posters</div>
                  <div className="text-2xl font-bold text-white">{cacheStats?.totalCount ?? 0}</div>
                </div>
                <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">Cache Size</div>
                  <div className="text-2xl font-bold text-white">{formatBytes(cacheStats?.totalBytes ?? 0)}</div>
                </div>
                <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">Unused Posters</div>
                  <div className="text-2xl font-bold text-red-400">{cacheStats?.unusedCount ?? 0}</div>
                </div>
                <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">Unused Size</div>
                  <div className="text-2xl font-bold text-red-400">{formatBytes(cacheStats?.unusedBytes ?? 0)}</div>
                </div>
                <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">Missing Posters</div>
                  <div className="text-2xl font-bold text-yellow-300">{cacheStats?.missingCount ?? 0}</div>
                </div>
                <div className="bg-gray-900/70 border border-gray-800/80 p-3 rounded-xl text-center">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">Cache Errors</div>
                  <div className="text-2xl font-bold text-yellow-300">{cacheStats?.errorCount ?? 0}</div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleClearUnusedCache}
                  disabled={clearingCache}
                  className={`flex-1 py-3 px-4 rounded font-bold text-white transition-all shadow-lg ${
                    clearingCache
                      ? 'bg-red-900/50 cursor-not-allowed border border-red-800'
                      : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 hover:shadow-red-500/20 active:scale-[0.98]'
                  }`}
                >
                  {clearingCache ? 'Clearing Cache...' : 'Clear Unused Cache'}
                </button>
              </div>
              {cacheStats?.lastError && (
                <div className="mt-3 text-xs text-yellow-200/80 bg-yellow-900/30 border border-yellow-700/40 rounded p-3">
                  <div className="font-semibold">Last Cache Error</div>
                  <div className="truncate">{cacheStats.lastError.url}</div>
                  <div className="text-yellow-200/70">{cacheStats.lastError.reason} · {formatDateTime(cacheStats.lastError.at, dateFormat)}</div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Cache stats update when you load this page or after clearing unused cache.
              </p>
            </div>

          <div className="bg-gray-900/60 p-5 md:p-6 rounded-2xl border border-gray-800/80 shadow-lg shadow-black/20">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Custom Lists Management</h2>
            
            <div className="flex items-center mb-4">
                <input
                    type="checkbox"
                    id="overwriteExisting"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="w-4 h-4 text-purple-500 bg-gray-900 border-gray-700 rounded focus:ring-purple-500 focus:ring-2"
                />
                <label htmlFor="overwriteExisting" className="ml-2 text-sm font-medium text-gray-300">
                    Overwrite existing lists on import
                </label>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <button
                type="button"
                onClick={handleExport}
                className="flex-1 py-2 bg-gray-900/70 hover:bg-gray-900 rounded-lg font-medium transition-colors border border-gray-800/80"
              >
                Export to File
              </button>
               <button
                type="button"
                onClick={handleCopyToClipboard}
                className="flex-1 py-2 bg-gray-900/70 hover:bg-gray-900 rounded-lg font-medium transition-colors border border-gray-800/80"
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

          <div className="bg-gray-900/60 p-5 md:p-6 rounded-2xl border border-gray-800/80 shadow-lg shadow-black/20">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Poster Settings (Optional)</h2>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              RPDB API Key
            </label>
            <input
              type="text"
              value={rpdbKey}
              onChange={(e) => setRpdbKey(e.target.value)}
              className="w-full bg-gray-950/70 border border-gray-800/80 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/30 outline-none transition-colors"
              placeholder="Enter your RPDB API Key (leave empty for free tier)"
            />
            <p className="text-xs text-gray-500 mt-2">
              Leave empty to use the free tier. Set to &quot;disabled&quot; to use standard Trakt posters.
              <br />
              Get a key at <a href="https://ratingposterdb.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ratingposterdb.com</a> for more features.
            </p>
          </div>

          <div className="bg-gray-900/60 p-5 md:p-6 rounded-2xl border border-gray-800/80 shadow-lg shadow-black/20">
            <h2 className="text-xl font-bold mb-4 text-purple-400">AI Search (Gemini)</h2>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Gemini API Key
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full bg-gray-950/70 border border-gray-800/80 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/30 outline-none transition-colors"
              placeholder="Enter your Gemini API Key"
            />
            <p className="text-xs text-gray-500 mt-2">
              Used for semantic search (e.g., “Best 90s movies”). Leave empty to disable AI search.
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-400">
                  Gemini Model
                </label>
                <button
                  type="button"
                  onClick={fetchGeminiModels}
                  disabled={loadingGeminiModels}
                  className="text-xs text-blue-400 hover:underline disabled:text-gray-500"
                >
                  {loadingGeminiModels ? 'Loading…' : 'Refresh models'}
                </button>
              </div>
              <CustomSelect
                value={geminiModel}
                onChange={setGeminiModel}
                placeholder="Auto (gemini-flash-latest)"
                options={[
                  { value: '', label: 'Auto (gemini-flash-latest)' },
                  ...(geminiModel && !geminiModels.includes(geminiModel)
                    ? [{ value: geminiModel, label: geminiModel }]
                    : []),
                  ...geminiModels.map((model) => ({ value: model, label: model }))
                ]}
              />
              <p className="text-xs text-gray-500 mt-2">
                Model list is loaded from your Gemini API key.
              </p>
            </div>
            <p className={`text-xs mt-2 ${geminiKey ? 'text-green-400' : 'text-gray-500'}`}>
              AI search is {geminiKey ? 'enabled' : 'disabled'}.
            </p>
          </div>

          <div className="bg-gray-900/60 p-5 md:p-6 rounded-2xl border border-gray-800/80 shadow-lg shadow-black/20">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Date Format</h2>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Date Format
            </label>
            <CustomSelect
              value={dateFormat}
              onChange={(val) => setDateFormat(val as DateFormat)}
              options={[
                { value: 'mdy', label: 'MM/DD/YYYY' },
                { value: 'dmy', label: 'DD/MM/YYYY' },
                { value: 'ymd', label: 'YYYY-MM-DD' }
              ]}
            />
            <p className="text-xs text-gray-500 mt-2">
              This format will be used across the UI for dates and date-times.
            </p>
          </div>

          {message && (
            <div className={`p-4 rounded-xl border ${message.includes('Error') ? 'bg-red-900/40 border-red-800/60 text-red-200' : 'bg-green-900/40 border-green-800/60 text-green-200'} shadow-lg shadow-black/10`}>
              {message}
            </div>
          )}

          <div className="text-xs text-gray-500 flex items-center justify-between">
            <span>Changes save automatically.</span>
            {savingSettings && <span className="text-purple-300">Saving…</span>}
          </div>
        </div>
        )}


      </div>
    </div>
  );
}
