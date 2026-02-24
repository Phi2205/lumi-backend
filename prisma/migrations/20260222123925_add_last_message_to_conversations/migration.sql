-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "last_message" TEXT,
ADD COLUMN     "last_sender_id" BIGINT;
