-- ============================================================
-- Script: post_shares table
-- Database: PostgreSQL
-- Description: Bảng lưu thông tin share bài post của users
-- ============================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "post_shares" (
    "id"         BIGSERIAL       NOT NULL,
    "post_id"    BIGINT          NOT NULL,
    "user_id"    BIGINT          NOT NULL,
    "content"    TEXT,                                        -- Caption khi share (optional)
    "created_at" TIMESTAMP(6)    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_post_shares_post"       ON "post_shares"("post_id");
CREATE INDEX IF NOT EXISTS "idx_post_shares_user"       ON "post_shares"("user_id");
CREATE INDEX IF NOT EXISTS "idx_post_shares_created_at" ON "post_shares"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "post_shares"
    ADD CONSTRAINT "post_shares_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "post_shares"
    ADD CONSTRAINT "post_shares_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

-- ============================================================
-- Trigger: tự động tăng share_count trên bảng posts
-- ============================================================

CREATE OR REPLACE FUNCTION increment_share_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts
    SET share_count = share_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_increment_share_count
AFTER INSERT ON "post_shares"
FOR EACH ROW
EXECUTE FUNCTION increment_share_count();

-- ============================================================
-- Trigger: tự động giảm share_count khi xóa share
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_share_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts
    SET share_count = GREATEST(share_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_decrement_share_count
AFTER DELETE ON "post_shares"
FOR EACH ROW
EXECUTE FUNCTION decrement_share_count();

-- ============================================================
-- Helper queries
-- ============================================================

-- Lấy danh sách người đã share một post (có phân trang)
-- SELECT
--     ps.id,
--     ps.post_id,
--     ps.user_id,
--     ps.content,
--     ps.created_at,
--     u.name,
--     u.username,
--     u.avatar_url
-- FROM post_shares ps
-- JOIN users u ON u.id = ps.user_id
-- WHERE ps.post_id = :post_id
-- ORDER BY ps.created_at DESC
-- LIMIT :limit OFFSET :offset;

-- Đếm tổng số share của một post
-- SELECT COUNT(*) FROM post_shares WHERE post_id = :post_id;

-- Kiểm tra user đã share post chưa
-- SELECT EXISTS (
--     SELECT 1 FROM post_shares
--     WHERE post_id = :post_id AND user_id = :user_id
-- );
