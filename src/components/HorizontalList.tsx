'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import ShowCard from './ShowCard';
import { TraktListItem, DashboardList } from '@/hooks/useDashboard';
import { TraktBingeReadyShow, TraktEpisodeLeftShow } from '@/lib/trakt';
import { useInView } from '@/hooks/useInView';

type ListItem = TraktListItem | TraktBingeReadyShow | TraktEpisodeLeftShow;

export interface HorizontalListProps {
  list: DashboardList; // List object from Dashboard
  listItems?: ListItem[]; // Pre-loaded items (for system lists)
  profileId?: string;
  rpdbKey?: string;
  onMarkWatched: (slug: string, season: number | undefined, title: string, isMovie: boolean) => void;
  onRemoveHistory: (slug: string, title: string, isMovie: boolean) => void;
  onSelectList: (list: DashboardList) => void;
  onToggleVisibility?: (listId: string) => void;
  onRemoveList?: (listId: string) => void;
  dragHandle?: React.ReactNode;
  compactMode?: boolean;
  onItemClick?: (item: ListItem, posterUrl?: string | null) => void;
  version?: number;
  sortBy?: string;
  filters?: {
      includeEnded: boolean;
      includeCanceled: boolean;
      includeReturning: boolean;
  };
}

export default function HorizontalList({
  list,
  listItems,
  profileId,
  rpdbKey,
  onMarkWatched,
  onRemoveHistory,
  onSelectList,
  onToggleVisibility,
  onRemoveList,
  dragHandle,
  compactMode = false,
  onItemClick,
  version = 0,
  sortBy,
  filters
}: HorizontalListProps) {
  const [items, setItems] = useState<ListItem[]>(listItems || []);
  const [loading, setLoading] = useState(!listItems);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  
  // Manage overflow visibility for smooth animations
  const [allowOverflow, setAllowOverflow] = useState(!compactMode);

  useEffect(() => {
     if (compactMode) {
         setAllowOverflow(false);
     } else {
         const timer = setTimeout(() => {
             setAllowOverflow(true);
         }, 500); // Match transition duration
         return () => clearTimeout(timer);
     }
  }, [compactMode]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        // Use a small buffer (e.g. 10px) to prevent sub-pixel issues showing arrow at start
        setShowLeftArrow(scrollLeft > 10);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scrollToPosition = (target: number) => {
    const element = scrollContainerRef.current;
    if (!element) return;

    // Disable snap to prevent fighting with the animation
    element.style.scrollSnapType = 'none';
    
    const start = element.scrollLeft;
    const distance = target - start;
    const duration = 1000; // ms
    let startTime: number | null = null;
    
    // Cubic Bezier solver for (.63,0,.48,1)
    const solveBezier = (p: number) => {
        const x1 = 0.63, y1 = 0, x2 = 0.48, y2 = 1;
        
        // Coefficients
        const cx = 3 * x1;
        const bx = 3 * (x2 - x1) - cx;
        const ax = 1 - cx - bx;

        const cy = 3 * y1;
        const by = 3 * (y2 - y1) - cy;
        const ay = 1 - cy - by;

        // Solve t for x (Newton-Raphson)
        let t = p;
        for (let i = 0; i < 8; i++) {
             const x = ((ax * t + bx) * t + cx) * t - p;
             if (Math.abs(x) < 1e-5) break; 
             const d = (3 * ax * t + 2 * bx) * t + cx;
             if (Math.abs(d) < 1e-5) break;
             t -= x / d;
        }

        // Calculate y from t
        return ((ay * t + by) * t + cy) * t;
    };

    function animation(currentTime: number) {
        if (!startTime) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        
        // ease using cubic-bezier
        const progress = Math.min(timeElapsed / duration, 1);
        const ease = solveBezier(progress);
        
        element!.scrollLeft = start + (distance * ease);

        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        } else {
            // Re-enable snap after animation
            element!.style.scrollSnapType = ''; 
            checkScroll();
        }
    }

    requestAnimationFrame(animation);
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const style = window.getComputedStyle(container);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        
        const currentScroll = container.scrollLeft;
        const width = container.clientWidth;
        const approximateTarget = currentScroll - (width * 0.8);
        
        const children = Array.from(container.children) as HTMLElement[];
        let closestDifference = Infinity;
        let targetScroll = 0;
        
        children.forEach(child => {
            if (child.className && child.className.includes('snap-start')) {
                 const snapPoint = child.offsetLeft - paddingLeft;
                 const diff = Math.abs(snapPoint - approximateTarget);
                 if (diff < closestDifference) {
                     closestDifference = diff;
                     targetScroll = snapPoint;
                 }
            }
        });
        
        scrollToPosition(Math.max(0, targetScroll));
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const style = window.getComputedStyle(container);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        
        const currentScroll = container.scrollLeft;
        const width = container.clientWidth;
        const approximateTarget = currentScroll + (width * 0.8);
        
        const children = Array.from(container.children) as HTMLElement[];
        let closestDifference = Infinity;
        // set default to max scroll? default to current is safer if nothing found
        let targetScroll = container.scrollWidth - container.clientWidth;
        
        children.forEach(child => {
             if (child.className && child.className.includes('snap-start')) {
                 const snapPoint = child.offsetLeft - paddingLeft;
                 const diff = Math.abs(snapPoint - approximateTarget);
                 if (diff < closestDifference) {
                     closestDifference = diff;
                     targetScroll = snapPoint;
                 }
            }
        });
        
        scrollToPosition(targetScroll);
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
        // Debounce the scroll check slightly to prevent thrashing
        const handleScroll = () => {
             requestAnimationFrame(checkScroll);
        };
        const handleResize = () => handleScroll();
        
        el.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);
        
        // Use ResizeObserver to reliably detect size changes
        const resizeObserver = new ResizeObserver(() => {
             handleScroll();
        });
        resizeObserver.observe(el);

        // Initial check
        handleScroll();
        
        // Double check after animations (500ms transition)
        const timer = setTimeout(handleScroll, 600);

        return () => {
            el.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            clearTimeout(timer);
        };
    }
  }, [items, loading, compactMode, allowOverflow]);

  useEffect(() => {
    // Reset scroll when list changes or loads to correct "Left Arrow" appearing on init
    // We force scroll to 0 because sometimes browser scroll restoration or layout shifts cause it to start slightly scrolled
    if (scrollContainerRef.current && !loading) {
        // We use requestAnimationFrame to ensure layout is settled
        requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
                 scrollContainerRef.current.scrollLeft = 0;
                 checkScroll();
            }
        });
    }
  }, [loading, list.id]);

  const { ref: inViewRef, inView } = useInView({ triggerOnce: true, rootMargin: '100px' });
  
  useEffect(() => {
    // If listItems are provided (e.g. system lists), use them and don't fetch
    if (listItems) {
      setItems(listItems);
      setLoading(false);
      return;
    }

    // Only fetch if in view (or close to it)
    if (!inView) return;

    const fetchItems = async () => {
      setLoading(true);
      try {
        let url = `/api/trakt/list-items?profileId=${profileId}&listId=${list.id}&limit=20`;
        if (list.owner) {
          url += `&username=${list.owner}`;
        }
        if (sortBy) {
            url += `&sortBy=${sortBy}`;
        }
        if (filters) {
            url += `&includeEnded=${filters.includeEnded}&includeCanceled=${filters.includeCanceled}&includeReturning=${filters.includeReturning}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setItems(data);
        }
      } catch (error) {
        console.error('Failed to fetch list items', error);
      } finally {
        setLoading(false);
      }
    };

    if (profileId) {
      fetchItems();
    }
  }, [list, listItems, profileId, version, sortBy, filters, inView]);

  if (!loading && items.length === 0) return null;

  const isHidden = list.enabled === false;
  
  // Badge Logic
  let badgeText = '';
  let badgeClasses = '';
  
  const isSystem = list.type === 'system';
  if (isSystem) {
      if (list.id.startsWith('search-')) {
          badgeText = '';
      } else if (list.id === 'binge_ready') {
          badgeText = 'System List';
          badgeClasses = "bg-purple-900/30 text-purple-300 border-purple-500/30";
      } else {
          badgeText = 'System List';
          badgeClasses = "bg-blue-900/30 text-blue-300 border-blue-500/30";
      }
  } else if (list.type === 'custom') {
      badgeText = 'Custom List';
      badgeClasses = "bg-orange-900/30 text-orange-300 border-orange-500/30";
  } else {
      badgeText = 'Trakt List';
      badgeClasses = "bg-red-900/30 text-red-300 border-red-500/30";
  }

  let contentTypeBadge = '';
  let contentTypeClass = '';

  if (list.content_type === 'movie') {
    contentTypeBadge = 'Movies';
    contentTypeClass = 'bg-blue-900/30 text-blue-300 border-blue-500/30';
  } else if (list.content_type === 'series') {
    contentTypeBadge = 'Series';
    contentTypeClass = 'bg-purple-900/30 text-purple-300 border-purple-500/30';
  } else if (list.content_type === 'mixed') {
    contentTypeBadge = 'Mixed';
    contentTypeClass = 'bg-gray-700 text-gray-300 border-gray-600';
  }

  let infoTooltip = '';
  if (list.id === 'binge_ready') {
      infoTooltip = "Shows where a complete season has aired that you haven't watched yet. Perfect for binge-watching entire seasons at once.";
  } else if (list.id === 'episodes_left') {
      infoTooltip = "Shows where you have started a season but haven't finished it yet. Catch up on your active shows.";
  }

  const displayCount = (typeof list.item_count === 'number') ? list.item_count : items.length;

  const BadgeGroup = (
    <div className="flex gap-2">
        {badgeText && (
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${badgeClasses}`}>
                {badgeText}
            </span>
        )}
        {contentTypeBadge && (
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${contentTypeClass}`}>
                {contentTypeBadge}
            </span>
        )}
        {(list.type === 'custom' || list.type === 'trakt') && (
            <a 
                href={list.type === 'custom' 
                    ? `https://trakt.tv/users/${list.owner}/lists/${list.id}`
                    : (list.id === 'watchlist' ? 'https://trakt.tv/users/me/watchlist' : `https://trakt.tv/users/me/lists/${list.id}`)
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border bg-blue-900/20 text-blue-400 border-blue-800 hover:bg-blue-900/40 hover:text-blue-300 flex items-center gap-1 transition-colors"
                title="Open in Trakt"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                Trakt
            </a>
        )}
    </div>
  );

  return (
    <div ref={inViewRef} className={`${compactMode ? 'mb-0' : 'mb-8'} animate-in fade-in slide-in-from-bottom-4 duration-500 ${isHidden ? 'opacity-60 saturate-50' : ''} ${compactMode ? 'hover:bg-white/5 transition-colors duration-200 rounded-lg p-3' : ''}`}>
      <div className={`relative z-20 ${compactMode ? 'px-1 md:px-[2.25rem] mb-0' : 'px-4 md:px-12 mb-3'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-y-3">
            <div className="flex items-center gap-3">
            {dragHandle}
            <div className="flex items-center gap-3">
                <h2 
                    className="text-xl md:text-2xl font-bold text-white hover:text-purple-400 cursor-pointer transition-colors flex items-center gap-2"
                    onClick={() => onSelectList(list)}
                >
                {list.name}
                {isHidden && (
                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border bg-gray-700 text-gray-400 border-gray-600">Hidden</span>
                )}
                <span className="text-gray-500 font-normal text-sm ml-1">({displayCount})</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </h2>

                {infoTooltip && (
                    <div className="relative group/info self-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 hover:text-blue-400 cursor-help transition-colors"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg shadow-xl text-xs text-gray-300 opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                            {infoTooltip}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full text-gray-900/95 border-r border-b border-gray-700 w-2 h-2 -mt-1 transform rotate-45 bg-gray-900/95"></div>
                        </div>
                    </div>
                )}

                <div className="hidden sm:block">
                    {BadgeGroup}
                </div>
            </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end sm:gap-4 w-full sm:w-auto min-w-0">
                <div className="sm:hidden flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pr-2 min-w-0">
                    <div className="w-max">
                        {BadgeGroup}
                    </div>
                </div>
                <div className="flex items-center gap-3 ml-auto sm:ml-4 shrink-0 pl-2 border-l border-white/10 sm:border-none">
                    {list.type === 'custom' && onRemoveList && (
                        <button
                            onClick={() => onRemoveList(list.id)}
                            className="text-red-500 hover:text-red-400 transition-colors"
                            title="Remove Custom List"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    )}
                    {onToggleVisibility && (
                        <button
                            onClick={() => onToggleVisibility(list.id)}
                            className="text-gray-500 hover:text-white transition-colors"
                            title={isHidden ? "Show List" : "Hide List"}
                        >
                            {isHidden ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            )}
                        </button>
                    )}
                    {!list.id.startsWith('search-') && (
                    <button 
                        onClick={() => onSelectList(list)}
                        className="text-sm text-gray-500 hover:text-white transition-colors uppercase font-bold tracking-wider flex items-center"
                    >
                        <span className="hidden sm:inline">See All</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:hidden"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div 
        className={`grid transition-all duration-500 ease-in-out ${compactMode ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
      >
        <div className={`w-full max-w-full min-w-0 ${allowOverflow ? "overflow-visible" : "overflow-hidden"}`}>
            <div className="relative group/carousel w-full max-w-full min-w-0">
                    {showLeftArrow && (
                        <button
                            onClick={scrollLeft}
                            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-[100] w-10 h-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm transition-all"
                            aria-label="Scroll left"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                    )}

                    <div 
                        ref={scrollContainerRef}
                        className="flex overflow-x-auto gap-3 md:gap-4 px-4 md:px-12 py-8 snap-x scroll-pl-4 md:scroll-pl-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] [mask-image:linear-gradient(to_right,black_0%,black_calc(100%-48px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_0%,black_calc(100%-48px),transparent_100%)] -my-8 w-full"
                    >
                        {list.type !== 'system' && list.placeholder?.enabled && (
                            <div className="flex-none w-[130px] md:w-[180px] snap-start transition-opacity group">
                                <div 
                                    className="relative flex flex-col bg-gray-800 rounded-lg overflow-hidden border border-purple-500/50 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-900/20 transition-all cursor-pointer group h-full"
                                    onClick={() => onSelectList(list)}
                                >
                                    {/* Poster Section (Fixed Aspect Ratio) */}
                                    <div className="relative w-full aspect-[2/3] bg-gray-900 shrink-0">
                                        <Image
                                            src={list.placeholder.poster || '/poster-placeholder.svg'} 
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
                                    </div>

                                    {/* Content Section */}
                                    <div className="p-3 flex flex-col gap-1 flex-1 min-h-[auto] bg-gray-800">
                                        <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 mb-0.5 h-auto">
                                            {list.placeholder.title || list.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-400 text-[10px]">
                                            <span className="text-gray-500 font-semibold">List Cover</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {items.map((item, idx) => {
                             const traktId = 'show' in item && item.show ? item.show.ids.trakt : ('movie' in item && item.movie ? item.movie.ids.trakt : idx);
                             return (
                            <div 
                                key={`${traktId}-${idx}`} 
                                className="flex-none w-[130px] md:w-[180px] snap-start transition-opacity group"
                            >
                                <ShowCard 
                                    item={item}
                                    activeTab="other"
                                    rpdbKey={rpdbKey}
                                    isRemoving={false}
                                    onMarkWatched={onMarkWatched}
                                    onRemoveHistory={onRemoveHistory}
                                    variant="vertical"
                                    onContentClick={onItemClick}
                                />
                            </div>
                        ); })}
                        
                        {loading && Array.from({ length: 20 }).map((_, i) => (
                            <div 
                                key={`skeleton-${i}`} 
                                className="flex-none w-[130px] md:w-[180px] aspect-[2/3] bg-gray-800 rounded-lg animate-pulse snap-start" 
                            />
                        ))}
                    </div>

                    {showRightArrow && (
                        <button
                            onClick={scrollRight}
                            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-[100] w-10 h-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm transition-all"
                            aria-label="Scroll right"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>
                    )}
            </div>
        </div>
      </div>
    </div>
  );
}
