-- DropIndex
DROP INDEX "idx_messages_conversation";

-- DropIndex
DROP INDEX "idx_messages_created_at";

-- CreateIndex
CREATE INDEX "idx_messages_conv_created" ON "messages"("conversation_id", "created_at" DESC);

-- Create FTS Index
CREATE INDEX "idx_messages_content_fts" ON "messages" USING gin (to_tsvector('simple', "content"));
