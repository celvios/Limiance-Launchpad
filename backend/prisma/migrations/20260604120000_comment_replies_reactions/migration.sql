ALTER TABLE "Comment"
  ADD COLUMN IF NOT EXISTS "parentId" TEXT,
  ADD COLUMN IF NOT EXISTS "likes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dislikes" INTEGER NOT NULL DEFAULT 0;

UPDATE "Comment"
SET "likes" = "upvotes"
WHERE "likes" = 0 AND "upvotes" > 0;

CREATE INDEX IF NOT EXISTS "Comment_parentId_idx" ON "Comment"("parentId");

CREATE TABLE IF NOT EXISTS "CommentReaction" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommentReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommentReaction_commentId_walletAddress_key"
  ON "CommentReaction"("commentId", "walletAddress");

CREATE INDEX IF NOT EXISTS "CommentReaction_commentId_idx" ON "CommentReaction"("commentId");
CREATE INDEX IF NOT EXISTS "CommentReaction_walletAddress_idx" ON "CommentReaction"("walletAddress");
