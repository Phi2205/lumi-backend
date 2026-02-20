/*
  Warnings:

  - You are about to drop the `post_shares` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "post_shares" DROP CONSTRAINT "post_shares_post_id_fkey";

-- DropForeignKey
ALTER TABLE "post_shares" DROP CONSTRAINT "post_shares_user_id_fkey";

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "original_post_id" BIGINT;

-- DropTable
DROP TABLE "post_shares";

-- CreateIndex
CREATE INDEX "idx_posts_original_post" ON "posts"("original_post_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_original_post_id_fkey" FOREIGN KEY ("original_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
