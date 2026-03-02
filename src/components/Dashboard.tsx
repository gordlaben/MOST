'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

import ConfirmationModal from '@/components/ConfirmationModal';
import PasswordModal from '@/components/PasswordModal';
import ToastContainer from '@/components/Toast';
import InfoModal from '@/components/InfoModal';
import DashboardSidebar from '@/components/DashboardSidebar';
import HomeView from '@/components/HomeView';
import ItemsView from '@/components/ItemsView';
import { useDashboard } from '@/hooks/useDashboard';
import { TraktShow, TraktMovie } from '@/lib/trakt';
import Image from 'next/image';

interface DashboardProps {
  profileId?: string;
  enableRegistration?: boolean;
}


export default function Dashboard({ profileId: propProfileId, enableRegistration = true }: DashboardProps) {
  const {
    calendarUrl,
    stremioUrl,
    dateFormat,
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
    renameList,
    updateList,
    refreshList,
    createList,
    createAiList,

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [showHiddenLists, setShowHiddenLists] = useState(false);

  const [infoModal, setInfoModal] = useState<{
      isOpen: boolean;
      itemId?: string;
      itemType?: 'movie' | 'show';
      item?: TraktShow | TraktMovie;
      posterUrl?: string | null;
  }>({ isOpen: false });

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

  const handleItemClick = (item: { show?: TraktShow; movie?: TraktMovie }, posterUrl?: string | null) => {
      const content = item.show || item.movie;
      if (!content) return;
      setInfoModal({
          isOpen: true,
          itemId: content.ids.slug,
          itemType: item.movie ? 'movie' : (item.show ? 'show' : undefined),
          item: content,
          posterUrl
      });
  };

  const fanarts = useMemo(() => {
    if (!profileId) return [] as string[];

    return [...bingeReadyShows, ...episodesLeftShows]
      .map(item => {
        const images = item.show?.images;
        let url: string | null = null;

        if (images?.fanart) {
          if (Array.isArray(images.fanart) && images.fanart.length > 0) {
            url = images.fanart[0];
          } else if (!Array.isArray(images.fanart) && 'full' in images.fanart) {
            url = images.fanart.full;
          }
        }

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
  }, [profileId, fanarts, bgImage]);

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

                <DashboardSidebar
                  isOpen={isSidebarOpen}
                  onClose={() => setIsSidebarOpen(false)}
                  view={view}
                  setView={setView}
                  profileId={profileId}
                  stremioUrl={stremioUrl}
                  calendarUrl={calendarUrl}
                  stats={stats}
                  addToast={addToast}
                  handleLogout={handleLogout}
                />

                {view === 'home' && (
                  <HomeView
                    profileId={profileId}
                    rpdbKey={status?.rpdbKey}
                    dateFormat={dateFormat}
                    selectedLists={selectedLists}
                    bingeReadyShows={bingeReadyShows}
                    episodesLeftShows={episodesLeftShows}
                    loadingLists={loadingLists}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    markAsWatched={markAsWatched}
                    removeFromHistory={removeFromHistory}
                    selectList={selectList}
                    renameList={renameList}
                    toggleListVisibility={toggleListVisibility}
                    removeList={removeList}
                    reorderLists={reorderLists}
                    importList={importList}
                    createList={createList}
                    createAiList={createAiList}
                    handleItemClick={handleItemClick}
                    setView={setView}
                    listVersions={listVersions}
                    sortPreferences={sortPreferences}
                    activeFilters={activeFilters}
                    homeScrollY={homeScrollY}
                    hasLoadedBinge={hasLoadedBinge}
                    hasLoadedEpisodes={hasLoadedEpisodes}
                    compactMode={compactMode}
                    setCompactMode={setCompactMode}
                    showHiddenLists={showHiddenLists}
                    setShowHiddenLists={setShowHiddenLists}
                  />
                )}

                {view === 'items' && (
                  <ItemsView
                    activeList={activeList}
                    setView={setView}
                    showFilters={showFilters}
                    setShowFilters={setShowFilters}
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
                    loadingShows={loadingShows}
                    loadingMessage={loadingMessage}
                    refreshShows={refreshShows}
                    timeRemaining={timeRemaining}
                    formatTimeRemaining={formatTimeRemaining}
                    bingeReadyShows={bingeReadyShows}
                    episodesLeftShows={episodesLeftShows}
                    listItems={listItems}
                    removingIds={removingIds}
                    markAsWatched={markAsWatched}
                    removeFromHistory={removeFromHistory}
                    rpdbKey={status?.rpdbKey}
                    selectedLists={selectedLists}
                    updateList={updateList}
                    handleItemClick={handleItemClick}
                    dateFormat={dateFormat}
                  />
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
          dateFormat={dateFormat}
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
