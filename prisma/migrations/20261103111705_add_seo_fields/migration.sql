/*
  Warnings:

  - You are about to drop the column `spects` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "imageAlt" VARCHAR(150),
ADD COLUMN     "metaDescription" VARCHAR(170),
ADD COLUMN     "metaTitle" VARCHAR(70);

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "spects",
ADD COLUMN     "metaDescription" VARCHAR(170),
ADD COLUMN     "metaTitle" VARCHAR(70),
ADD COLUMN     "specs" JSONB;
