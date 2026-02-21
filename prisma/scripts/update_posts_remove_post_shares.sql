-- ============================================================
-- Migration: Remove post_shares table & Add original_post_id to posts
-- Date: 2026-02-20
-- Description:
--   - Drop bảng post_shares
--   - Thêm cột original_post_id vào bảng posts (self-reference)
--   - Thêm FK constraint và index tương ứng
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Drop bảng post_shares (nếu tồn tại)
-- ------------------------------------------------------------

-- Xóa indexes trước
DROP INDEX IF EXISTS idx_post_shares_post;
DROP INDEX IF EXISTS idx_post_shares_user;
DROP INDEX IF EXISTS idx_post_shares_created_at;

-- Xóa bảng
DROP TABLE IF EXISTS post_shares CASCADE;

-- ------------------------------------------------------------
-- 2. Thêm cột original_post_id vào bảng posts
-- ------------------------------------------------------------

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS original_post_id BIGINT DEFAULT NULL;

-- ------------------------------------------------------------
-- 3. Thêm Foreign Key: original_post_id -> posts.id
--    ON DELETE SET NULL: khi bài gốc bị xóa, bài share giữ lại
--                        nhưng original_post_id sẽ thành NULL
-- ------------------------------------------------------------

ALTER TABLE posts
  ADD CONSTRAINT fk_posts_original_post
    FOREIGN KEY (original_post_id)
    REFERENCES posts (id)
    ON DELETE SET NULL
    ON UPDATE NO ACTION;

-- ------------------------------------------------------------
-- 4. Tạo index cho original_post_id
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_posts_original_post
  ON posts (original_post_id);

-- ------------------------------------------------------------
-- 5. Cập nhật share_count: do post_shares không còn tồn tại,
--    reset share_count dựa trên số shared_posts (self-join)
-- ------------------------------------------------------------

UPDATE posts p
  SET share_count = (
    SELECT COUNT(*)
    FROM posts sp
    WHERE sp.original_post_id = p.id
  );

COMMIT;

-- ============================================================
-- Verify
-- ============================================================

-- Kiểm tra cột original_post_id đã được thêm
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'posts'
  AND column_name = 'original_post_id';

-- Kiểm tra bảng post_shares đã bị xóa
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'post_shares';
-- (Kết quả mong đợi: 0 rows -> đã xóa thành công)
