-- CreateIndex
CREATE INDEX "Episode_seasonId_idx" ON "Episode"("seasonId");

-- CreateIndex
CREATE INDEX "Season_showId_idx" ON "Season"("showId");

-- CreateIndex
CREATE INDEX "TraktListItem_listId_idx" ON "TraktListItem"("listId");

-- CreateIndex
CREATE INDEX "WatchedEntry_profileId_lastWatchedAt_idx" ON "WatchedEntry"("profileId", "lastWatchedAt");
