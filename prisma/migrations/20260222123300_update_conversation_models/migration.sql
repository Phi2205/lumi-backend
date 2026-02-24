-- CreateEnum
CREATE TYPE "ConversationRole" AS ENUM ('owner', 'admin', 'member');

-- DropForeignKey
ALTER TABLE "conversation_participants" DROP CONSTRAINT "conversation_participants_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "conversation_participants" DROP CONSTRAINT "conversation_participants_user_id_fkey";

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "role" "ConversationRole" NOT NULL DEFAULT 'member';

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "created_by" BIGINT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(6);

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_conversation_participants_conversation" RENAME TO "conversation_participants_conversation_id_idx";

-- RenameIndex
ALTER INDEX "idx_conversation_participants_user" RENAME TO "conversation_participants_user_id_idx";
