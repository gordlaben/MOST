-- CreateTable
CREATE TABLE "TraktList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traktId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "privacy" TEXT,
    "type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "profileId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TraktList_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TraktListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "listedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "showId" INTEGER,
    "movieId" INTEGER,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    CONSTRAINT "TraktListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TraktList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraktListItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("traktId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TraktListItem_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("traktId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchedEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "showId" INTEGER,
    "movieId" INTEGER,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "lastWatchedAt" DATETIME NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "WatchedEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchedEntry_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("traktId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WatchedEntry_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("traktId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TraktList_profileId_traktId_key" ON "TraktList"("profileId", "traktId");

-- CreateIndex
CREATE INDEX "TraktListItem_showId_idx" ON "TraktListItem"("showId");

-- CreateIndex
CREATE INDEX "TraktListItem_movieId_idx" ON "TraktListItem"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "TraktListItem_listId_type_showId_movieId_seasonNumber_episodeNumber_key" ON "TraktListItem"("listId", "type", "showId", "movieId", "seasonNumber", "episodeNumber");

-- CreateIndex
CREATE INDEX "WatchedEntry_profileId_showId_idx" ON "WatchedEntry"("profileId", "showId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchedEntry_profileId_showId_seasonNumber_episodeNumber_key" ON "WatchedEntry"("profileId", "showId", "seasonNumber", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WatchedEntry_profileId_movieId_key" ON "WatchedEntry"("profileId", "movieId");
