-- Sesiones: marcar última rotación e indexar la consulta de sesión activa por petición.
ALTER TABLE "user_sessions" ADD COLUMN "rotated_at" TIMESTAMPTZ(6);

CREATE INDEX "user_sessions_previous_refresh_idx"
  ON "user_sessions"("previous_refresh_token_hash", "rotated_at");

CREATE INDEX "user_sessions_active_lookup_idx"
  ON "user_sessions"("user_id", "revoked_at", "expires_at");
