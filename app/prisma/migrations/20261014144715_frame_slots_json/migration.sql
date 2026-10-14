/*
  Warnings:

  - You are about to alter the column `slotsConfig` on the `Frame` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Frame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "slotCount" INTEGER NOT NULL,
    "slotsConfig" JSONB NOT NULL,
    "overlayPath" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Frame" ("id", "isActive", "name", "overlayPath", "slotCount", "slotsConfig", "slug") SELECT "id", "isActive", "name", "overlayPath", "slotCount", "slotsConfig", "slug" FROM "Frame";
DROP TABLE "Frame";
ALTER TABLE "new_Frame" RENAME TO "Frame";
CREATE UNIQUE INDEX "Frame_slug_key" ON "Frame"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
