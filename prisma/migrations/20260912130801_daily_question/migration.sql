-- CreateTable
CREATE TABLE "PollAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollAnswer_day_questionId_idx" ON "PollAnswer"("day", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PollAnswer_userId_day_key" ON "PollAnswer"("userId", "day");

-- AddForeignKey
ALTER TABLE "PollAnswer" ADD CONSTRAINT "PollAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
