CREATE TABLE "social_identities" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "social_identities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "social_identities_provider_subject_key" ON "social_identities"("provider", "subject");
CREATE INDEX "social_identities_user_id_idx" ON "social_identities"("user_id");
