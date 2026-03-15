/*
  Warnings:

  - You are about to drop the column `location` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "location";

-- CreateTable
CREATE TABLE "user_locations" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "place_name" VARCHAR(255),
    "address" TEXT,
    "place_id" VARCHAR(100),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "user_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_locations_user_id_key" ON "user_locations"("user_id");

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
