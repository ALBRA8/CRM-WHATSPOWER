-- 002_audit_log.sql — Bitácora de auditoría tamper-evident por organización
-- Fuente: MODELO_MULTI_TENANT.md §2 («auditoría propia, append-only tamper-evident»)
-- y CONTRATOS_INTEGRACION.md §1 (toda operación queda en audit_log).
-- Requiere pgcrypto para el hash encadenado.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_log (
  id              bigserial PRIMARY KEY,
  organization_id text        NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  actor_type      text        NOT NULL,  -- user | api_key | agent | webhook | system
  actor_id        text        NOT NULL,
  action          text        NOT NULL,  -- p. ej. 'conversation.handoff', 'switch-organization'
  entity          text        NOT NULL,
  entity_id       text,
  request_id      text,
  meta            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  prev_hash       text,                   -- hash de la fila anterior de la misma organización
  hash            text        NOT NULL    -- sha256(prev_hash || fila), cadena por organización
);

-- Índice org-first (regla §4.4 del modelo multi-tenant).
CREATE INDEX IF NOT EXISTS audit_log_org_time_idx ON audit_log (organization_id, occurred_at DESC);

-- Hash encadenado: cada fila encadena con la anterior de SU organización.
CREATE OR REPLACE FUNCTION audit_log_compute_hash() RETURNS trigger AS $$
DECLARE
  v_prev text;
  v_row  text;
BEGIN
  SELECT hash INTO v_prev
    FROM audit_log
   WHERE organization_id = NEW.organization_id
   ORDER BY id DESC
   LIMIT 1;

  v_row := concat_ws('|',
    COALESCE(v_prev, ''),
    NEW.organization_id,
    NEW.actor_type,
    NEW.actor_id,
    NEW.action,
    NEW.entity,
    COALESCE(NEW.entity_id, ''),
    COALESCE(NEW.request_id, ''),
    to_char(NEW.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    NEW.meta::text
  );

  NEW.prev_hash := v_prev;
  NEW.hash := encode(digest(v_row, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_hash ON audit_log;
CREATE TRIGGER trg_audit_log_hash
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_compute_hash();

-- Append-only: rechaza UPDATE y DELETE sobre la bitácora.
CREATE OR REPLACE FUNCTION audit_log_deny_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es append-only: % prohibido', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_deny_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log;
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_deny_mutation();

-- Aislamiento por organización (RLS) — la valla de la BD.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON audit_log;
CREATE POLICY tenant_isolation ON audit_log
  USING      (organization_id = current_setting('app.current_org', true))
  WITH CHECK (organization_id = current_setting('app.current_org', true));

-- Super-admin con contexto explícito y auditado (§4.3): su acceso siempre lleva
-- una fila en audit_log con action='switch-organization' y motivo en meta.
DROP POLICY IF EXISTS super_admin_access ON audit_log;
CREATE POLICY super_admin_access ON audit_log
  USING (current_setting('app.super_admin', true) = 'on'
         AND current_setting('app.super_admin_org', true) = 'platform');

GRANT SELECT, INSERT ON audit_log TO app_runtime;
GRANT SELECT ON audit_log TO app_super;
