'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import ConfirmationModal from '@/components/ConfirmationModal';
import PasswordModal from '@/components/PasswordModal';
import GlobalSearch, { SearchResult } from '@/components/GlobalSearch';
import ShowCard from '@/components/ShowCard';
import HorizontalList, { HorizontalListProps } from '@/components/HorizontalList';
import FilterBar from '@/components/FilterBar';
import ToastContainer from '@/components/Toast';
import InfoModal from '@/components/InfoModal';
import { useDashboard, DashboardList, TraktListItem } from '@/hooks/useDashboard';
import { useInView } from '@/hooks/useInView';
import { TraktShow, TraktMovie, TraktBingeReadyShow, TraktEpisodeLeftShow } from '@/lib/trakt';
import Image from 'next/image';

interface DashboardProps {
  profileId?: string;
  enableRegistration?: boolean;
}

interface SortableListProps extends Omit<HorizontalListProps, 'dragHandle' | 'list'> {
  list: DashboardList;
  listVersions?: Record<string, number>;
}

type DashboardItem = TraktBingeReadyShow | TraktEpisodeLeftShow | TraktListItem;


function SortableHorizontalListWrapper({ list, listVersions, currentSort, filters, ...props }: SortableListProps & { currentSort?: string; filters?: { includeEnded: boolean; includeCanceled: boolean; includeReturning: boolean } }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: list.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  };

  const DragHandle = (
    <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 p-1 rounded hover:bg-white/5 transition-colors"
    >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
    </div>
  );

  const isWatchlist = list.id === 'watchlist';
  const contentType = isWatchlist ? 'mixed' : (list.content_type || 'mixed');
  const shouldSplit = contentType === 'mixed' && (list.type !== 'system' || isWatchlist);

  if (shouldSplit) {
    return (
        <div ref={setNodeRef} style={style} className="flex flex-col">
        {isWatchlist ? (
          <>
            <HorizontalList 
              list={{...list, content_type: 'movie'}}
              type="movie"
              dragHandle={DragHandle}
              version={listVersions?.[list.id] || 0}
              sortBy={currentSort}
              filters={filters}
              {...props} 
            />
            <HorizontalList 
              list={{...list, content_type: 'series'}}
              type="show"
              dragHandle={DragHandle} 
              version={listVersions?.[list.id] || 0}
              sortBy={currentSort}
              filters={filters}
              {...props} 
            />
          </>
        ) : (
          <>
            <HorizontalList 
              list={{...list, content_type: 'series'}}
              type="show"
              dragHandle={DragHandle} 
              version={listVersions?.[list.id] || 0}
              sortBy={currentSort}
              filters={filters}
              {...props} 
            />
            <HorizontalList 
              list={{...list, content_type: 'movie'}}
              type="movie"
              dragHandle={DragHandle}
              version={listVersions?.[list.id] || 0}
              sortBy={currentSort}
              filters={filters}
              {...props} 
            />
          </>
        )}
        </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
        <HorizontalList 
            list={list} 
            dragHandle={DragHandle} 
            version={listVersions?.[list.id] || 0}
            sortBy={currentSort}
            filters={filters}
            {...props} 
        />
    </div>
  )
}



