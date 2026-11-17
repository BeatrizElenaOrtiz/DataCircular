-- GRUPO 4: aceptación de términos, reportes/moderación, bloqueos y purga de cuentas.
ALTER TABLE "users" ADD COLUMN "purged_at" TIMESTAMPTZ(6);

CREATE TYPE "TermsAcceptanceSource" AS ENUM ('EXPLICIT', 'LEGACY_IMPLICIT');
CREATE TYPE "ModerationTargetType" AS ENUM ('PUBLICATION', 'CONVERSATION', 'PROFILE');
CREATE TYPE "ModerationReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

CREATE TABLE "terms_acceptances" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "version" VARCHAR(100) NOT NULL,
  "accepted_at" TIMESTAMPTZ(6) NOT NULL,
  "source" "TermsAcceptanceSource" NOT NULL DEFAULT 'EXPLICIT',
  "document_url" TEXT,

  CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "terms_acceptances_user_id_key" ON "terms_acceptances"("user_id");
CREATE INDEX "terms_acceptances_version_accepted_at_idx" ON "terms_acceptances"("version", "accepted_at");

CREATE TABLE "moderation_reports" (
  "id" UUID NOT NULL,
  "reporter_id" UUID NOT NULL,
  "target_type" "ModerationTargetType" NOT NULL,
  "target_id" UUID NOT NULL,
  "reason" VARCHAR(100) NOT NULL,
  "details" TEXT,
  "status" "ModerationReportStatus" NOT NULL DEFAULT 'PENDING',
  "resolution" VARCHAR(100),
  "resolved_by_user_id" UUID,
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "moderation_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "moderation_reports_status_created_at_idx" ON "moderation_reports"("status", "created_at");
CREATE INDEX "moderation_reports_target_type_target_id_idx" ON "moderation_reports"("target_type", "target_id");

CREATE TABLE "user_blocks" (
  "id" UUID NOT NULL,
  "blocker_id" UUID NOT NULL,
  "blocked_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_id_key" ON "user_blocks"("blocker_id", "blocked_id");
CREATE INDEX "user_blocks_blocked_id_idx" ON "user_blocks"("blocked_id");

ALTER TABLE "terms_acceptances"
  ADD CONSTRAINT "terms_acceptances_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "moderation_reports"
  ADD CONSTRAINT "moderation_reports_reporter_id_fkey"
  FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "moderation_reports"
  ADD CONSTRAINT "moderation_reports_resolved_by_user_id_fkey"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_blocks"
  ADD CONSTRAINT "user_blocks_blocker_id_fkey"
  FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks"
  ADD CONSTRAINT "user_blocks_blocked_id_fkey"
  FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
