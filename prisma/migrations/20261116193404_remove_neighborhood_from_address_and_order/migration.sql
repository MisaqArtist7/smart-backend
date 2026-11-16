/*
  Warnings:

  - You are about to drop the column `neighborhood` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `neighborhood` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Address" DROP COLUMN "neighborhood";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "neighborhood";
