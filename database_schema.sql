-- Create Enums
CREATE TYPE "FriendRequestStatus" AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- Create Tables

-- Table: users
CREATE TABLE "users" (
    "id" BIGSERIAL PRIMARY KEY,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "avatar_url" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(100) NOT NULL
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Table: posts
CREATE TABLE "posts" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" BIGINT NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "idx_posts_created_at" ON "posts"("created_at" DESC);
CREATE INDEX "idx_posts_user" ON "posts"("user_id");

-- Table: comments
CREATE TABLE "comments" (
    "id" BIGSERIAL PRIMARY KEY,
    "post_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Table: conversations
CREATE TABLE "conversations" (
    "id" BIGSERIAL PRIMARY KEY,
    "user1_id" BIGINT NOT NULL,
    "user2_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "conversations_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "unique_conversation" ON "conversations"("user1_id", "user2_id");

-- Table: follows
CREATE TABLE "follows" (
    "follower_id" BIGINT NOT NULL,
    "following_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("follower_id", "following_id"),
    CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Table: messages
CREATE TABLE "messages" (
    "id" BIGSERIAL PRIMARY KEY,
    "conversation_id" BIGINT NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "content" TEXT,
    "media_url" TEXT,
    "message_type" VARCHAR(10) DEFAULT 'text',
    "seen" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "idx_messages_conversation" ON "messages"("conversation_id");
CREATE INDEX "idx_messages_created_at" ON "messages"("created_at" DESC);

-- Table: post_likes
CREATE TABLE "post_likes" (
    "post_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("post_id", "user_id"),
    CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Table: post_media
CREATE TABLE "post_media" (
    "id" BIGSERIAL PRIMARY KEY,
    "post_id" BIGINT NOT NULL,
    "media_url" TEXT NOT NULL,
    "media_type" VARCHAR(10) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "idx_post_media_post" ON "post_media"("post_id");
CREATE INDEX "idx_post_media_order" ON "post_media"("post_id", "order");

-- Table: stories
CREATE TABLE "stories" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" BIGINT NOT NULL,
    "media_url" TEXT NOT NULL,
    "media_type" VARCHAR(10),
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "idx_stories_expires" ON "stories"("expires_at");
CREATE INDEX "idx_stories_user" ON "stories"("user_id");

-- Table: story_views
CREATE TABLE "story_views" (
    "story_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "viewed_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("story_id", "user_id"),
    CONSTRAINT "story_views_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "story_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Table: friend_requests
CREATE TABLE "friend_requests" (
    "requester_id" BIGINT NOT NULL,
    "receiver_id" BIGINT NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(6),
    PRIMARY KEY ("requester_id", "receiver_id"),
    CONSTRAINT "friend_requests_requester_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "friend_requests_receiver_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Table: friends
CREATE TABLE "friends" (
    "user_id" BIGINT NOT NULL,
    "friend_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("user_id", "friend_id"),
    CONSTRAINT "friends_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "friends_friend_fkey" FOREIGN KEY ("friend_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ----------------------------------------------------
-- Extra Script: User Interaction Events
-- ----------------------------------------------------

-- PostgreSQL init for Lumi CF: user-to-user interaction events
-- Assumes you already have a `users` table with primary key `id` (BIGINT recommended).
-- If your users PK type/name differs, adjust the REFERENCES lines.

CREATE TABLE IF NOT EXISTS user_interaction_events (
  id              BIGSERIAL PRIMARY KEY,

  actor_user_id   BIGINT NOT NULL REFERENCES users(id),
  target_user_id  BIGINT NOT NULL REFERENCES users(id),

  event_type      TEXT NOT NULL,                 -- like/comment/share/message/view/...
  event_value     DOUBLE PRECISION,              -- optional: score/count/seconds...

  content_id      BIGINT,                        -- optional: post/comment/thread id...
  session_id      TEXT,                          -- optional: for view dedup

  occurred_at     TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT chk_no_self_interaction CHECK (actor_user_id <> target_user_id)
);

-- Common query patterns:
-- 1) Pull recent events by actor (training/export)
CREATE INDEX IF NOT EXISTS idx_uie_actor_time
  ON user_interaction_events (actor_user_id, occurred_at DESC);

-- 2) Pull recent events by target (analytics/moderation)
CREATE INDEX IF NOT EXISTS idx_uie_target_time
  ON user_interaction_events (target_user_id, occurred_at DESC);

-- 3) Pull pair timeline (debugging/features)
CREATE INDEX IF NOT EXISTS idx_uie_pair_time
  ON user_interaction_events (actor_user_id, target_user_id, occurred_at DESC);

-- 4) Pull by event type in time range (ETL)
CREATE INDEX IF NOT EXISTS idx_uie_type_time
  ON user_interaction_events (event_type, occurred_at DESC);

-- Optional: if you expect huge `view` volume, you can add BRIN index by time for range scans:
-- CREATE INDEX IF NOT EXISTS brin_uie_occurred_at
--   ON user_interaction_events USING BRIN (occurred_at);
