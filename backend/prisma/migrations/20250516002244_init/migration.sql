/*
  Warnings:

  - You are about to drop the column `channelName` on the `Call` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Call_channelName_key";

-- AlterTable
ALTER TABLE "Call" DROP COLUMN "channelName";
