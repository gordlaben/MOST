import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { ToastMessage, ToastType } from '@/components/Toast';
import { TraktBingeReadyShow, TraktEpisodeLeftShow, TraktShow, TraktMovie, TraktSeason, TraktEpisode } from '@/lib/trakt';

export interface TraktList {
    ids: {
        trakt: number;
        slug: string;
    };
    name: string;
    username?: string;
    description?: string;
    item_count: number;
    content_type?: string;
}

export interface TraktListItem {
    rank: number;
    id: number;
    listed_at: string;
    type: 'movie' | 'show' | 'season' | 'episode';
    movie?: TraktMovie;
    show?: TraktShow;
    season?: TraktSeason;
    episode?: TraktEpisode;
}

export interface DashboardList {
    id: string;
    name: string;
  type: 'system' | 'custom' | 'trakt' | 'ai';
    enabled: boolean;
    owner?: string;
    description?: string;
    item_count?: number;
    content_type?: string;
    placeholder?: {
        enabled: boolean;
        title?: string;
        poster?: string;
    };
}

const SYSTEM_LISTS: DashboardList[] = [
    { id: 'binge_ready', name: 'Binge Ready', type: 'system', enabled: true },
    { id: 'episodes_left', name: 'Episodes Left', type: 'system', enabled: true }
];

interface DashboardProps {
  profileId?: string;
}

