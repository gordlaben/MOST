'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import ShowCard from '@/components/ShowCard';
import FilterBar from '@/components/FilterBar';
import { DashboardList, TraktListItem } from '@/hooks/useDashboard';
import { useInView } from '@/hooks/useInView';
import { TraktShow, TraktMovie, TraktBingeReadyShow, TraktEpisodeLeftShow } from '@/lib/trakt';
import { DateFormat } from '@/lib/date-format';

type DashboardItem = TraktBingeReadyShow | TraktEpisodeLeftShow | TraktListItem;

interface ItemsViewProps {
  activeList: DashboardList | null;
  setView: (view: 'home' | 'lists' | 'items') => void;
  showFilters: boolean;
  setShowFilters: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  includeEnded: boolean;
  setIncludeEnded: (val: boolean) => void;
  includeCanceled: boolean;
  setIncludeCanceled: (val: boolean) => void;
  includeReturning: boolean;
  setIncludeReturning: (val: boolean) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  saveAsDefault: () => void;
  resetFilters: () => void;
  savingDefaults: boolean;
  loadingShows: boolean;
  loadingMessage: string;
  refreshShows: () => void;
  timeRemaining: number;
  formatTimeRemaining: (seconds: number) => string;
  bingeReadyShows: TraktBingeReadyShow[];
  episodesLeftShows: TraktEpisodeLeftShow[];
  listItems: TraktListItem[];
  removingIds: string[];
  markAsWatched: (slug: string, season: number | undefined, title: string, isMovie: boolean) => void;
  removeFromHistory: (slug: string, title: string, isMovie: boolean) => void;
  rpdbKey?: string;
  selectedLists: DashboardList[];
  updateList: (list: DashboardList) => void;
  handleItemClick: (item: { show?: TraktShow; movie?: TraktMovie }, posterUrl?: string | null) => void;
  dateFormat: DateFormat;
}

export default function ItemsView({
  activeList,
  setView,
  showFilters,
  setShowFilters,
  searchQuery,
  setSearchQuery,
  includeEnded,
  setIncludeEnded,
  includeCanceled,
  setIncludeCanceled,
  includeReturning,
  setIncludeReturning,
  sortBy,
  setSortBy,
  saveAsDefault,
  resetFilters,
  savingDefaults,
  loadingShows,
  loadingMessage,
  refreshShows,
  timeRemaining,
  formatTimeRemaining,
  bingeReadyShows,
  episodesLeftShows,
  listItems,
  removingIds,
  markAsWatched,
  removeFromHistory,
  rpdbKey,
  selectedLists,
  updateList,
  handleItemClick,
  dateFormat,
}: ItemsViewProps) {
  // Lazy Load State
  const [visibleCount, setVisibleCount] = useState(48);
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({ triggerOnce: false, rootMargin: '400px' });

  // Placeholder Logic
  const [editingPlaceholderListId, setEditingPlaceholderListId] = useState<string | null>(null);
  const [placeholderForm, setPlaceholderForm] = useState({
    title: '',
    poster: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    setVisibleCount(48);
  }, [activeList?.id]);

  useEffect(() => {
    if (loadMoreInView) {
      setVisibleCount(prev => prev + 24);
    }
  }, [loadMoreInView, visibleCount]);

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
        console.error('Upload failed');
      }
    } catch (err) {
      console.error('Upload error', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const allItems: DashboardItem[] = useMemo(() => {
    return activeList?.type === 'system'
      ? (activeList.id === 'binge_ready' ? bingeReadyShows : episodesLeftShows)
      : listItems;
  }, [activeList, bingeReadyShows, episodesLeftShows, listItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return allItems.filter((item) => {
      const content = item.show || ('movie' in item ? item.movie : undefined);
      return content && (!normalizedQuery || content.title.toLowerCase().includes(normalizedQuery));
    });
  }, [allItems, searchQuery]);

  return (
    <>
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
                    rpdbKey={rpdbKey}
                    isRemoving={content.ids.slug ? removingIds.includes(content.ids.slug) : false}
                    onMarkWatched={markAsWatched}
                    onRemoveHistory={removeFromHistory}
                    variant="vertical"
                    onContentClick={handleItemClick}
                    dateFormat={dateFormat}
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

      {/* Placeholder Modal */}
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
    </>
  );
}
