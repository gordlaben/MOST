-- CreateTable
CREATE TABLE "CalendarCache" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
