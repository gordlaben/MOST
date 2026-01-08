-- AlterTable
ALTER TABLE "Show" ADD COLUMN "certification" TEXT;
ALTER TABLE "Show" ADD COLUMN "genres" TEXT;
ALTER TABLE "Show" ADD COLUMN "homepage" TEXT;
ALTER TABLE "Show" ADD COLUMN "images" TEXT;
ALTER TABLE "Show" ADD COLUMN "language" TEXT;
ALTER TABLE "Show" ADD COLUMN "network" TEXT;
ALTER TABLE "Show" ADD COLUMN "overview" TEXT;
ALTER TABLE "Show" ADD COLUMN "rating" REAL;
ALTER TABLE "Show" ADD COLUMN "runtime" INTEGER;
ALTER TABLE "Show" ADD COLUMN "status" TEXT;
ALTER TABLE "Show" ADD COLUMN "trailer" TEXT;
ALTER TABLE "Show" ADD COLUMN "votes" INTEGER;
ALTER TABLE "Show" ADD COLUMN "year" INTEGER;

-- CreateTable
CREATE TABLE "Movie" (
    "traktId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "imdbId" TEXT,
    "tmdbId" INTEGER,
    "overview" TEXT,
    "year" INTEGER,
    "released" TEXT,
    "runtime" INTEGER,
    "tagline" TEXT,
    "genres" TEXT,
    "certification" TEXT,
    "status" TEXT,
    "rating" REAL,
    "votes" INTEGER,
    "trailer" TEXT,
    "homepage" TEXT,
    "language" TEXT,
    "images" TEXT,
    "updatedAt" DATETIME NOT NULL
);
