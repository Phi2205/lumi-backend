-- CreateTable
CREATE TABLE "message_attachments" (
    "id" BIGSERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "file_size" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_message_attachments_message" ON "message_attachments"("message_id");

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
