/*
  Warnings:

  - You are about to drop the column `addressLine` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `province` on the `Address` table. All the data in the column will be lost.
  - You are about to alter the column `receiverPhone` on the `Address` table. The data in that column could be lost. The data in that column will be cast from `VarChar(15)` to `VarChar(11)`.
  - You are about to alter the column `receiverPhone` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `VarChar(15)` to `VarChar(11)`.
  - Added the required column `cityId` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plaque` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provinceId` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streetAddress` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Address" DROP COLUMN "addressLine",
DROP COLUMN "city",
DROP COLUMN "province",
ADD COLUMN     "cityId" INTEGER NOT NULL,
ADD COLUMN     "floor" VARCHAR(20),
ADD COLUMN     "neighborhood" VARCHAR(80),
ADD COLUMN     "plaque" VARCHAR(20) NOT NULL,
ADD COLUMN     "provinceId" INTEGER NOT NULL,
ADD COLUMN     "secondaryPhone" VARCHAR(11),
ADD COLUMN     "streetAddress" VARCHAR(300) NOT NULL,
ADD COLUMN     "unit" VARCHAR(20),
ALTER COLUMN "receiverPhone" SET DATA TYPE VARCHAR(11);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cityId" INTEGER,
ADD COLUMN     "floor" VARCHAR(20),
ADD COLUMN     "neighborhood" VARCHAR(80),
ADD COLUMN     "plaque" VARCHAR(20),
ADD COLUMN     "provinceId" INTEGER,
ADD COLUMN     "secondaryPhone" VARCHAR(11),
ADD COLUMN     "streetAddress" VARCHAR(300),
ADD COLUMN     "unit" VARCHAR(20),
ALTER COLUMN "receiverPhone" SET DATA TYPE VARCHAR(11),
ALTER COLUMN "province" SET DATA TYPE VARCHAR(60),
ALTER COLUMN "city" SET DATA TYPE VARCHAR(80);

-- CreateTable
CREATE TABLE "Province" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "provinceId" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Province_name_key" ON "Province"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Province_slug_key" ON "Province"("slug");

-- CreateIndex
CREATE INDEX "Province_isActive_idx" ON "Province"("isActive");

-- CreateIndex
CREATE INDEX "City_provinceId_isActive_idx" ON "City"("provinceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "City_provinceId_name_key" ON "City"("provinceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "City_provinceId_slug_key" ON "City"("provinceId", "slug");

-- CreateIndex
CREATE INDEX "Address_provinceId_idx" ON "Address"("provinceId");

-- CreateIndex
CREATE INDEX "Address_cityId_idx" ON "Address"("cityId");

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
