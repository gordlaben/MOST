'use client';

import { useState, useEffect, useMemo, useCallback, MutableRefObject } from 'react';
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

import GlobalSearch, { SearchResult } from '@/components/GlobalSearch';
import HorizontalList, { HorizontalListProps } from '@/components/HorizontalList';
import { DashboardList, TraktListItem } from '@/hooks/useDashboard';
import { useInView } from '@/hooks/useInView';
import { TraktShow, TraktMovie, TraktBingeReadyShow, TraktEpisodeLeftShow } from '@/lib/trakt';
import { DateFormat } from '@/lib/date-format';

// --- SortableHorizontalListWrapper (moved from Dashboard) ---

interface SortableListProps extends Omit<HorizontalListProps, 'dragHandle' | 'list'> {
  list: DashboardList;
  listVersions?: Record<string, number>;
}

function SortableHorizontalListWrapper({ list, listVersions, currentSort, filters, dateFormat, ...props }: SortableListProps & { currentSort?: string; filters?: { includeEnded: boolean; includeCanceled: boolean; includeReturning: boolean }; dateFormat?: DateFormat }) {
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
              dateFormat={dateFormat}
              {...props}
            />
            <HorizontalList
              list={{...list, content_type: 'series'}}
              type="show"
              dragHandle={DragHandle}
              version={listVersions?.[list.id] || 0}
              sortBy={currentSort}
              filters={filters}
              dateFormat={dateFormat}
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
              dateFormat={dateFormat}
              {...props}
            />
            <HorizontalList
              list={{...list, content_type: 'movie'}}
              type="movie"
              dragHandle={DragHandle}
              version={listVersions?.[list.id] || 0}
              sortBy={currentSort}
              filters={filters}
              dateFormat={dateFormat}
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
        dateFormat={dateFormat}
        {...props}
      />
    </div>
  );
}

// --- HomeView Props ---

interface HomeViewProps {
  profileId: string | null;
  rpdbKey?: string;
  dateFormat: DateFormat;
  selectedLists: DashboardList[];
  bingeReadyShows: TraktBingeReadyShow[];
  episodesLeftShows: TraktEpisodeLeftShow[];
  loadingLists: boolean;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  markAsWatched: (slug: string, season: number | undefined, title: string, isMovie: boolean) => void;
  removeFromHistory: (slug: string, title: string, isMovie: boolean) => void;
  selectList: (list: DashboardList) => void;
  renameList: (listId: string, newName: string) => void;
  toggleListVisibility: (listId: string) => void;
  removeList: (listId: string) => void;
  reorderLists: (lists: DashboardList[]) => void;
  importList: (url: string) => void;
  createList: (name: string, description: string, privacy: string) => Promise<boolean>;
  createAiList: (prompt: string, type: 'movie' | 'show', size: number, privacy: string, name?: string) => Promise<boolean>;
  handleItemClick: (item: { show?: TraktShow; movie?: TraktMovie }, posterUrl?: string | null) => void;
  setView: (view: 'home' | 'lists' | 'items') => void;
  listVersions: Record<string, number>;
  sortPreferences: Record<string, string>;
  activeFilters: { includeEnded: boolean; includeCanceled: boolean; includeReturning: boolean };
  homeScrollY: MutableRefObject<number>;
  hasLoadedBinge: boolean;
  hasLoadedEpisodes: boolean;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
  showHiddenLists: boolean;
  setShowHiddenLists: (val: boolean) => void;
}

