-- CreateTable
CREATE TABLE "CountryInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "CountryInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CountryInterest_countryCode_notifiedAt_idx" ON "CountryInterest"("countryCode", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CountryInterest_userId_countryCode_key" ON "CountryInterest"("userId", "countryCode");

-- AddForeignKey
ALTER TABLE "CountryInterest" ADD CONSTRAINT "CountryInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
