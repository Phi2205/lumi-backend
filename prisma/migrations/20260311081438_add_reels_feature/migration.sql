-- CreateTable
CREATE TABLE "reels" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "video_url" TEXT NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "thumbnail_url" TEXT,
    "thumbnail_id" VARCHAR(255),
    "caption" TEXT,
    "music_name" VARCHAR(255),
    "duration" INTEGER,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "reels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reel_likes" (
    "reel_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reel_likes_pkey" PRIMARY KEY ("reel_id","user_id")
);

-- CreateTable
CREATE TABLE "reel_comments" (
    "id" BIGSERIAL NOT NULL,
    "reel_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" BIGINT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reel_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reels_user_id_idx" ON "reels"("user_id");

-- CreateIndex
CREATE INDEX "reels_created_at_idx" ON "reels"("created_at" DESC);

-- CreateIndex
CREATE INDEX "reel_comments_reel_id_created_at_idx" ON "reel_comments"("reel_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reel_comments_parent_id_idx" ON "reel_comments"("parent_id");

-- AddForeignKey
ALTER TABLE "reels" ADD CONSTRAINT "reels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_likes" ADD CONSTRAINT "reel_likes_reel_id_fkey" FOREIGN KEY ("reel_id") REFERENCES "reels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_likes" ADD CONSTRAINT "reel_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_comments" ADD CONSTRAINT "reel_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "reel_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_comments" ADD CONSTRAINT "reel_comments_reel_id_fkey" FOREIGN KEY ("reel_id") REFERENCES "reels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reel_comments" ADD CONSTRAINT "reel_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