export default function HomeView({
  profileId,
  rpdbKey,
  dateFormat,
  selectedLists,
  bingeReadyShows,
  episodesLeftShows,
  loadingLists,
  searchQuery,
  setSearchQuery,
  markAsWatched,
  removeFromHistory,
  selectList,
  renameList,
  toggleListVisibility,
  removeList,
  reorderLists,
  importList,
  createList,
  createAiList,
  handleItemClick,
  setView,
  listVersions,
  sortPreferences,
  activeFilters,
  homeScrollY,
  hasLoadedBinge,
  hasLoadedEpisodes,
  compactMode,
  setCompactMode,
  showHiddenLists,
  setShowHiddenLists,
}: HomeViewProps) {
  // Search Logic
  const [searchMovies, setSearchMovies] = useState<SearchResult[]>([]);
  const [searchShows, setSearchShows] = useState<SearchResult[]>([]);
  const [isSearchingTrakt, setIsSearchingTrakt] = useState(false);

  const [isAddListModalOpen, setIsAddListModalOpen] = useState(false);
  const [addListTab, setAddListTab] = useState<'import' | 'create' | 'ai'>('import');
  const [importUrl, setImportUrl] = useState('');
  const [createListForm, setCreateListForm] = useState({ name: '', description: '', privacy: 'private' });
  const [createAiForm, setCreateAiForm] = useState({
    prompt: '',
    type: 'movie',
    size: 20,
    privacy: 'private'
  });

  // Home Lists Lazy Load
  const [visibleListsCount, setVisibleListsCount] = useState(5);
  const { ref: loadMoreListsRef, inView: loadMoreListsInView } = useInView({ triggerOnce: false, rootMargin: '200px' });

  const visibleLists = useMemo(() => {
    return showHiddenLists ? selectedLists : selectedLists.filter(l => l.enabled !== false);
  }, [showHiddenLists, selectedLists]);

  const getAiListSize = useCallback((count: number) => {
    if (count >= 100) return 100;
    if (count >= 50) return 50;
    if (count >= 20) return 20;
    return 10;
  }, []);

  // Trakt search debounce
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

  useEffect(() => {
    if (loadMoreListsInView) {
      setVisibleListsCount(prev => (prev < visibleLists.length ? prev + 3 : prev));
    }
  }, [loadMoreListsInView, visibleLists.length]);

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

  return (
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
                    headerActions={(
                      <button
                        type="button"
                        onClick={() => {
                          if (searchQuery.trim().length > 2) {
                            createAiList(
                              searchQuery.trim(),
                              'movie',
                              getAiListSize(searchMovies.length),
                              'private',
                              searchQuery.trim()
                            );
                          }
                        }}
                        disabled={loadingLists || searchQuery.trim().length < 3}
                        className="px-3 py-1.5 text-xs font-bold rounded-md bg-purple-600/80 hover:bg-purple-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Create list
                      </button>
                    )}
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
                    headerActions={(
                      <button
                        type="button"
                        onClick={() => {
                          if (searchQuery.trim().length > 2) {
                            createAiList(
                              searchQuery.trim(),
                              'show',
                              getAiListSize(searchShows.length),
                              'private',
                              searchQuery.trim()
                            );
                          }
                        }}
                        disabled={loadingLists || searchQuery.trim().length < 3}
                        className="px-3 py-1.5 text-xs font-bold rounded-md bg-purple-600/80 hover:bg-purple-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Create list
                      </button>
                    )}
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
                          rpdbKey={rpdbKey}
                          onMarkWatched={markAsWatched}
                          onRemoveHistory={removeFromHistory}
                          onSelectList={(list) => {
                            homeScrollY.current = window.scrollY;
                            selectList(list);
                          }}
                          onRenameList={renameList}
                          onToggleVisibility={toggleListVisibility}
                          onRemoveList={removeList}
                          compactMode={compactMode}
                          onItemClick={handleItemClick}
                          listVersions={listVersions}
                          currentSort={sortPreferences?.[list.id] || 'newest'}
                          filters={activeFilters}
                          dateFormat={dateFormat}
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
              <button
                onClick={() => setAddListTab('ai')}
                className={`pb-2 px-4 font-bold transition-colors border-b-2 text-sm ${addListTab === 'ai' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                Using AI
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
            ) : addListTab === 'create' ? (
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
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Prompt</label>
                  <textarea
                    value={createAiForm.prompt}
                    onChange={(e) => setCreateAiForm(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Best movies from the 90s"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none h-24"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Type</label>
                    <select
                      value={createAiForm.type}
                      onChange={(e) => setCreateAiForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="movie">Movies</option>
                      <option value="show">Series</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">List Size</label>
                    <select
                      value={createAiForm.size}
                      onChange={(e) => setCreateAiForm(prev => ({ ...prev, size: Number(e.target.value) }))}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Privacy</label>
                  <select
                    value={createAiForm.privacy}
                    onChange={(e) => setCreateAiForm(prev => ({ ...prev, privacy: e.target.value }))}
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
                      if (createAiForm.prompt.trim().length > 2) {
                        const success = await createAiList(
                          createAiForm.prompt,
                          createAiForm.type as 'movie' | 'show',
                          createAiForm.size,
                          createAiForm.privacy
                        );
                        if (success) {
                          setCreateAiForm({ prompt: '', type: 'movie', size: 20, privacy: 'private' });
                          setIsAddListModalOpen(false);
                          setAddListTab('import');
                        }
                      }
                    }}
                    disabled={loadingLists || createAiForm.prompt.trim().length < 3}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
                  >
                    {loadingLists ? 'Creating...' : 'Create AI List'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
