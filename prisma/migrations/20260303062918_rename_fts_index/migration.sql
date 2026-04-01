-- Drop old if exists
DROP INDEX IF EXISTS "idx_messages_content_fts";

-- Create your exact requested index
CREATE INDEX idx_message_content_fts
ON "messages"
USING gin (to_tsvector('simple', "content"));