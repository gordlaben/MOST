'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ShowCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any;
  activeTab: string;
  rpdbKey?: string;
  isRemoving: boolean;
  onMarkWatched: (slug: string, season: number | undefined, title: string, isMovie: boolean) => void;
  onRemoveHistory: (slug: string, title: string, isMovie: boolean) => void;
  variant?: 'horizontal' | 'vertical';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onContentClick?: (item: any, posterUrl?: string | null) => void;
}

export default function ShowCard({ 
  item, 
  activeTab, 
  rpdbKey, 
  isRemoving, 
  onMarkWatched, 
  onRemoveHistory,
  variant = 'horizontal',
  onContentClick
}: ShowCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isSystemList = activeTab === 'binge_ready' || activeTab === 'episodes_left';
  const content = item.show || item.movie;
  
  if (!content) return null;

  const isMovie = !!item.movie;
  const totalEpisodes = item.totalEpisodes || content.aired_episodes;
  
  let posterUrl = null;
  if (content.images?.poster) {
    if (Array.isArray(content.images.poster) && content.images.poster.length > 0) {
      posterUrl = content.images.poster[0];
    } else if (typeof content.images.poster === 'object' && content.images.poster.thumb) {
      posterUrl = content.images.poster.thumb;
    }
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

  const traktUrl = 'https://trakt.tv/' + (isMovie ? 'movies' : 'shows') + '/' + content.ids.slug;
  
  // Use local proxy to ensure caching and avoid API limits
  // If the image is already cached, it serves from disk.
  // If not, it redirects to the source (for speed) and caches in background.
  // We pass originalPosterUrl as fallback so if RPDB is not cached, we show the standard poster instantly
  // while RPDB downloads in background.
  const finalPosterUrl = posterUrl 
    ? `/api/image?url=${encodeURIComponent(posterUrl)}${originalPosterUrl ? `&fallback=${encodeURIComponent(originalPosterUrl)}` : ''}` 
    : null;

  return (
    <div 
      className={'bg-gray-800 rounded-lg border border-gray-700 overflow-hidden transition-all duration-300 ease-in-out group relative ' + 
        (isRemoving ? 'opacity-0 scale-95 p-0 border-0 ' : 'opacity-100 scale-100 ') +
        (variant === 'horizontal' 
          ? 'p-3 md:p-4 flex gap-3 md:gap-4 items-center max-h-96' 
          : 'flex flex-col h-full hover:scale-105 hover:z-10 hover:border-purple-500 hover:shadow-2xl')
      }
    >
      <a 
          href={traktUrl} 
          target='_blank' 
          rel='noopener noreferrer' 
          onClick={(e) => {
              if (onContentClick) {
                  e.preventDefault();
                  onContentClick(item, finalPosterUrl);
              }
          }}
          className={'shrink-0 relative block group bg-gray-900 ' + 
            (variant === 'horizontal' 
              ? 'w-20 h-[120px] md:w-24 md:h-36 rounded shadow-md overflow-hidden' 
              : 'w-full aspect-[2/3] overflow-hidden')
          }
        >
          {/* Placeholder - Always visible underneath */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-gray-900">
             <div className="text-white opacity-[0.07]">
                 <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                 </svg>
             </div>
          </div>

          {finalPosterUrl && (
            <Image 
              src={finalPosterUrl} 
              alt={content.title} 
              fill
              sizes={variant === 'horizontal' ? '(max-width: 768px) 80px, 96px' : '(max-width: 768px) 150px, 200px'}
              className={'object-cover relative z-10 transition-opacity duration-500 ' + 
                  (imageLoaded ? 'opacity-100' : 'opacity-0')
              }
              unoptimized={true}
              onLoad={() => setImageLoaded(true)}
            />
          )}

          {variant === 'vertical' && (
            <div className="absolute top-2 left-2 z-20 flex flex-col items-start gap-1.5">
                <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm shadow-lg ${isMovie ? 'bg-blue-900/80 text-blue-200' : 'bg-purple-900/80 text-purple-200'}`}>
                {isMovie ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                )}
                {isMovie ? 'Movie' : 'TV'}
                </div>
                
                {!isMovie && content.status && ['ended', 'canceled'].includes(content.status.toLowerCase()) && (
                    <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600/90 text-white backdrop-blur-sm shadow-lg border border-red-400/20 uppercase">
                        {content.status}
                    </div>
                )}
            </div>
          )}
          {variant === 'vertical' && content.rating && (
            <div className='absolute top-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-500 flex items-center gap-1 backdrop-blur-sm z-20 shadow-lg'>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> {content.rating.toFixed(1)}
            </div>
          )}

          {/* Hover Actions Overlay for Vertical Variant */}
          {variant === 'vertical' && isSystemList && (
             <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4 z-30">
                 <button 
                    onClick={(e) => {
                        e.preventDefault();
                        onMarkWatched(content.ids.slug, item.latestSeason, content.title, isMovie);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    Watched
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        onRemoveHistory(content.ids.slug, content.title, isMovie);
                    }}
                    className="w-full bg-red-900/80 hover:bg-red-800 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    Hide
                </button>
             </div>
          )}
        </a>
      
      <div 
        className={
          variant === 'horizontal' 
            ? 'flex-1 min-w-0 flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4' 
            : 'p-3 flex flex-col gap-1 flex-1 min-h-[80px]'
        }
      >
        <div className='flex-1 min-w-0'>
          <h3 className={'font-bold text-white leading-tight ' + (variant === 'horizontal' ? 'text-base md:text-lg truncate' : 'text-sm mb-0.5 line-clamp-2 h-9')}>
            <a 
                href={traktUrl} 
                target='_blank' 
                rel='noopener noreferrer' 
                className='hover:text-purple-400 group-hover:text-purple-300'
                onClick={(e) => {
                    if (onContentClick) {
                        e.preventDefault();
                        onContentClick(item, finalPosterUrl);
                    }
                }}
            >
              {content.title}
            </a>
          </h3>
          <div className={'flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-400 ' + (variant === 'horizontal' ? 'text-xs md:text-sm mt-1' : 'text-[10px]')}>
            {variant === 'horizontal' && (
              <span className={'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ' + (isMovie ? 'bg-blue-900/50 text-blue-200 border border-blue-700/50' : 'bg-purple-900/50 text-purple-200 border border-purple-700/50')}>
                {isMovie ? 'Movie' : 'Series'}
              </span>
            )}
            
            {content.year && <span className={variant === 'vertical' ? 'text-xs font-semibold text-gray-300' : ''}>{content.year}</span>}

            {!isMovie && variant === 'horizontal' && (
                <>
                    {content.year && <span className='hidden md:inline'></span>}
                    {item.latestSeason && <span>Season {item.latestSeason}</span>}
                    {item.latestSeason && <span className='hidden md:inline'></span>}
                    {totalEpisodes && <span>{totalEpisodes} Episodes</span>}
                </>
            )}
            
            {isSystemList && variant === 'vertical' && !isMovie && (
                <span className='block w-full text-purple-400 font-medium mt-1'>
                    {item.nextEpisode ? 'S' + item.nextEpisode.season + ' E' + item.nextEpisode.number : 'Ended'}
                </span>
            )}
          </div>
          
          {variant === 'horizontal' && (
              <>
                  {item.releaseDate && activeTab === 'binge_ready' && (
                    <p className='text-xs text-green-400 mt-0.5 md:mt-1'>
                        Finale: {new Date(item.releaseDate).toLocaleDateString()}
                    </p>
                  )}
                  {isSystemList && item.watchedEpisodes > 0 && (
                    <div className='w-full flex flex-col gap-1 mt-2'>
                        <div className='hidden md:block w-full h-1.5 bg-gray-700 rounded-full overflow-hidden'>
                            <div className='h-full bg-purple-500 rounded-full' style={{ width: (item.watchedEpisodes / item.totalEpisodes * 100) + '%' }} />
                        </div>
                        <p className='text-[10px] md:text-xs text-gray-400 md:text-left'>
                            {item.watchedEpisodes} / {item.totalEpisodes} watched
                        </p>
                    </div>
                  )}
              </>
          )}
          
           {isSystemList && item.watchedEpisodes > 0 && variant === 'vertical' && (
                <div className='w-full mt-2'>
                     <div className='w-full h-1 bg-gray-700 rounded-full overflow-hidden'>
                        <div className='h-full bg-purple-500 rounded-full' style={{ width: (item.watchedEpisodes / item.totalEpisodes * 100) + '%' }} />
                    </div>
                </div>
          )}
        </div>

        {isSystemList && variant === 'horizontal' && (
        <div className='hidden md:flex gap-2 shrink-0'>
          <button title='Mark as Watched' onClick={() => onMarkWatched(content.ids.slug, item.latestSeason, content.title, isMovie)} className='p-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-800 rounded-lg transition-colors'>
            <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'></path><circle cx='12' cy='12' r='3'></circle></svg>
          </button>
          <button title='Remove from History' onClick={() => onRemoveHistory(content.ids.slug, content.title, isMovie)} className='p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 rounded-lg transition-colors'>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