export function useDashboard({ profileId: propProfileId }: DashboardProps) {
  const [calendarUrl, setCalendarUrl] = useState<string>('');
  const [stremioUrl, setStremioUrl] = useState<string>('');
  const [status, setStatus] = useState<{ isConnected: boolean; hasCredentials: boolean; rpdbKey?: string } | null>(null);
  const [dateFormat, setDateFormat] = useState<'mdy' | 'dmy' | 'ymd'>('mdy');
  const [stats, setStats] = useState<{ username: string; totalShows: number; lastWatched: string; avatar?: string } | null>(null);
  const [bingeReadyShows, setBingeReadyShows] = useState<TraktBingeReadyShow[]>([]);
  const [episodesLeftShows, setEpisodesLeftShows] = useState<TraktEpisodeLeftShow[]>([]);
  const [activeTab, setActiveTab] = useState<'binge_ready' | 'episodes_left'>('binge_ready');
  
  // View State
  const [view, setView] = useState<'home' | 'lists' | 'items'>('home');
  const [activeList, setActiveList] = useState<DashboardList | null>(null);
  const [listItems, setListItems] = useState<TraktListItem[]>([]);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  // Profile / Auth State
  const [profileId, setProfileId] = useState<string | null>(propProfileId || null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Profile Creation State
  const [profilePassword, setProfilePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createProfileError, setCreateProfileError] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);
  
  // Filter States
  const [includeEnded, setIncludeEnded] = useState(true);
  const [includeCanceled, setIncludeCanceled] = useState(true);
  const [includeReturning, setIncludeReturning] = useState(true);
  const [sortBy, setSortByState] = useState('newest');
  const [sortPreferences, setSortPreferences] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);

  const currentListId = useMemo(() => {
    if (view === 'items' && activeList) return activeList.id;
    if (view === 'home') return activeTab; 
    return 'global'; 
  }, [view, activeList, activeTab]);

  // Sync sortBy when active list changes
  useEffect(() => {
    const pref = sortPreferences[currentListId] || 'newest';
    setSortByState(pref);
  }, [currentListId, sortPreferences]);

  const setSortBy = useCallback((val: string) => {
    setSortByState(val);
    setSortPreferences(prev => ({ ...prev, [currentListId]: val }));
  }, [currentListId]);

  // List Management
  const [traktLists, setTraktLists] = useState<TraktList[]>([]);
  const [selectedLists, setSelectedLists] = useState<DashboardList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [savingLists, setSavingLists] = useState(false);

  const [loadingShows, setLoadingShows] = useState(false);
  // Add state to track if we've attempted to load system lists to prevent infinite loops on empty lists
  const [hasLoadedBinge, setHasLoadedBinge] = useState(false);
  const [hasLoadedEpisodes, setHasLoadedEpisodes] = useState(false);

  const [loadingMessage, setLoadingMessage] = useState('Scanning your library...');
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const [apiStats, setApiStats] = useState<{ calls: number; minIntervalMinutes: number } | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Track previous sort/filter to trigger refetches
  const bingeSortRef = useRef(sortBy);
  const bingeFiltersRef = useRef('');
  const episodesSortRef = useRef(sortBy);
  const episodesFiltersRef = useRef('');

  useEffect(() => {
    if (profileId && typeof window !== 'undefined') {
        const baseUrl = window.location.origin;
        setCalendarUrl(`${baseUrl}/api/calendar/${profileId}`);
        setStremioUrl(`${baseUrl}/stremio/${profileId}/manifest.json`);
    }
  }, [profileId]);

  useEffect(() => {
    if (profileId) {
      const storedStats = localStorage.getItem(`most_stats_${profileId}`);
      if (storedStats) {
        try {
          setApiStats(JSON.parse(storedStats));
        } catch (e) {
          console.error('Failed to parse stored stats', e);
        }
      }
      
      const storedTime = localStorage.getItem(`most_last_refresh_${profileId}`);
      if (storedTime) {
        setLastRefreshTime(parseInt(storedTime, 10));
      }
    }
  }, [profileId]);

  // Countdown Timer
  useEffect(() => {
    if (!lastRefreshTime || !apiStats?.minIntervalMinutes) {
      setTimeRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const nextRefresh = lastRefreshTime + (apiStats.minIntervalMinutes * 60 * 1000);
      const remaining = Math.max(0, Math.ceil((nextRefresh - now) / 1000));
      
      setTimeRemaining(remaining);
    }, 1000);

    // Initial call
    const now = Date.now();
    const nextRefresh = lastRefreshTime + (apiStats.minIntervalMinutes * 60 * 1000);
    const remaining = Math.max(0, Math.ceil((nextRefresh - now) / 1000));
    setTimeRemaining(remaining);

    return () => clearInterval(interval);
  }, [lastRefreshTime, apiStats]);

  const formatTimeRemaining = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText: string;
    confirmColor: 'blue' | 'red' | 'green' | 'purple';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirm',
    confirmColor: 'blue',
  });

  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');

  // URL Sync Effect - Load state from URL on mount/update
  useEffect(() => {
    // Wait for lists to load before validting the 'list' param
    if (loadingLists || selectedLists.length === 0) return;
    
    // Check 'list' param for View Mode = 'items'
    const listParam = searchParams.get('list');
    
    if (listParam) {
        // Find in System Lists
        const systemList = SYSTEM_LISTS.find(l => l.id === listParam);
        if (systemList) {
            if (activeList?.id !== systemList.id) {
                setActiveList(systemList);
                setView('items');
            }
            return;
        }

        // Find in Custom Lists
        const customList = selectedLists.find(l => l.id === listParam);
        if (customList) {
             if (activeList?.id !== customList.id) {
                setActiveList(customList);
                setView('items');
            }
            return;
        }
    } else {
        // No 'list' param -> Home View
        // Only if we are not already in home view (prevents infinite loop if user navigates manually)
        if (view !== 'home' && !listParam) {
             setView('home');
             setActiveList(null);
        }
    }
  }, [searchParams, selectedLists, loadingLists, activeList?.id, view]); // Depend on searchParams

  const updateUrl = useCallback((mode: 'home' | 'items', listId?: string) => {
      const url = new URL(window.location.href);
      if (mode === 'items' && listId) {
          url.searchParams.set('list', listId);
      } else {
          url.searchParams.delete('list');
      }
      window.history.pushState({}, '', url.toString());
  }, []);
  
  // Profile / Auth Effect
  useEffect(() => {
    // If profileId is passed as prop, use it. Otherwise check search params (legacy)
    const id = propProfileId || idParam;
    
    if (id) {
      setProfileId(id);
      const storedToken = localStorage.getItem(`most_token_${id}`);
      if (storedToken) {
        setIsAuthorized(true);
      } else {
        setIsPasswordModalOpen(true);
      }
    } else {
      setIsAuthorized(false);
    }
  }, [idParam, propProfileId]);

  const handlePasswordSubmit = async (password: string) => {
    setPasswordError('');
    try {
      const res = await fetch('/api/profile/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profileId, password }),
      });
      
      if (!res.ok) throw new Error('Invalid password');
      
      const data = await res.json();
      localStorage.setItem(`most_token_${profileId}`, data.token);
      setIsAuthorized(true);
      setIsPasswordModalOpen(false);
    } catch {
      setPasswordError('Invalid password');
    }
  };

  const fetchWithProgress = useCallback(async (url: string, onProgress: (msg: string) => void) => {
    try {
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const contentType = res.headers.get('Content-Type');
      
      if (contentType && contentType.includes('application/json')) {
          return res.json(); // Cached response
      }

      const reader = res.body?.getReader();
      if (!reader) return [];

      const decoder = new TextDecoder();
      let buffer = '';
      let finalData = [];

      while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line

          for (const line of lines) {
              if (!line.trim()) continue;
              try {
                  const msg = JSON.parse(line);
                  if (msg.type === 'progress') {
                      onProgress(msg.message + (msg.total ? ` (${msg.current}/${msg.total})` : ''));
                  } else if (msg.type === 'result') {
                      finalData = msg.data;
                  } else if (msg.type === 'stats') {
                      const newStats = { calls: msg.calls, minIntervalMinutes: msg.minIntervalMinutes };
                      setApiStats(newStats);
                      if (profileId) {
                        localStorage.setItem(`most_stats_${profileId}`, JSON.stringify(newStats));
                      }
                  } else if (msg.type === 'error') {
                      throw new Error(msg.message);
                  }
              } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                  // If it's our own error, rethrow it
                  if (e.message && !e.message.includes('JSON')) throw e;
              }
          }
      }
      return finalData;
    } catch (error) {
      throw error;
    }
  }, [profileId]);

  const fetchTraktLists = useCallback(async () => {
    if (!profileId) return;
    setLoadingLists(true);
    try {
      const res = await fetch(`/api/trakt/lists?profileId=${profileId}`);
      if (res.ok) {
        const lists = await res.json();
        setTraktLists(lists);
      }
    } catch (e) {
      console.error('Failed to fetch lists', e);
      addToast('Failed to fetch Trakt lists', 'error');
    } finally {
      setLoadingLists(false);
    }
  }, [profileId, addToast]);

  useEffect(() => {
    if (!isAuthorized) return;

    const query = profileId ? `?profileId=${profileId}` : '';

    fetch(`/api/settings${query}`)
      .then((res) => res.json())
      .then((data) => {
        setStatus({
          isConnected: data.isConnected,
          hasCredentials: data.hasCredentials,
          rpdbKey: data.rpdbKey,
        });

        // Load saved filters
        if (data.filters) {
            setIncludeEnded(data.filters.includeEnded);
            setIncludeCanceled(data.filters.includeCanceled);
            setIncludeReturning(data.filters.includeReturning);
            if (data.filters.sortPreferences) {
                setSortPreferences(data.filters.sortPreferences);
            }
          if (data.filters.dateFormat) {
            setDateFormat(data.filters.dateFormat);
          }
        }

        if (data.selectedLists && data.selectedLists.length > 0) {
          const hasSystemLists = data.selectedLists.some((l: DashboardList) => l.type === 'system');
          if (!hasSystemLists) {
             // Migration: Prepend system lists to existing Trakt lists
             setSelectedLists([...SYSTEM_LISTS, ...data.selectedLists]);
          } else {
             setSelectedLists(data.selectedLists);
          }
        } else {
            // Default initialization
            setSelectedLists(SYSTEM_LISTS);
        }

        if (data.isConnected) {
          // Generate URLs automatically
          const baseUrl = window.location.origin;
          if (profileId) {
             setCalendarUrl(`${baseUrl}/api/calendar/${profileId}`);
             setStremioUrl(`${baseUrl}/stremio/${profileId}/manifest.json`);
          } else {
             setCalendarUrl(`${baseUrl}/api/calendar`);
             setStremioUrl(`${baseUrl}/stremio/manifest.json`);
          }

          fetchTraktLists();
          fetch(`/api/stats${query}`)
            .then((res) => res.json())
            .then((statsData) => {
              if (!statsData.error) {
                setStats(statsData);
              }
            });
        }
      });
  }, [isAuthorized, profileId, fetchTraktLists]);

  useEffect(() => {
    if (status?.isConnected && activeList?.type === 'system') {
      const isBingeReady = activeList.id === 'binge_ready';
      const currentData = isBingeReady ? bingeReadyShows : episodesLeftShows;
      
      const filtersHash = JSON.stringify({ includeEnded, includeCanceled, includeReturning });
      const lastSort = isBingeReady ? bingeSortRef.current : episodesSortRef.current;
      const lastFilters = isBingeReady ? bingeFiltersRef.current : episodesFiltersRef.current;

      if (currentData.length > 0 && lastSort === sortBy && lastFilters === filtersHash) {
          return;
      }
      
      if (isBingeReady) {
          bingeSortRef.current = sortBy;
          bingeFiltersRef.current = filtersHash;
      } else {
          episodesSortRef.current = sortBy;
          episodesFiltersRef.current = filtersHash;
      }

      setLoadingShows(true);
      setLoadingMessage('Scanning your library...');
      let endpoint = isBingeReady ? '/api/shows/binge-ready' : '/api/shows/episodes-left';
      
      const params = new URLSearchParams();
      if (profileId) params.append('profileId', profileId);
      params.append('includeEnded', String(includeEnded));
      params.append('includeCanceled', String(includeCanceled));
      params.append('includeReturning', String(includeReturning));
      params.append('sortBy', sortBy);
      endpoint += `?${params.toString()}`;

      fetchWithProgress(endpoint, setLoadingMessage)
        .then((data) => {
          if (Array.isArray(data)) {
            if (isBingeReady) {
              setBingeReadyShows(data);
            } else {
              setEpisodesLeftShows(data);
            }
          }
        })
        .catch((err) => {
          console.error('Error fetching shows:', err);
          addToast('Failed to load shows. Please try again.', 'error');
        })
        .finally(() => {
          setLoadingShows(false);
        });
    }
  }, [activeList, status?.isConnected, includeEnded, includeCanceled, includeReturning, sortBy, profileId, bingeReadyShows, episodesLeftShows, fetchWithProgress, addToast]);

  // Background fetch for system lists counts on dashboard
  useEffect(() => {
    if (status?.isConnected && profileId && (view === 'lists' || view === 'home')) {
        const loadSystemLists = async () => {
            const params = new URLSearchParams();
            if (profileId) params.append('profileId', profileId);
            params.append('includeEnded', String(includeEnded));
            params.append('includeCanceled', String(includeCanceled));
            params.append('includeReturning', String(includeReturning));
            params.append('sortBy', sortBy);
            const queryString = params.toString();

            const filtersHash = JSON.stringify({ includeEnded, includeCanceled, includeReturning });

            // Load Binge Ready if empty and we haven't tried yet
            const bingeSortChanged = bingeSortRef.current !== sortBy;
            const bingeFiltersChanged = bingeFiltersRef.current !== filtersHash;

            if ((bingeReadyShows.length === 0 && !hasLoadedBinge) || bingeSortChanged || bingeFiltersChanged) {
                if (bingeSortChanged) bingeSortRef.current = sortBy;
                if (bingeFiltersChanged) bingeFiltersRef.current = filtersHash;
                try {
                    const data = await fetchWithProgress(`/api/shows/binge-ready?${queryString}`, () => {});
                    if (Array.isArray(data)) setBingeReadyShows(data);
                } catch (e) { console.error('Background fetch failed', e); }
                finally { setHasLoadedBinge(true); }
            }

            // Load Episodes Left if empty and we haven't tried yet
            const episodesSortChanged = episodesSortRef.current !== sortBy;
            const episodesFiltersChanged = episodesFiltersRef.current !== filtersHash;

            if ((episodesLeftShows.length === 0 && !hasLoadedEpisodes) || episodesSortChanged || episodesFiltersChanged) {
                if (episodesSortChanged) episodesSortRef.current = sortBy;
                if (episodesFiltersChanged) episodesFiltersRef.current = filtersHash;
                try {
                    const data = await fetchWithProgress(`/api/shows/episodes-left?${queryString}`, () => {});
                    if (Array.isArray(data)) setEpisodesLeftShows(data);
                } catch (e) { console.error('Background fetch failed', e); }
                finally { setHasLoadedEpisodes(true); }
            }
        };
        loadSystemLists();
    }
  }, [status?.isConnected, profileId, view, includeEnded, includeCanceled, includeReturning, sortBy, bingeReadyShows.length, episodesLeftShows.length, fetchWithProgress, hasLoadedBinge, hasLoadedEpisodes]);

  const saveLists = async (listsToSave?: DashboardList[]) => {
    if (!profileId) return;
    const lists = listsToSave || selectedLists;
    
    setSavingLists(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profileId, 
          selectedLists: lists
        }),
      });
      // addToast('Lists saved successfully!', 'success');
    } catch {
      addToast('Error saving lists.', 'error');
    } finally {
      setSavingLists(false);
    }
  };

  const toggleList = (list: TraktList) => {
    setSelectedLists(prev => {
      const exists = prev.find(l => l.id === list.ids.trakt.toString());
      let newLists: DashboardList[];
      if (exists) {
        newLists = prev.filter(l => l.id !== list.ids.trakt.toString());
      } else {
        newLists = [...prev, { 
            id: list.ids.trakt.toString(), 
            name: list.name, 
            type: 'trakt', 
            enabled: true,
            content_type: list.content_type
        }];
      }
      saveLists(newLists);
      return newLists;
    });
  };

  const syncAllLists = () => {
    const allTraktSelected = traktLists.length > 0 && traktLists.every(list => selectedLists.some(l => l.id === list.ids.trakt.toString()));
    
    let newLists;
    if (allTraktSelected) {
        // Unsync all Trakt lists, keep System lists
        newLists = selectedLists.filter(l => l.type === 'system');
    } else {
        // Sync all Trakt lists
        const existingIds = new Set(selectedLists.map(l => l.id));
        const listsToAdd = traktLists
            .filter(list => !existingIds.has(list.ids.trakt.toString()))
            .map(list => ({
                id: list.ids.trakt.toString(),
                name: list.name,
                type: 'trakt' as const,
                enabled: true,
                content_type: list.content_type
            }));
        newLists = [...selectedLists, ...listsToAdd];
    }
    setSelectedLists(newLists);
    saveLists(newLists);
  };

  const reorderLists = (newOrder: DashboardList[]) => {
    setSelectedLists(newOrder);
    saveLists(newOrder);
  };

  const toggleListVisibility = (listId: string) => {
    setSelectedLists(prev => {
      const newLists = prev.map(list => 
        list.id === listId ? { ...list, enabled: !list.enabled } : list
      );
      saveLists(newLists);
      return newLists;
    });
  };

  const selectList = async (list: DashboardList) => {
    if (activeList?.id !== list.id) {
        setListItems([]); // Clear previous items
    }
    setActiveList(list);
    setView('items');
    updateUrl('items', list.id);
  };

  // Effect to fetch Regular List Items
  useEffect(() => {
    if (view === 'items' && activeList && activeList.type !== 'system') {
        setLoadingShows(true);
        setLoadingMessage(`Fetching ${activeList.name}...`);
        
        let url = `/api/trakt/list-items?profileId=${profileId}&listId=${activeList.id}&sortBy=${sortBy}`;
        url += `&includeEnded=${includeEnded}&includeCanceled=${includeCanceled}&includeReturning=${includeReturning}`;
        
        if (activeList.owner) {
            url += `&username=${activeList.owner}`;
        }
        
        fetch(url)
           .then(res => {
               if (res.ok) return res.json();
               throw new Error('Failed to fetch');
           })
           .then(data => setListItems(data))
           .catch(e => {
               console.error(e);
               addToast('Failed to load list items', 'error');
           })
           .finally(() => setLoadingShows(false));
    }
  }, [view, activeList, sortBy, includeEnded, includeCanceled, includeReturning, profileId, addToast]);


  const importList = async (url: string) => {
    if (!profileId) return;
    setLoadingLists(true);
    try {
      const res = await fetch('/api/trakt/import-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, url }),
      });
      
      if (res.ok) {
        const listData = await res.json();
        // Add to selectedLists
        const newList = {
            id: listData.ids.trakt.toString(),
            name: listData.name,
            type: 'custom' as const,
            enabled: true,
            owner: listData.username,
            description: listData.description,
            item_count: listData.item_count,
            content_type: listData.content_type
        };
        
        // Check if already exists
        const exists = selectedLists.find(l => l.id === newList.id);
        if (exists) {
            addToast('List already added', 'info');
        } else {
            const newLists = [...selectedLists, newList];
            setSelectedLists(newLists);
            saveLists(newLists);
            addToast('List imported successfully', 'success');
        }
      } else {
        const err = await res.json();
        addToast(err.error || 'Failed to import list', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Error importing list', 'error');
    } finally {
      setLoadingLists(false);
    }
  };

  const createList = async (name: string, description: string, privacy: string) => {
    if (!profileId) return false;
    
    setLoadingLists(true);
    try {
        const res = await fetch('/api/trakt/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId, name, description, privacy })
        });
        
        if (res.ok) {
            const listData = await res.json();
            const newList = {
                id: listData.ids.slug, // Use slug for consistency
                name: listData.name,
                type: 'custom' as const,
                enabled: true,
                owner: 'me', 
                description: listData.description,
                item_count: 0
            };

            const newLists = [...selectedLists, newList];
            setSelectedLists(newLists);
            saveLists(newLists);
            addToast(`Created list: ${listData.name}`, 'success');
            return true;
        } else {
            addToast('Failed to create list', 'error');
            return false;
        }
    } catch (e) {
        console.error(e);
        addToast('Failed to create list', 'error');
        return false;
    } finally {
        setLoadingLists(false);
    }
  };

  const createAiList = async (prompt: string, type: 'movie' | 'show', size: number, privacy: string) => {
    if (!profileId) return false;

    setLoadingLists(true);
    try {
      const res = await fetch('/api/trakt/lists/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, prompt, type, size, privacy })
      });

      if (res.ok) {
        const data = await res.json();
        const listData = data.list;
        const newList = {
          id: listData.ids.slug,
          name: listData.name,
          type: 'ai' as const,
          enabled: true,
          owner: 'me',
          description: listData.description,
          item_count: data.itemCount ?? listData.item_count ?? 0,
          content_type: type === 'movie' ? 'movie' : 'series'
        };

        const newLists = [...selectedLists, newList];
        setSelectedLists(newLists);
        saveLists(newLists);
        addToast(`Created AI list: ${listData.name}`, 'success');
        return true;
      } else {
        const err = await res.json();
        addToast(err.error || 'Failed to create AI list', 'error');
        return false;
      }
    } catch (e) {
      console.error(e);
      addToast('Failed to create AI list', 'error');
      return false;
    } finally {
      setLoadingLists(false);
    }
  };

  const removeList = (listId: string) => {
    const list = selectedLists.find(l => l.id === listId);
    if (!list) return;

    setModalConfig({
        isOpen: true,
        title: 'Remove List?',
        message: `Are you sure you want to remove the list "${list.name}"? This will only remove it from Most, not Trakt.`,
        confirmText: 'Remove',
        confirmColor: 'red',
        onConfirm: () => {
            const newLists = selectedLists.filter(l => l.id !== listId);
            setSelectedLists(newLists);
            saveLists(newLists);
            closeModal();
            addToast('List removed successfully', 'success');
        }
    });
  };

  const renameList = (listId: string, newName: string) => {
    const newLists = selectedLists.map(l => {
      if (l.id === listId) {
        return { ...l, name: newName };
      }
      return l;
    });
    setSelectedLists(newLists);
    saveLists(newLists);
  };

  const updateList = (updatedList: DashboardList) => {
    const newLists = selectedLists.map(l => {
      if (l.id === updatedList.id) {
        return updatedList;
      }
      return l;
    });
    setSelectedLists(newLists);
    saveLists(newLists);
  };

  const generateCalendar = () => {
    if (calendarUrl) {
      setCalendarUrl('');
      return;
    }
    setStremioUrl(''); // Close other
    
    const baseUrl = window.location.origin;
    const url = profileId 
      ? `${baseUrl}/api/calendar/${profileId}`
      : `${baseUrl}/api/calendar`;
      
    setCalendarUrl(url);
  };

  const generateStremioLink = () => {
    if (stremioUrl) {
      setStremioUrl('');
      return;
    }
    setCalendarUrl(''); // Close other
    
    const baseUrl = window.location.origin;
    const url = profileId
      ? `${baseUrl}/stremio/${profileId}/manifest.json`
      : `${baseUrl}/stremio/manifest.json`;
      
    setStremioUrl(url);
  };

  const refreshShows = () => {
    if (timeRemaining > 0) {
      addToast(`Please wait ${formatTimeRemaining(timeRemaining)} before refreshing again.`, 'info');
      return;
    }

    setLoadingShows(true);
    setLoadingMessage('Refreshing library...');
    let endpoint = activeTab === 'binge_ready' ? '/api/shows/binge-ready' : '/api/shows/episodes-left';

    const params = new URLSearchParams();
    if (profileId) params.append('profileId', profileId);
    params.append('force', 'true');
    params.append('includeEnded', String(includeEnded));
    params.append('includeCanceled', String(includeCanceled));
    params.append('includeReturning', String(includeReturning));
    params.append('sortBy', sortBy);
    endpoint += `?${params.toString()}`;

    fetchWithProgress(endpoint, setLoadingMessage)
      .then((data) => {
        if (Array.isArray(data)) {
          if (activeTab === 'binge_ready') {
            setBingeReadyShows(data);
          } else {
            setEpisodesLeftShows(data);
          }
          
          // Update last refresh time
          const now = Date.now();
          setLastRefreshTime(now);
          if (profileId) {
            localStorage.setItem(`most_last_refresh_${profileId}`, now.toString());
          }
          
          // Re-fetch lists to get any type updates (e.g. from single type to mixed)
          // We do this silently after shows are refreshed
          fetch(`/api/settings?profileId=${profileId}`)
              .then(res => res.json())
              .then(data => {
                  if (data.selectedLists && data.selectedLists.length > 0) {
                      const hasSystemLists = data.selectedLists.some((l: DashboardList) => l.type === 'system');
                      if (!hasSystemLists) {
                        setSelectedLists([...SYSTEM_LISTS, ...data.selectedLists]);
                      } else {
                        setSelectedLists(data.selectedLists);
                      }
                  }
              })
              .catch(e => console.error('Failed to reload list config after refresh', e));

        }
      })
      .catch((err) => {
        console.error('Error refreshing shows:', err);
        addToast('Failed to refresh shows. Please try again.', 'error');
      })
      .finally(() => {
        setLoadingShows(false);
      });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const markAsWatched = (showId: string, seasonNumber: number | undefined, showTitle: string, isMovie: boolean = false) => {
    const message = isMovie 
      ? `Are you sure you want to mark ${showTitle} as watched?`
      : `Are you sure you want to mark ${showTitle} Season ${seasonNumber} as watched?`;

    setModalConfig({
      isOpen: true,
      title: isMovie ? 'Mark Movie as Watched?' : 'Mark Season as Watched?',
      message,
      confirmText: 'Mark Watched',
      confirmColor: 'green',
      onConfirm: () => {
        executeMarkAsWatched(showId, seasonNumber, isMovie);
        closeModal();
      }
    });
  };

  const executeMarkAsWatched = async (showId: string, seasonNumber: number | undefined, isMovie: boolean) => {
    // Start animation
    setRemovingIds(prev => [...prev, showId]);
    
    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Optimistic update
    setBingeReadyShows(prev => prev.filter(item => {
      const content = item.show;
      return content.ids.slug !== showId;
    }));
    setEpisodesLeftShows(prev => prev.filter(item => {
      const content = item.show;
      return content.ids.slug !== showId;
    }));
    setRemovingIds(prev => prev.filter(id => id !== showId));

    try {
      const res = await fetch('/api/shows/mark-watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId, seasonNumber, profileId, type: isMovie ? 'movie' : 'show' }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to mark as watched');
      }
      addToast('Marked as watched', 'success');
    } catch {
      addToast('Error marking as watched', 'error');
      refreshShows(); // Revert optimistic update by refreshing
    }
  };

  const removeFromHistory = (showId: string, showTitle: string, isMovie: boolean = false) => {
    setModalConfig({
      isOpen: true,
      title: 'Remove from History?',
      message: `Remove ${showTitle} from your history? This will delete all watched progress for this ${isMovie ? 'movie' : 'show'}.`,
      confirmText: isMovie ? 'Remove Movie' : 'Remove Show',
      confirmColor: 'red',
      onConfirm: () => {
        executeRemoveFromHistory(showId, isMovie);
        closeModal();
      }
    });
  };

  const saveAsDefault = async () => {
    setSavingDefaults(true);
    try {
      const settings = {
        profileId, // Pass profileId to save to specific profile
        FILTER_INCLUDE_ENDED: includeEnded.toString(),
        FILTER_INCLUDE_CANCELED: includeCanceled.toString(),
        FILTER_INCLUDE_RETURNING: includeReturning.toString(),
        FILTER_SORT_BY: sortBy,
        listId: currentListId
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Failed to save settings');
      
      addToast('Filters saved as default!', 'success');
    } catch (error) {
      console.error('Error saving defaults:', error);
      addToast('Failed to save default filters', 'error');
    } finally {
      setSavingDefaults(false);
    }
  };

  const resetFilters = () => {
    setIncludeEnded(true);
    setIncludeCanceled(true);
    setIncludeReturning(true);
    setSortBy('newest');
  };

  const executeRemoveFromHistory = async (showId: string, isMovie: boolean) => {
    // Start animation
    setRemovingIds(prev => [...prev, showId]);
    
    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Optimistic update
    setBingeReadyShows(prev => prev.filter(item => {
      const content = item.show;
      return content.ids.slug !== showId;
    }));
    setEpisodesLeftShows(prev => prev.filter(item => {
      const content = item.show;
      return content.ids.slug !== showId;
    }));
    setRemovingIds(prev => prev.filter(id => id !== showId));

    try {
      const res = await fetch('/api/shows/remove-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId, profileId, type: isMovie ? 'movie' : 'show' }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to remove from history');
      }
      addToast('Removed from history', 'success');
    } catch {
      addToast('Error removing from history', 'error');
      refreshShows(); // Revert optimistic update
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to disconnect your Trakt account?')) return;
    
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch {
      addToast('Failed to logout', 'error');
    }
  };

  const createProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateProfileError('');

    if (profilePassword !== confirmPassword) {
      setCreateProfileError('Passwords do not match');
      return;
    }

    // Password Strength Validation
    if (profilePassword.length < 8) {
      setCreateProfileError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(profilePassword)) {
      setCreateProfileError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(profilePassword)) {
      setCreateProfileError('Password must contain at least one number');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(profilePassword)) {
      setCreateProfileError('Password must contain at least one special character');
      return;
    }

    setCreatingProfile(true);
    try {
      const res = await fetch('/api/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            password: profilePassword,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to create profile');
      
      const data = await res.json();
      // Redirect to the new profile
      window.location.href = `/stremio/${data.id}/configure`;
    } catch {
      addToast('Error creating profile', 'error');
    } finally {
      setCreatingProfile(false);
    }
  };

  // Login State
  const [loginInput, setLoginInput] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInput.trim()) {
      window.location.href = `/stremio/${loginInput.trim()}/configure`;
    }
  };

  const isPasswordValid = 
    profilePassword.length >= 8 &&
    /[A-Z]/.test(profilePassword) &&
    /[0-9]/.test(profilePassword) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(profilePassword);


  const [listVersions, setListVersions] = useState<Record<string, number>>({});

  const refreshList = async (listId: string) => {
      // 1. Refresh active view if it matches
      if (activeList?.id === listId && view === 'items') {
          // Re-trigger selectList logic
          await selectList(activeList);
      }
      
      // 2. Signal HorizontalLists to refresh
      setListVersions(prev => ({ ...prev, [listId]: (prev[listId] || 0) + 1 }));
  };

  return {
    listVersions,
    refreshList,
    calendarUrl,
    stremioUrl,
    dateFormat,
    status,
    stats,
    bingeReadyShows,
    episodesLeftShows,
    activeTab,
    setActiveTab,
    toasts,
    addToast,
    removeToast,
    profileId,
    isPasswordModalOpen,
    passwordError,
    isAuthorized,
    profilePassword,
    setProfilePassword,
    confirmPassword,
    setConfirmPassword,
    createProfileError,
    creatingProfile,
    isPasswordValid,
    loginInput,
    setLoginInput,
    handleLogin,
    includeEnded,
    setIncludeEnded,
    includeCanceled,
    setIncludeCanceled,
    includeReturning,
    setIncludeReturning,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    showFilters,
    setShowFilters,
    savingDefaults,
    loadingShows,
    loadingMessage,
    removingIds,
    modalConfig,
    closeModal,
    handlePasswordSubmit,
    generateCalendar,
    generateStremioLink,
    refreshShows,
    markAsWatched,
    removeFromHistory,
    saveAsDefault,
    resetFilters,
    handleLogout,
    createProfile,
    apiStats,
    timeRemaining,
    formatTimeRemaining,
    traktLists,
    selectedLists,
    loadingLists,
    savingLists,
    fetchTraktLists,
    toggleList,
    syncAllLists,
    reorderLists,
    toggleListVisibility,
    saveLists,
    view,
    setView: (v: 'home' | 'lists' | 'items') => {
        setView(v);
        if (v === 'home') {
            const url = new URL(window.location.href);
            url.searchParams.delete('list');
            window.history.pushState({}, '', url.toString());
        }
    },
    activeList,
    selectList,
    listItems,
    importList,
    removeList,
    renameList,
    updateList,
    createList,
    createAiList,
    sortPreferences,
    hasLoadedBinge,
    hasLoadedEpisodes
  };
}
