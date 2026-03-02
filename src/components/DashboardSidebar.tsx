'use client';

import Image from 'next/image';
import type { ToastType } from './Toast';

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  view: 'home' | 'lists' | 'items';
  setView: (view: 'home' | 'lists' | 'items') => void;
  profileId: string | null;
  stremioUrl: string;
  calendarUrl: string;
  stats: { username: string; totalShows: number; lastWatched: string; avatar?: string } | null;
  addToast: (message: string, type: ToastType) => void;
  handleLogout: () => void;
}

export default function DashboardSidebar({
  isOpen,
  onClose,
  view,
  setView,
  profileId,
  stremioUrl,
  calendarUrl,
  stats,
  addToast,
  handleLogout,
}: DashboardSidebarProps) {
  return (
    <>
      {/* Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Drawer */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-[20rem] bg-gray-900 z-[70] shadow-2xl transition-transform duration-300 ease-in-out border-r border-white/5 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <h2 className="text-2xl font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 font-[family-name:var(--font-goldman)] tracking-tighter">
            MOST
          </h2>
          <button
            onClick={onClose}
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
              onClick={() => { setView('home'); onClose(); }}
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
    </>
  );
}
