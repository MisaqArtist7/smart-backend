-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "postalCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "postalCode" DROP NOT NULL;
