-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "password" TEXT NOT NULL,
    "traktAccessToken" TEXT,
    "traktRefreshToken" TEXT,
    "traktExpiresAt" TEXT,
    "rpdbKey" TEXT,
    "filters" TEXT,
    "manifestVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
