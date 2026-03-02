'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { TraktShow, TraktMovie, TraktList } from '@/lib/trakt';
import { formatDate, type DateFormat } from '@/lib/date-format';

type TraktContent = TraktShow | TraktMovie | (TraktShow & { type: 'show' }) | (TraktMovie & { type: 'movie' });

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId?: string;
  itemType?: 'movie' | 'show';
  initialItem?: TraktContent;
  profileId?: string;
  onWatchlistChange?: () => void;
  rpdbKey?: string;
  initialPosterUrl?: string | null;
    dateFormat?: DateFormat;
}

export default function InfoModal({ 
  isOpen, 
  onClose, 
  itemId, 
  itemType, 
  initialItem,
  profileId,
  onWatchlistChange,
  rpdbKey,
    initialPosterUrl,
    dateFormat = 'mdy'
}: InfoModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  
  // Save to List Logic
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userLists, setUserLists] = useState<any[]>([]);
  const [loadingUserLists, setLoadingUserLists] = useState(false);
  const [addingToListId, setAddingToListId] = useState<string | number | null>(null);
  const [listsFetched, setListsFetched] = useState(false);

  // Escape key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  const openSaveMenu = async () => {
    setShowSaveMenu(!showSaveMenu);
    if (!showSaveMenu && !listsFetched) {
        setLoadingUserLists(true);
        try {
            const res = await fetch(`/api/trakt/lists?profileId=${profileId}`);
            if (res.ok) {
                const data = await res.json();
                setUserLists(data);
                setListsFetched(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingUserLists(false);
        }
    }
  };

  const addToUserList = async (list: TraktList) => {
    if (!profileId || !data) return;
    setAddingToListId(list.ids.trakt);
    
    try {
        const content = data.show || data.movie || data;
        const item = { ids: content.ids };
        
        await fetch(`/api/trakt/lists/${list.ids.trakt}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  profileId,
                  items: itemType === 'movie' ? { movies: [item] } : { shows: [item] },
                  action: 'add'
              })
        });
        
        // Temporary success state is handled by the UI automatically reverting via timeout if we wanted,
        // but simple "Adding..." -> "Saved" is enough.
        // For now, clear the ID to stop spinner
    } catch(e) {
        console.error(e);
    } finally {
        setAddingToListId(null);
        setShowSaveMenu(false); // Close menu on success
    }
  };

  const toggleWatchlist = async () => {
      if (!profileId || !data) return;
      
      const content = data.show || data.movie || data;
      const type = data.show ? 'show' : (data.movie ? 'movie' : itemType);
      const action = inWatchlist ? 'remove' : 'add';
      
      // Optimistic update
      setInWatchlist(!inWatchlist);
      setWatchlistLoading(true);

      try {
          // Construct item object with IDs
          const item = { ids: content.ids };
          
          await fetch('/api/trakt/watchlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  profileId,
                  item,
                  type,
                  action
              })
          });
          
          if (onWatchlistChange) onWatchlistChange();
      } catch (e) {
          console.error('Failed to toggle watchlist', e);
          // Revert on failure
          setInWatchlist(inWatchlist); // old value
      } finally {
          setWatchlistLoading(false);
      }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    try {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = '';
            if (url.includes('v=')) {
                videoId = url.split('v=')[1].split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1];
            }
            
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}?autoplay=0&mute=0&rel=0`;
            }
        }
        return null;
    } catch {
        return null;
    }
  };

  useEffect(() => {
    const fetchInfo = async () => {
        if (!itemId || !itemType || !profileId) return;
        
        setLoading(true);
        try {
            const res = await fetch(`/api/trakt/info?profileId=${profileId}&id=${itemId}&type=${itemType}`);
            if (res.ok) {
                const newData = await res.json();
                setData(newData);
                if (newData.trailer) {
                    setTrailerUrl(getEmbedUrl(newData.trailer));
                }
                setInWatchlist(!!newData.inWatchlist);
            }
        } catch (e) {
            console.error('Failed to fetch info', e);
        } finally {
            setLoading(false);
        }
    };

    if (isOpen) {
        if (initialItem) {
            setData(initialItem);
            if (initialItem.trailer) {
                setTrailerUrl(getEmbedUrl(initialItem.trailer));
            }
            // Always fetch to get watchlist status and fresh info
            fetchInfo();
        } else if (itemId && itemType) {
            fetchInfo();
        }
    } else {
        // Reset state on close
        setTrailerUrl(null);
        setData(null);
    }
  }, [isOpen, itemId, itemType, initialItem, profileId]);

  if (!isOpen) return null;

  const content = data?.show || data?.movie || data;
  if (!content && loading) {
       return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
       )
  }

  if (!content) return null;

  const title = content.title;
  const year = content.year;
  const overview = content.overview;
  const rating = content.rating ? content.rating.toFixed(1) : null;
  const runtime = content.runtime ? `${content.runtime} min` : null;
  const genres = content.genres ? content.genres.slice(0, 3).join(', ') : null;
  const certification = content.certification;
    const rawDate = data?.first_aired || data?.released || data?.release_date || content?.released || content?.first_aired;
    const formattedDate = formatDate(rawDate, dateFormat);
  
  // Poster logic
  let posterUrl = null;
  if (content.images?.poster) {
      if (typeof content.images.poster === 'string') posterUrl = content.images.poster;
      else if (Array.isArray(content.images.poster)) posterUrl = content.images.poster[0];
      else if (content.images.poster.full) posterUrl = content.images.poster.full;
      else if (content.images.poster.thumb) posterUrl = content.images.poster.thumb;
  }

  if (posterUrl && !posterUrl.startsWith('http')) {
    posterUrl = 'https://' + posterUrl;
  }
  
  const originalPosterUrl = posterUrl;

  if (rpdbKey && rpdbKey !== 'disabled' && content.ids) {
    if (content.ids.imdb) {
      posterUrl = 'https://api.ratingposterdb.com/' + rpdbKey + '/imdb/poster-default/' + content.ids.imdb + '.jpg';
    } else if (content.ids.tmdb) {
      posterUrl = 'https://api.ratingposterdb.com/' + rpdbKey + '/tmdb/poster-default/' + content.ids.tmdb + '.jpg';
    } else if (content.ids.tvdb) {
      posterUrl = 'https://api.ratingposterdb.com/' + rpdbKey + '/tvdb/poster-default/' + content.ids.tvdb + '.jpg';
    }
  }
  
  const formattedPoster = initialPosterUrl || (posterUrl 
    ? `/api/image?url=${encodeURIComponent(posterUrl)}${originalPosterUrl ? `&fallback=${encodeURIComponent(originalPosterUrl)}` : ''}` 
    : null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
       {/* Close Button */}
       <button 
         onClick={onClose}
         className="absolute top-4 right-4 md:top-8 md:right-8 z-[110] text-gray-400 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors"
       >
         <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
       </button>
       
       <div className="w-full max-w-5xl bg-[#121212] rounded-2xl overflow-hidden shadow-2xl border border-white/5 flex flex-col max-h-[90vh]">
          {/* Top Section: Trailer or Backdrop */}
          <div className="aspect-video w-full bg-black relative shrink-0">
             {trailerUrl ? (
                 <iframe 
                    src={trailerUrl} 
                    className="w-full h-full" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                 />
             ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-900">
                    {formattedPoster && (
                         <div className="absolute inset-0 opacity-20">
                             <Image src={formattedPoster} alt={title} fill className="object-cover blur-sm" unoptimized />
                         </div>
                    )}
                    <div className="flex flex-col items-center gap-4 z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l5 5-5 5"></path><path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"></path></svg>
                        <span>No Trailer Available</span>
                    </div>
                 </div>
             )}
          </div>

          {/* Bottom Section: Metadata */}
          <div className="p-6 md:p-8 flex gap-6 md:gap-8 overflow-y-auto">
             {/* Poster */}
             <div className="hidden md:block shrink-0 w-32 md:w-48 aspect-[2/3] relative rounded-lg overflow-hidden shadow-lg bg-gray-800">
                 {formattedPoster ? (
                     <Image src={formattedPoster} alt={title} fill className="object-cover" unoptimized />
                 ) : (
                     <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No Image</div>
                 )}
             </div>

             {/* Info */}
             <div className="flex-1 space-y-4">
                 <div>
                     <h2 id="info-modal-title" className="text-2xl md:text-4xl font-bold text-white mb-2">{title} <span className="text-gray-500 font-normal text-xl md:text-3xl">({year})</span></h2>
                     
                     <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-gray-400">
                         {rating && (
                             <span className="flex items-center gap-1 text-yellow-500">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                 {rating}
                             </span>
                         )}
                         {certification && <span className="px-2 py-0.5 border border-gray-600 rounded">{certification}</span>}
                         {runtime && <span>{runtime}</span>}
                         {data?.status && <span className={`px-2 py-0.5 rounded ${data.status === 'ended' || data.status === 'canceled' ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>{data.status}</span>}
                         {formattedDate && <span>{formattedDate}</span>}
                     </div>
                 </div>

                 {genres && (
                     <div className="flex flex-wrap gap-2">
                         {content.genres.map((g: string) => (
                             <span key={g} className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-full capitalize">{g}</span>
                         ))}
                     </div>
                 )}

                 <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                     {overview || "No overview available."}
                 </p>
                 
                 <div className="pt-4 flex gap-4">
                     <div className="relative">
                        <button
                            onClick={openSaveMenu}
                            className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
                                inWatchlist 
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Save to List
                        </button>
                        
                        {showSaveMenu && (
                            <div className="absolute bottom-full mb-2 left-0 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-2 z-[120] animate-in slide-in-from-bottom-2 duration-200">
                                <button
                                    onClick={toggleWatchlist}
                                    disabled={watchlistLoading}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    {watchlistLoading ? (
                                        <div className="w-4 h-4 rounded border border-purple-500/30 flex items-center justify-center p-0.5">
                                             <div className="w-full h-full rounded-sm border-2 border-purple-500 border-t-transparent animate-spin" />
                                        </div>
                                    ) : (
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${inWatchlist ? 'bg-purple-600 border-purple-600' : 'border-gray-500'}`}>
                                            {inWatchlist && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                        </div>
                                    )}
                                    <span className="font-bold text-sm">Watchlist</span>
                                </button>
                                
                                <div className="h-px bg-gray-800 my-2 mx-1" />
                                
                                {loadingUserLists ? (
                                    <div className="p-4 flex justify-center">
                                        <div className="w-5 h-5 rounded-full border-2 border-gray-600 border-t-transparent animate-spin" />
                                    </div>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                        {userLists.filter(list => list.name.toLowerCase() !== 'watchlist').map(list => (
                                            <button
                                                key={list.ids.trakt}
                                                onClick={() => addToUserList(list)}
                                                disabled={addingToListId === list.ids.trakt}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded-lg flex items-center gap-2 transition-colors group"
                                            >
                                                {addingToListId === list.ids.trakt ? (
                                                     <div className="w-4 h-4 rounded border border-purple-500/30 flex items-center justify-center p-0.5">
                                                        <div className="w-full h-full rounded-sm border-2 border-purple-500 border-t-transparent animate-spin" />
                                                    </div>
                                                ) : (
                                                    <div className="w-4 h-4 rounded border border-gray-500 flex items-center justify-center transition-colors group-hover:border-white">
                                                       {/* Fake checkbox unchecked */}
                                                    </div>
                                                )}
                                                <span className="font-medium text-sm truncate text-gray-300 group-hover:text-white">{list.name}</span>
                                            </button>
                                        ))}
                                        {userLists.filter(list => list.name.toLowerCase() !== 'watchlist').length === 0 && (
                                            <div className="text-xs text-center text-gray-500 py-2">No custom lists found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                     </div>

                     <a 
                        href={`https://trakt.tv/${itemType === 'movie' ? 'movies' : 'shows'}/${content.ids.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
                     >
                         View on Trakt
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                     </a>
                 </div>
             </div>
          </div>
       </div>
    </div>
  );
}