export default function Dashboard({ profileId: propProfileId, enableRegistration = true }: DashboardProps) {
  const {
    calendarUrl,
    stremioUrl,
    status,
    stats,
    bingeReadyShows,
    episodesLeftShows,
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
    refreshShows,
    markAsWatched,
    removeFromHistory,
    saveAsDefault,
    resetFilters,
    handleLogout,
    createProfile,
    isPasswordValid,
    loginInput,
    setLoginInput,
    handleLogin,
    timeRemaining,
    formatTimeRemaining,
    selectedLists,
    loadingLists,
    reorderLists,
    toggleListVisibility,
    view,
    setView,
    activeList,
    selectList,
    listItems,
    importList,
    removeList,
    updateList,
    refreshList,
    createList,

    listVersions,
    sortPreferences,
    hasLoadedBinge,
    hasLoadedEpisodes
  } = useDashboard({ profileId: propProfileId });

  const activeFilters = useMemo(() => ({
    includeEnded,
    includeCanceled,
    includeReturning
  }), [includeEnded, includeCanceled, includeReturning]);

  // Background Image Logic
  const [bgImage, setBgImage] = useState<string | null>(null);

  // Search Logic
  const [searchMovies, setSearchMovies] = useState<SearchResult[]>([]);
  const [searchShows, setSearchShows] = useState<SearchResult[]>([]);
  const [isSearchingTrakt, setIsSearchingTrakt] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
        if (searchQuery.trim().length > 2) {
            setIsSearchingTrakt(true);
            try {
                const res = await fetch(`/api/trakt/search?query=${encodeURIComponent(searchQuery)}&profileId=${profileId || ''}`);
                const data = await res.json();
                const results: SearchResult[] = data.results || [];
                
                setSearchMovies(results.filter(r => r.type === 'movie'));
                setSearchShows(results.filter(r => r.type === 'show'));
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearchingTrakt(false);
            }
        } else {
            setSearchMovies([]);
            setSearchShows([]);
        }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, profileId]);


  const [importUrl, setImportUrl] = useState('');
  
  // Create List Logic
  const [addListTab, setAddListTab] = useState<'import' | 'create'>('import');
  const [createListForm, setCreateListForm] = useState({ name: '', description: '', privacy: 'private' });

  // Renaming Logic


  // Placeholder Logic
  const [editingPlaceholderListId, setEditingPlaceholderListId] = useState<string | null>(null);
  const [placeholderForm, setPlaceholderForm] = useState({
    title: '',
    poster: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddListModalOpen, setIsAddListModalOpen] = useState(false);
  const [showHiddenLists, setShowHiddenLists] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  // Lazy Load State
  const [visibleCount, setVisibleCount] = useState(48);
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({ triggerOnce: false, rootMargin: '400px' });
  
  // Home Lists Lazy Load
  const [visibleListsCount, setVisibleListsCount] = useState(5);
  const { ref: loadMoreListsRef, inView: loadMoreListsInView } = useInView({ triggerOnce: false, rootMargin: '200px' });
  
  const [infoModal, setInfoModal] = useState<{
      isOpen: boolean;
      itemId?: string;
      itemType?: 'movie' | 'show';
      item?: TraktShow | TraktMovie;
      posterUrl?: string | null;
  }>({ isOpen: false });

  const visibleLists = useMemo(() => {
    return showHiddenLists ? selectedLists : selectedLists.filter(l => l.enabled !== false);
  }, [showHiddenLists, selectedLists]);

  // Scroll Restoration Logic
  const homeScrollY = useRef(0);
  
  useEffect(() => {
      if (view === 'home') {
          // Restore scroll
          window.scrollTo({ top: homeScrollY.current, behavior: 'auto' });
      } else {
          // New view, scroll to top
          window.scrollTo({ top: 0, behavior: 'auto' });
      }
  }, [view]);

  useEffect(() => {
    setVisibleCount(48);
  }, [activeList?.id, view]);

  useEffect(() => {
    if (loadMoreInView) {
      setVisibleCount(prev => prev + 24);
    }
  }, [loadMoreInView, visibleCount]);

  // Removed automatic reset of visibleListsCount to preserve scroll position
  // useEffect(() => {
  //     if (view === 'home') {
  //         setVisibleListsCount(5);
  //     }
  // }, [view]);

  useEffect(() => {
      if (loadMoreListsInView && view === 'home') {
          setVisibleListsCount(prev => prev + 3);
      }
  }, [loadMoreListsInView, view, visibleListsCount]); // Added visibleListsCount to dependency for infinite loop if still in view

  const openPlaceholderModal = (listId: string) => {
    const list = selectedLists.find(l => l.id === listId);
    if (!list) return;

    setEditingPlaceholderListId(listId);
    setPlaceholderForm({
      title: list.placeholder?.title || list.name,
      poster: list.placeholder?.poster || ''
    });
  };

  const savePlaceholder = async () => {
    if (!editingPlaceholderListId) return;
    
    const list = selectedLists.find(l => l.id === editingPlaceholderListId);
    if (list) {
        updateList({
            ...list,
            placeholder: {
                enabled: true,
                title: placeholderForm.title,
                poster: placeholderForm.poster
            }
        });
    }

    setEditingPlaceholderListId(null);
  };
  
  const removePlaceholder = async () => {
    if (!editingPlaceholderListId) return;
    
    const list = selectedLists.find(l => l.id === editingPlaceholderListId);
    if (list) {
        // Cleanup uploaded image if exists
        if (list.placeholder?.poster?.includes('/api/image/upload/')) {
            try {
                const parts = list.placeholder.poster.split('/');
                const filename = parts[parts.length - 1];
                await fetch(`/api/image/upload/${filename}`, { method: 'DELETE' });
            } catch (e) {
                console.error('Failed to delete image file', e);
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { placeholder, ...rest } = list;
        updateList({
            ...rest,
            placeholder: { enabled: false }
        });
    }

    setEditingPlaceholderListId(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        setPlaceholderForm(prev => ({ ...prev, poster: data.url }));
      } else {
        // Fallback to error handling logic if needed
        console.error('Upload failed');
      }
    } catch (err) {
      console.error('Upload error', err);
    } finally {
      setUploadingImage(false);
    }
  };



  const handleItemClick = (item: { show?: TraktShow; movie?: TraktMovie }, posterUrl?: string | null) => {
      const content = item.show || item.movie;
      if (!content) return;
      setInfoModal({
          isOpen: true,
          itemId: content.ids.slug, // Use slug for API
          itemType: item.movie ? 'movie' : (item.show ? 'show' : undefined), // normalize type
          item: content,
          posterUrl
      });
  };



  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedLists.findIndex((item) => item.id === active.id);
      const newIndex = selectedLists.findIndex((item) => item.id === over.id);
      
      reorderLists(arrayMove(selectedLists, oldIndex, newIndex));
    }
  };


  
  const fanarts = useMemo(() => {
    if (!profileId) return [] as string[];

    return [...bingeReadyShows, ...episodesLeftShows]
      .map(item => {
        const images = item.show?.images;
        let url: string | null = null;

        // Handle different Trakt image formats (array or object)
        if (images?.fanart) {
          if (Array.isArray(images.fanart) && images.fanart.length > 0) {
            url = images.fanart[0];
          } else if (!Array.isArray(images.fanart) && 'full' in images.fanart) {
            url = images.fanart.full;
          }
        }

        // Ensure URL has protocol
        if (url && !url.startsWith('http')) {
          return `https://${url}`;
        }
        return url;
      })
      .filter((url): url is string => Boolean(url));
  }, [bingeReadyShows, episodesLeftShows, profileId]);

  useEffect(() => {
    if (!profileId || fanarts.length === 0) return;

    if (!bgImage) {
      setBgImage(fanarts[Math.floor(Math.random() * fanarts.length)]);
    }

    const interval = setInterval(() => {
      const randomImage = fanarts[Math.floor(Math.random() * fanarts.length)];
      setBgImage(randomImage);
    }, 15000);

    return () => clearInterval(interval);
  }, [profileId, fanarts]);

  if (!profileId && !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <main className="max-w-md w-full text-center space-y-6 md:space-y-8">
          <h1 className="text-lg md:text-2xl font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 font-[family-name:var(--font-goldman)]">
            MOST
          </h1>
          
          <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-2xl">
            {enableRegistration ? (
              <>
                <p className="text-gray-300 mb-6">
                  Create a profile to start tracking your shows.
                </p>
                
                <form onSubmit={createProfile} className="space-y-4 max-w-sm mx-auto">
                  <div className="space-y-3">
                    <input
                      type="password"
                      value={profilePassword}
                      onChange={(e) => setProfilePassword(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none text-center"
                      placeholder="Set a Profile Password"
                      required
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none text-center"
                      placeholder="Confirm Password"
                      required
                    />
                    <div className="text-xs text-left space-y-1 px-2">
                      {[
                        { valid: profilePassword.length >= 8, text: "At least 8 characters" },
                        { valid: /[A-Z]/.test(profilePassword), text: "One uppercase letter" },
                        { valid: /[0-9]/.test(profilePassword), text: "One number" },
                        { valid: /[!@#$%^&*(),.?":{}|<>]/.test(profilePassword), text: "One special character" }
                      ].map((req, i) => (
                        <div key={i} className={`flex items-center gap-2 transition-colors ${req.valid ? "text-green-400" : "text-gray-500"}`}>
                          {req.valid ? (
                            <svg className="shrink-0" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          ) : (
                            <svg className="shrink-0 text-red-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          )}
                          <span>{req.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {createProfileError && (
                    <p className="text-red-400 text-sm font-medium">{createProfileError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={creatingProfile || !isPasswordValid || profilePassword !== confirmPassword}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingProfile ? 'Creating Profile...' : 'Create Profile & Start'}
                  </button>
                </form>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-800 text-gray-400">OR</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-300 mb-6">
                Please log in with your Profile UUID.
              </p>
            )}

            <form onSubmit={handleLogin} className="space-y-4 max-w-sm mx-auto">
              <div className="space-y-2">
                {enableRegistration && (
                  <label className="text-sm text-gray-400 font-medium">Already have a profile?</label>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                    placeholder="Enter Profile UUID"
                    required
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors"
                  >
                    Login
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={"min-h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden " + (status?.isConnected ? "" : "items-center justify-center p-4")}>
      {/* Background Image */}
      {bgImage && (
        <>
          <div 
            className="fixed inset-0 z-0 transition-all duration-1000 ease-in-out opacity-20 pointer-events-none"
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="fixed inset-0 z-0 bg-gradient-to-b from-gray-900/50 via-gray-900/80 to-gray-900 pointer-events-none"></div>
        </>
      )}

      <main className={"w-full relative z-10 " + (status?.isConnected ? "" : "max-w-2xl text-center space-y-4")}>
        {!status?.isConnected && (
            <h1 className="text-lg md:text-2xl font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 font-[family-name:var(--font-goldman)]">
            MOST
            </h1>
        )}

        {!status?.isConnected && status?.hasCredentials && profileId && (
          <div className="w-full max-w-2xl mx-auto rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3">
            <span>Your Trakt session needs re-authentication.</span>
            <a
              href={`/api/auth/login?profileId=${profileId}`}
              className="px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/40 text-yellow-100 text-xs font-bold transition-colors"
            >
              Re-authenticate
            </a>
          </div>
        )}

        <div className={status?.isConnected ? "" : "bg-gray-800 p-4 md:p-8 rounded-xl shadow-2xl border border-gray-700"}>
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              {!status?.isConnected ? (
                <>
                  <a
                    href={status?.hasCredentials ? `/api/auth/login${profileId ? `?profileId=${profileId}` : ''}` : "#"}
                    className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 ${
                      status?.hasCredentials
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={(e) => !status?.hasCredentials && e.preventDefault()}
                  >
                    {status?.hasCredentials ? 'Connect Trakt Account' : 'Configure API Keys First'}
                  </a>
                  {status?.hasCredentials && profileId && (
                    <a
                      href={`/api/auth/login?profileId=${profileId}`}
                      className="w-full py-3 px-6 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 bg-gray-900/60 hover:bg-gray-900 text-gray-300 hover:text-white border border-gray-700"
                    >
                      Re-authorize Trakt
                    </a>
                  )}
                  <a 
                    href={profileId ? `/stremio/${profileId}/settings` : "#"} 
                    className="text-sm text-gray-400 hover:text-white underline decoration-gray-600 underline-offset-4 transition-colors"
                  >
                    Configure API Keys & Settings
                  </a>
                </>
              ) : (
                <>
                </>
              )}
            </div>

            {status?.isConnected && (
              <div className="text-left w-full h-full flex flex-col">
                 <header className="flex items-center justify-between px-6 py-4 sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        </button>
                         <h1 className="text-xl md:text-2xl font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 font-[family-name:var(--font-goldman)] tracking-tighter">
                            MOST
                        </h1>
                        {profileId && (
                            <div className="hidden md:flex items-center gap-2 px-2 py-1 bg-white/5 rounded-md border border-white/5 ml-2">
                                <span className="text-[10px] text-gray-400 font-mono tracking-wider font-bold">
                                    USER ID: <span className="xl:hidden">{profileId.substring(0, 8)}...</span><span className="hidden xl:inline">{profileId}</span>
                                </span>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(profileId);
                                        addToast('Profile ID copied!', 'success');
                                    }}
                                    className="text-gray-500 hover:text-purple-400 transition-colors"
                                    title="Copy Profile ID"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                </button>
                            </div>
                        )}
                    </div>

                    {stremioUrl && (
                        <div className="hidden xl:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 bg-gray-900 rounded-lg p-1 border border-white/5 z-20">
                            <a
                                href={stremioUrl.replace(/^https?:\/\//, 'stremio://')}
                                className="px-3 py-1.5 rounded-md text-xs font-bold bg-[#1155d9]/10 hover:bg-[#1155d9]/20 text-blue-200/80 hover:text-blue-100 transition-colors flex items-center gap-1.5"
                                title="Open in Stremio Desktop"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                App
                            </a>
                            <a
                                href={`https://web.stremio.com/#/addons?addon=${encodeURIComponent(stremioUrl)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-md text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
                                title="Open in Stremio Web"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                Web
                            </a>
                            
                            <div className="w-px h-4 bg-white/10 mx-1"></div>

                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(stremioUrl);
                                    addToast('Stremio URL copied!', 'success');
                                }}
                                className="px-3 py-1.5 rounded-md text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
                                title="Copy URL"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                Copy URL
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-4 z-20">
                         
                         <div className="flex bg-gray-900 rounded-lg p-1 border border-white/5 hidden md:flex">
                              <button
                                onClick={() => setCompactMode(false)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!compactMode ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                              >
                                Preview
                              </button>
                              <button
                                onClick={() => setCompactMode(true)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${compactMode ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                              >
                                Compact
                              </button>
                         </div>

                         <div className="flex bg-gray-900 rounded-lg p-1 border border-white/5 hidden md:flex">
                              <button
                                onClick={() => setShowHiddenLists(false)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!showHiddenLists ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                              >
                                Active
                              </button>
                              <button
                                onClick={() => setShowHiddenLists(true)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${showHiddenLists ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                              >
                                All
                              </button>
                         </div>

                         <div className="flex items-center gap-3">
                            <div className="text-right hidden md:block">
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Connected as</div>
                                <div className="text-sm font-bold text-white leading-none">{stats?.username || 'User'}</div>
                            </div>
                            <div className="relative w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-900/20 ring-2 ring-purple-400/20 overflow-hidden">
                                {stats?.avatar ? (
                                    <Image src={stats.avatar} alt={stats.username || 'Avatar'} fill className="object-cover" unoptimized />
                                ) : (
                                    stats?.username?.charAt(0).toUpperCase() || 'U'
                                )}
                            </div>
                         </div>
                    </div>
                 </header>

                {/* Sidebar Overlay */}
                <div 
                    className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={() => setIsSidebarOpen(false)}
                />

                {/* Sidebar Drawer */}
                <div 
                    className={`fixed top-0 left-0 bottom-0 w-[20rem] bg-gray-900 z-[70] shadow-2xl transition-transform duration-300 ease-in-out border-r border-white/5 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                >
                    {/* Header */}
                    <div className="p-6 flex items-center justify-between border-b border-white/5">
                        <h2 className="text-2xl font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 font-[family-name:var(--font-goldman)] tracking-tighter">
                            MOST
                        </h2>
                        <button 
                            onClick={() => setIsSidebarOpen(false)}
                            className="p-2 -mr-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        
                        {/* Navigation */}
                        <nav className="space-y-1">
                            <button 
                                onClick={() => { setView('home'); setIsSidebarOpen(false); }}
                                className={`w-full px-4 py-3 rounded-xl text-md font-bold transition-all flex items-center gap-3 ${
                                    view === 'home' 
                                        ? 'bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/50' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                                Home
                            </button>
                            <a 
                                href={profileId ? `/stremio/${profileId}/settings` : "#"} 
                                className="w-full px-4 py-3 rounded-xl text-md font-bold transition-all flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                Settings
                            </a>
                        </nav>

                        <div className="border-t border-white/5" />

                        {/* Integration Widgets (Stremio & Calendar) */}
                        <div className="space-y-4">
                             <div className="flex items-center gap-2 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                Links
                            </div>
                            
                            {stremioUrl && (
                                <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-gray-300">Stremio Addon</span>
                                        <div className="flex gap-1">
                                             <a
                                                href={stremioUrl.replace(/^https?:\/\//, 'stremio://')}
                                                className="p-1.5 bg-[#1155d9]/10 hover:bg-[#1155d9]/20 text-blue-200/80 hover:text-blue-100 rounded-md transition-colors"
                                                title="Open in Desktop App"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                            </a>
                                            <a
                                                href={`https://web.stremio.com/#/addons?addon=${encodeURIComponent(stremioUrl)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-md transition-colors"
                                                title="Open in Web"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                            </a>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(stremioUrl);
                                            addToast('Stremio URL copied!', 'success');
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 bg-black/40 hover:bg-black/60 rounded-lg text-xs font-mono text-gray-400 hover:text-white transition-colors border border-white/5 hover:border-white/10 truncate group"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50 group-hover:opacity-100"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                        <span className="truncate flex-1 text-left">{stremioUrl}</span>
                                    </button>
                                </div>
                            )}

                             {calendarUrl && (
                                <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-gray-300">Calendar Feed</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(calendarUrl);
                                            addToast('Calendar URL copied!', 'success');
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 bg-black/40 hover:bg-black/60 rounded-lg text-xs font-mono text-gray-400 hover:text-white transition-colors border border-white/5 hover:border-white/10 truncate group"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50 group-hover:opacity-100"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                        <span className="truncate flex-1 text-left">{calendarUrl}</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-white/5" />

                        {/* Community */}
                        <div className="space-y-2">
                             <div className="flex items-center gap-2 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                Community
                            </div>
                            
                            <a 
                                href="https://github.com/gordlaben/MOST" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                                Star on GitHub
                            </a>
                             <a 
                                href="https://discord.gg/J5MSkJk7C6" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-[#5865F2]/20 hover:text-[#5865F2] transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                                Join Community
                            </a>
                        </div>
                    </div>


                    {/* Footer - Sticky */}
                    <div className="p-4 border-t border-white/5 bg-[#151515]">
                         <div className="flex items-center gap-3 mb-4 px-2">
                             <div className="relative w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-900/20 ring-2 ring-purple-400/20 overflow-hidden shrink-0">
                                {stats?.avatar ? (
                                    <Image src={stats.avatar} alt={stats.username || 'Avatar'} fill className="object-cover" unoptimized />
                                ) : (
                                    stats?.username?.charAt(0).toUpperCase() || 'U'
                                )}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Connected as</span>
                                <span className="font-bold text-white text-sm truncate">{stats?.username || 'User'}</span>
                            </div>
                         </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => window.location.href = `/api/auth/login?profileId=${profileId}${profileId ? '&force=true' : ''}`}
                                className="px-3 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5 hover:border-white/10"
                            >
                            Re-authorize Trakt
                            </button>
                            <button 
                                onClick={handleLogout}
                                className="px-3 py-2 rounded-lg text-xs font-bold text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-red-500/10 hover:border-red-500/20"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>

                {view === 'home' && (
                  <>
                    <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                    <SortableContext
                        items={(showHiddenLists ? selectedLists : selectedLists.filter(l => l.enabled !== false)).map(l => l.id)}
                        strategy={verticalListSortingStrategy}
                    >
                    <div className={`${compactMode ? 'space-y-1' : 'space-y-8'} pb-20 pt-8`}>
                        {/* Mobile Switches */}
                        <div className="px-4 md:hidden flex justify-between gap-4 mb-6">
                            <div className="flex bg-gray-900 rounded-lg p-1 border border-white/5 flex-1 justify-center">
                                <button
                                    onClick={() => setCompactMode(false)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex-1 ${!compactMode ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Preview
                                </button>
                                <button
                                    onClick={() => setCompactMode(true)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex-1 ${compactMode ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Compact
                                </button>
                            </div>

                            <div className="flex bg-gray-900 rounded-lg p-1 border border-white/5 flex-1 justify-center">
                                <button
                                    onClick={() => setShowHiddenLists(false)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex-1 ${!showHiddenLists ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Active
                                </button>
                                <button
                                    onClick={() => setShowHiddenLists(true)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex-1 ${showHiddenLists ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                                >
                                    All
                                </button>
                            </div>
                        </div>

                        {/* Global Search Bar */}
                        <div className={`px-4 md:px-12 ${compactMode ? 'mb-4' : 'mb-8'}`}>
                             <GlobalSearch 
                                profileId={profileId} 
                                query={searchQuery}
                                onQueryChange={setSearchQuery}
                                isSearching={isSearchingTrakt}
                             />
                        </div>

                        {/* Search Results */}
                        {(searchMovies.length > 0 || searchShows.length > 0) && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 mb-12 relative z-50">
                                {searchMovies.length > 0 && (
                                     <HorizontalList 
                                        list={{ id: 'search-movies', name: 'Search Results: Movies', type: 'system', enabled: true, item_count: searchMovies.length }}
                                        listItems={searchMovies.map((m, i) => ({
                                            rank: i,
                                            id: m.movie?.ids.trakt || 0,
                                            type: 'movie',
                                            movie: m.movie,
                                            listed_at: new Date().toISOString()
                                        })) as TraktListItem[]}
                                        profileId={profileId || undefined}
                                        onMarkWatched={markAsWatched}
                                        onRemoveHistory={removeFromHistory}
                                        onSelectList={() => {}} 
                                        compactMode={compactMode}
                                        onItemClick={(item, posterUrl) => handleItemClick(item as unknown as TraktListItem, posterUrl)}
                                     />
                                )}
                                {searchShows.length > 0 && (
                                     <HorizontalList 
                                        list={{ id: 'search-shows', name: 'Search Results: TV Shows', type: 'system', enabled: true, item_count: searchShows.length }}
                                        listItems={searchShows.map((s, i) => ({
                                            rank: i,
                                            id: s.show?.ids.trakt || 0,
                                            type: 'show',
                                            show: s.show,
                                            listed_at: new Date().toISOString()
                                        })) as TraktListItem[]}
                                        profileId={profileId || undefined}
                                        onMarkWatched={markAsWatched}
                                        onRemoveHistory={removeFromHistory}
                                        onSelectList={() => {}} 
                                        compactMode={compactMode}
                                        onItemClick={(item, posterUrl) => handleItemClick(item as unknown as TraktListItem, posterUrl)}
                                     />
                                )}
                            </div>
                        )}
                        
                        <div className={`transition-opacity duration-300 ${searchQuery.trim().length > 2 ? 'opacity-10 pointer-events-none grayscale' : ''}`}>
                             {(() => {
                                 return (
                             <>
                               {visibleLists.slice(0, visibleListsCount).map(list => {
                                    let preloadedItems = null;
                                    if (list.id === 'binge_ready') preloadedItems = bingeReadyShows;
                                    if (list.id === 'episodes_left') preloadedItems = episodesLeftShows;
                                  const listLoading = list.id === 'binge_ready'
                                    ? !hasLoadedBinge
                                    : list.id === 'episodes_left'
                                    ? !hasLoadedEpisodes
                                    : undefined;

                                    return (
                                        <SortableHorizontalListWrapper 
                                            key={list.id}
                                            list={list}
                                            listItems={preloadedItems ?? undefined}
                                      listLoading={listLoading}
                                            profileId={profileId || undefined}
                                            rpdbKey={status?.rpdbKey}
                                            onMarkWatched={markAsWatched}
                                            onRemoveHistory={removeFromHistory}
                                            onSelectList={(list) => {
                                                homeScrollY.current = window.scrollY;
                                                selectList(list);
                                            }}
                                            onToggleVisibility={toggleListVisibility}
                                            onRemoveList={removeList}
                                            compactMode={compactMode}
                                            onItemClick={handleItemClick}
                                            listVersions={listVersions}
                                            currentSort={sortPreferences?.[list.id] || 'newest'}
                                            filters={activeFilters}
                                        />
                                    );
                                })}

                                {visibleListsCount < visibleLists.length && (
                                    <div ref={loadMoreListsRef} className="py-8 flex justify-center w-full">
                                        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                             </>
                           );
                        })()}
                        </div>


                        {/* Manage Lists Footer */}
                        {selectedLists.length > 0 && (
                            <div className={`flex justify-center gap-4 pb-8 sticky z-30 transition-all ${compactMode ? 'mt-8' : 'mt-0'}`}>
                                <button 
                                    onClick={() => {
                                        setAddListTab('create');
                                        setIsAddListModalOpen(true);
                                    }}
                                    className="px-6 py-2 bg-gray-900/80 hover:bg-purple-900/80 backdrop-blur-md text-gray-400 hover:text-purple-300 rounded-full text-sm font-bold border border-gray-700 hover:border-purple-500/50 transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                    Create List
                                </button>
                                <button 
                                    onClick={() => {
                                        setAddListTab('import');
                                        setIsAddListModalOpen(true);
                                    }}
                                    className="px-6 py-2 bg-gray-900/80 hover:bg-purple-900/80 backdrop-blur-md text-gray-400 hover:text-purple-300 rounded-full text-sm font-bold border border-gray-700 hover:border-purple-500/50 transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Add Trakt List
                                </button>
                            </div>
                        )}
                        
                        {/* Loading State for initial load if needed or empty state */}
                        {loadingLists && selectedLists.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-gray-400">Loading your lists...</p>
                            </div>
                        )}
                        
                        {!loadingLists && selectedLists.filter(l => l.enabled !== false).length === 0 && (
                             <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No lists visible</h3>
                                <p className="text-gray-400 max-w-md mb-6">Looks like you haven&apos;t configured any lists yet, or they are all hidden.</p>
                                <button 
                                    onClick={() => setView('lists')}
                                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold"
                                >
                                    Configure Lists
                                </button>
                            </div>
                        )}
                    </div>
                    </SortableContext>
                    </DndContext>

                    {/* Floating Add Button */}
                    <button
                        onClick={() => setIsAddListModalOpen(true)}
                        className="fixed bottom-8 right-8 w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-2xl shadow-purple-900/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-40 group border border-purple-500/50"
                        title="Add Custom List"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>

                    {/* Add List Modal */}
                    {isAddListModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xl font-bold text-white">Manage Lists</h3>
                                    <button onClick={() => setIsAddListModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>

                                <div className="flex border-b border-gray-700 mb-6">
                                    <button 
                                        onClick={() => setAddListTab('import')} 
                                        className={`pb-2 px-4 font-bold transition-colors border-b-2 text-sm ${addListTab === 'import' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                                    >
                                        Import Existing
                                    </button>
                                    <button 
                                        onClick={() => setAddListTab('create')} 
                                        className={`pb-2 px-4 font-bold transition-colors border-b-2 text-sm ${addListTab === 'create' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                                    >
                                        Create New
                                    </button>
                                </div>
                                
                                {addListTab === 'import' ? (
                                    <>
                                        <p className="text-gray-400 text-sm mb-4">
                                            Paste the full URL of a public Trakt list to import it.
                                        </p>

                                        <div className="space-y-6">
                                            <input 
                                                type="text" 
                                                value={importUrl}
                                                onChange={(e) => setImportUrl(e.target.value)}
                                                placeholder="https://trakt.tv/users/username/lists/list-name"
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && importUrl) {
                                                        importList(importUrl);
                                                        setImportUrl('');
                                                        setIsAddListModalOpen(false);
                                                    }
                                                }}
                                            />
                                            
                                            <div className="flex gap-3 justify-end">
                                                <button 
                                                    onClick={() => setIsAddListModalOpen(false)}
                                                    className="px-4 py-2 text-gray-400 hover:text-white font-bold transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (importUrl) {
                                                            importList(importUrl);
                                                            setImportUrl('');
                                                            setIsAddListModalOpen(false);
                                                        }
                                                    }}
                                                    disabled={loadingLists || !importUrl}
                                                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
                                                >
                                                    {loadingLists ? 'Importing...' : 'Import List'}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">List Name</label>
                                            <input 
                                                type="text" 
                                                value={createListForm.name}
                                                onChange={(e) => setCreateListForm(prev => ({ ...prev, name: e.target.value }))}
                                                placeholder="My Awesome List"
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Description</label>
                                            <textarea 
                                                value={createListForm.description}
                                                onChange={(e) => setCreateListForm(prev => ({ ...prev, description: e.target.value }))}
                                                placeholder="Optional description..."
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none h-20"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Privacy</label>
                                            <select 
                                                value={createListForm.privacy}
                                                onChange={(e) => setCreateListForm(prev => ({ ...prev, privacy: e.target.value }))}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            >
                                                <option value="private">Private</option>
                                                <option value="friends">Friends Only</option>
                                                <option value="public">Public</option>
                                            </select>
                                        </div>

                                        <div className="flex gap-3 justify-end pt-2">
                                            <button 
                                                onClick={() => setIsAddListModalOpen(false)}
                                                className="px-4 py-2 text-gray-400 hover:text-white font-bold transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                onClick={async () => {
                                                    if (createListForm.name) {
                                                        const success = await createList(createListForm.name, createListForm.description, createListForm.privacy);
                                                        if (success) {
                                                            setCreateListForm({ name: '', description: '', privacy: 'private' });
                                                            setIsAddListModalOpen(false);
                                                            setAddListTab('import'); // Reset to default
                                                        }
                                                    }
                                                }}
                                                disabled={loadingLists || !createListForm.name}
                                                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
                                            >
                                                {loadingLists ? 'Creating...' : 'Create List'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                  </>
                )}

                {view === 'items' && (
                  // ITEMS VIEW
                  <div className="animate-in fade-in slide-in-from-right-4 p-4 md:p-8 w-full mx-auto">
                    <div className="flex flex-row justify-between items-center gap-4 mb-6">
                      <div className="flex items-center gap-4 w-auto min-w-0">
                        <button 
                          onClick={() => setView('home')}
                          className="p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors shrink-0"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        </button>
                        <h2 className="text-xl font-bold text-white truncate">{activeList?.name}</h2>
                      </div>
                      
                      <div className="flex gap-2 w-auto justify-end items-center shrink-0">
                        <button
                          onClick={() => setShowFilters(!showFilters)}
                          className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2 ${
                            showFilters 
                              ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20' 
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white hover:border-gray-600'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                          <span className="text-sm font-medium hidden md:inline">Filter & Sort</span>
                        </button>
                        
                        {activeList?.type === 'system' && (
                            <button 
                              onClick={refreshShows}
                              disabled={loadingShows || timeRemaining > 0}
                              className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2 ${
                                loadingShows || timeRemaining > 0
                                  ? 'bg-gray-800/50 border-gray-700/50 text-gray-500 cursor-not-allowed'
                                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white hover:border-gray-600'
                              }`}
                            >
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="20" 
                                height="20" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className={loadingShows ? 'animate-spin' : ''}
                              >
                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                <path d="M3 3v5h5"></path>
                                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                                <path d="M16 21h5v-5"></path>
                              </svg>
                              <span className="text-sm font-medium hidden md:inline">
                                {loadingShows ? 'Refreshing...' : timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : 'Refresh'}
                              </span>
                            </button>
                        )}
                      </div>
                    </div>

                    {/* Filters Component */}
                    <FilterBar 
                        showFilters={showFilters}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        includeEnded={includeEnded}
                        setIncludeEnded={setIncludeEnded}
                        includeCanceled={includeCanceled}
                        setIncludeCanceled={setIncludeCanceled}
                        includeReturning={includeReturning}
                        setIncludeReturning={setIncludeReturning}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        saveAsDefault={saveAsDefault}
                        resetFilters={resetFilters}
                        savingDefaults={savingDefaults}
                        isSeriesList={activeList?.content_type !== 'movie'}
                    />

                    {/* Content Grid */}
                    {loadingShows && (
                      <div className="flex flex-col items-center justify-center py-8 space-y-3">
                        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-400 animate-pulse">{loadingMessage}</p>
                      </div>
                    )}

                    {(() => {
                      const allItems: DashboardItem[] = (activeList?.type === 'system'
                        ? (activeList.id === 'binge_ready' ? bingeReadyShows : episodesLeftShows)
                        : listItems
                      );

                      const normalizedQuery = searchQuery.toLowerCase();
                      const filteredItems = allItems.filter((item) => {
                        const content = item.show || ('movie' in item ? item.movie : undefined);
                        return content && (!normalizedQuery || content.title.toLowerCase().includes(normalizedQuery));
                      });

                      if (!loadingShows && allItems.length === 0) {
                        return (
                          <div className="col-span-full text-center py-20 bg-gray-800/30 rounded-xl border border-gray-700/50 border-dashed">
                            <p className="text-gray-500">No items found in this list.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 content-start">
                          {activeList?.type !== 'system' && (() => {
                            const currentList = selectedLists.find(l => l.id === activeList?.id);
                            if (!currentList) return null;

                            return (
                              <div
                                className={`relative flex flex-col bg-gray-800 rounded-lg overflow-hidden border transition-all cursor-pointer group ${
                                  currentList.placeholder?.enabled
                                    ? 'border-purple-500/50 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-900/20'
                                    : 'border-dashed border-gray-700 hover:border-gray-500 bg-gray-800/50'
                                }`}
                                onClick={() => activeList && openPlaceholderModal(activeList.id)}
                              >
                                <div className="relative w-full aspect-[2/3] bg-gray-900">
                                  {currentList.placeholder?.enabled ? (
                                    <>
                                      <Image
                                        src={currentList.placeholder?.poster || '/poster-placeholder.svg'}
                                        alt="Placeholder"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                      />
                                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm z-10 shadow-lg bg-purple-900/80 text-purple-200">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        Custom
                                      </div>
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="bg-gray-900/80 p-2 rounded-full text-white">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-center gap-2 p-3 text-gray-500 hover:text-gray-300 transition-colors">
                                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mb-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                      </div>
                                      <span className="text-xs font-bold">List Placeholder</span>
                                    </div>
                                  )}
                                </div>

                                <div className="p-3 flex flex-col gap-1 flex-1 min-h-[80px]">
                                  <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 h-9 mb-0.5">
                                    {currentList.placeholder?.title || activeList?.name}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-400 text-[10px]">
                                    <span className="text-gray-500 font-semibold">List Cover</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {filteredItems.slice(0, visibleCount).map((item) => {
                            const content = item.show || ('movie' in item ? item.movie : undefined);
                            if (!content) return null;

                            return (
                              <ShowCard
                                key={content.ids.trakt}
                                item={item}
                                activeTab={activeList?.id === 'binge_ready' ? 'binge_ready' : (activeList?.id === 'episodes_left' ? 'episodes_left' : 'other')}
                                rpdbKey={status?.rpdbKey}
                                isRemoving={content.ids.slug ? removingIds.includes(content.ids.slug) : false}
                                onMarkWatched={markAsWatched}
                                onRemoveHistory={removeFromHistory}
                                variant="vertical"
                                onContentClick={handleItemClick}
                              />
                            );
                          })}

                          {visibleCount < allItems.length && (
                            <div ref={loadMoreRef} className="col-span-full py-8 flex justify-center w-full">
                              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
        confirmText={modalConfig.confirmText}
        confirmColor={modalConfig.confirmColor}
      />

        {editingPlaceholderListId && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700 shadow-2xl">
                    <h3 className="text-xl font-bold mb-4">Configure List Placeholder</h3>
                    <p className="text-sm text-gray-400 mb-6">
                        This custom item will appear as the first item in this list on Stremio, acting as a cover art for the list itself.
                    </p>
                    
                    <div className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Custom Title</label>
                                <input
                                    type="text"
                                    value={placeholderForm.title}
                                    onChange={(e) => setPlaceholderForm({...placeholderForm, title: e.target.value})}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none transition-shadow"
                                    placeholder="e.g. Netflix Movies"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Custom Poster</label>
                                
                                <div className="flex flex-col gap-3">
                                    {/* URL Input */}
                                    <input
                                        type="text"
                                        value={placeholderForm.poster}
                                        onChange={(e) => setPlaceholderForm({...placeholderForm, poster: e.target.value})}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none transition-shadow font-mono text-sm"
                                        placeholder="Enter image URL..."
                                    />
                                    
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 uppercase font-bold">OR</span>
                                        <div className="flex-1 h-px bg-gray-700"></div>
                                    </div>

                                    {/* Upload Button */}
                                    <label className={`flex items-center justify-center gap-2 w-full p-2 rounded-lg border border-dashed border-gray-600 bg-gray-700/30 hover:bg-gray-700/50 hover:border-gray-500 transition-all cursor-pointer ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {uploadingImage ? (
                                             <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        )}
                                        <span className="text-sm font-medium text-gray-300">
                                            {uploadingImage ? 'Uploading...' : 'Upload Image'}
                                        </span>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={handleImageUpload}
                                            disabled={uploadingImage}
                                        />
                                    </label>
                                </div>
                            </div>

                            {placeholderForm.poster && (
                                <div className="mt-2">
                                    <p className="text-xs text-gray-500 mb-1">Preview:</p>
                                    <div className="w-24 aspect-[2/3] rounded overflow-hidden border border-gray-600 bg-gray-900 relative shadow-lg">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img 
                                            src={placeholderForm.poster} 
                                            alt="Preview" 
                                            className="w-full h-full object-cover" 
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-700">
                        {selectedLists.find(l => l.id === editingPlaceholderListId)?.placeholder?.enabled && (
                            <button
                                type="button"
                                onClick={removePlaceholder}
                                className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                Remove Placeholder
                            </button>
                        )}
                        {!selectedLists.find(l => l.id === editingPlaceholderListId)?.placeholder?.enabled && <div></div>}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setEditingPlaceholderListId(null)}
                                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={savePlaceholder}
                                disabled={!placeholderForm.title || !placeholderForm.poster || uploadingImage}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Info Modal */}
        <InfoModal 
            isOpen={infoModal.isOpen} 
            onClose={() => setInfoModal(prev => ({ ...prev, isOpen: false }))}
            itemId={infoModal.itemId}
            itemType={infoModal.itemType}
            initialItem={infoModal.item}
            initialPosterUrl={infoModal.posterUrl}
            profileId={profileId || undefined}
            onWatchlistChange={() => refreshList('watchlist')}
            rpdbKey={status?.rpdbKey}
        />


      <PasswordModal
        isOpen={isPasswordModalOpen}
        onSubmit={handlePasswordSubmit}
        error={passwordError}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
