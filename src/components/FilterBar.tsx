interface FilterBarProps {
  showFilters: boolean;
  includeEnded: boolean;
  setIncludeEnded: (val: boolean) => void;
  includeCanceled: boolean;
  setIncludeCanceled: (val: boolean) => void;
  includeReturning: boolean;
  setIncludeReturning: (val: boolean) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  resetFilters: () => void;
  saveAsDefault: () => void;
  savingDefaults: boolean;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isSeriesList?: boolean;
}

export default function FilterBar({
  showFilters,
  includeEnded,
  setIncludeEnded,
  includeCanceled,
  setIncludeCanceled,
  includeReturning,
  setIncludeReturning,
  sortBy,
  setSortBy,
  resetFilters,
  saveAsDefault,
  savingDefaults,
  searchQuery,
  setSearchQuery,
  isSeriesList = true
}: FilterBarProps) {
  if (!showFilters) return null;

  return (
    <div className="mb-6 p-6 bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 shadow-inner">
      {/* Search Input */}
      <div className="md:col-span-2 space-y-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Search</h3>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter shows by title..."
            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {isSeriesList && (
        <>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Show Status</h3>
            <div className="flex flex-wrap gap-3">
            {[
                { label: 'Ended', checked: includeEnded, set: setIncludeEnded },
                { label: 'Canceled', checked: includeCanceled, set: setIncludeCanceled },
                { label: 'Returning', checked: includeReturning, set: setIncludeReturning },
            ].map((filter) => (
                <label key={filter.label} className="group flex items-center gap-3 cursor-pointer select-none bg-gray-800/50 hover:bg-gray-800 px-3 py-2 rounded-lg border border-gray-700/50 transition-all">
                <div className="relative">
                    <input
                    type="checkbox"
                    checked={filter.checked}
                    onChange={(e) => filter.set(e.target.checked)}
                    className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border transition-all duration-200 flex items-center justify-center ${
                    filter.checked 
                        ? 'bg-gradient-to-br from-purple-500 to-pink-600 border-transparent shadow-lg shadow-purple-500/20' 
                        : 'bg-gray-900 border-gray-600 group-hover:border-gray-500'
                    }`}>
                    <svg 
                        className={`w-3.5 h-3.5 text-white transform transition-transform duration-200 ${filter.checked ? 'scale-100' : 'scale-0'}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" 
                        strokeWidth="3"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    </div>
                </div>
                <span className={`text-sm font-medium transition-colors ${filter.checked ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                    {filter.label}
                </span>
                </label>
            ))}
            </div>
        </>
        )}
      </div>
      
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sort Order</h3>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all"
          >
            <option value="newest">Newest Release Date</option>
            <option value="oldest">Oldest Release Date</option>
            <option value="title">Title (A-Z)</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      <div className="md:col-span-2 flex justify-between items-center pt-4 border-t border-gray-700/50 mt-2">
        <button
          onClick={resetFilters}
          className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Reset Defaults
        </button>

        <button
          onClick={saveAsDefault}
          disabled={savingDefaults}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-lg shadow-purple-900/20 transition-all hover:shadow-purple-900/40 flex items-center gap-2"
        >
          {savingDefaults ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Save as Default for Stremio
            </>
          )}
        </button>
      </div>
    </div>
  );
}
