/*
  Warnings:

  - You are about to drop the `Call` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Call" DROP CONSTRAINT "Call_callerId_fkey";

-- DropForeignKey
ALTER TABLE "Call" DROP CONSTRAINT "Call_receiverId_fkey";

-- DropTable
DROP TABLE "Call";

-- DropEnum
DROP TYPE "CallStatus";

-- DropEnum
DROP TYPE "CallType";
