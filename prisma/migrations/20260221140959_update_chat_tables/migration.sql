/*
  Warnings:

  - You are about to drop the column `user1_id` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `user2_id` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `media_url` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `message_type` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `seen` on the `messages` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('private', 'group');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'video');

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_user1_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_user2_id_fkey";

-- DropIndex
DROP INDEX "unique_conversation";

-- AlterTable
ALTER TABLE "conversations" DROP COLUMN "user1_id",
DROP COLUMN "user2_id",
ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'private';

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "media_url",
DROP COLUMN "message_type",
DROP COLUMN "seen",
ADD COLUMN     "seen_at" TIMESTAMP(6),
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'text';

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" BIGSERIAL NOT NULL,
    "conversation_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "joined_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_conversation_participants_conversation" ON "conversation_participants"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_conversation_participants_user" ON "conversation_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
