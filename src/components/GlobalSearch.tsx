'use client';

import { TraktShow, TraktMovie } from '@/lib/trakt';

interface GlobalSearchProps {
    profileId?: string | null;
    query: string;
    onQueryChange: (query: string) => void;
    isSearching?: boolean;
}

// Minimal interface for search results
export interface SearchResult {
    type: 'movie' | 'show';
    score: number;
    movie?: TraktMovie;
    show?: TraktShow;
}

export default function GlobalSearch({ query, onQueryChange, isSearching }: GlobalSearchProps) {
    return (
        <div className="relative w-full">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {isSearching ? (
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 group-focus-within:text-purple-400 transition-colors"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    )}
                </div>
                <input
                    type="text"
                    className="w-full bg-gray-800/50 border border-gray-700 text-gray-100 rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-medium placeholder:text-gray-500 hover:bg-gray-800"
                    placeholder="Search for movies & shows..."
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                />
                 {query && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                            onClick={() => onQueryChange('')}
                            className="p-2 bg-gray-700 text-gray-300 hover:text-white hover:bg-red-600 rounded-full transition-all shadow-lg"
                            aria-label="Clear search"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

