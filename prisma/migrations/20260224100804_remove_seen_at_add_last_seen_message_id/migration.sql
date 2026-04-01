/*
  Warnings:

  - You are about to drop the column `seen_at` on the `messages` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "last_seen_message_id" BIGINT;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "seen_at";
