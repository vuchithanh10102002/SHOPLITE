/*
  Warnings:

  - Added the required column `name_normalized` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "name_normalized" TEXT NOT NULL;
