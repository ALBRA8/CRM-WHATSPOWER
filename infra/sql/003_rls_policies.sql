-- 003_rls_policies.sql — Plantilla idempotente de políticas RLS por tenant.
-- Fuente: MODELO_MULTI_TENANT.md §4.2 y §4.4.
--
-- Reglas del esquema:
-- 1. Toda tabla de dominio lleva organization_id NOT NULL + índice org-first.
-- 2. RLS con FORCE (también para el dueño de la tabla).
-- 3. Fail-closed: current_setting('app.current_org', true) devuelve NULL si no
--    se fijó → la política no coincide → cero filas.
-- 4. Unicidades siempre compuestas por organización.
--
-- Este script aplica la política estándar a la lista de tablas de dominio si
-- existen. Es idempotente y se ejecuta tras cada migración que cree tablas
-- nuevas (el Drizzle de apps/web crea las tablas; esta plantilla aísla).
-- Verificación real de la batería T1-T15: Fase 5 (CI sobre PostgreSQL real).

DO $$
DECLARE
  t text;
  domain_tables text[] := ARRAY[
    'contact', 'company', 'lead', 'pipeline_stage', 'lead_stage_event',
    'conversation', 'conversation_note', 'message', 'dispatch', 'channel_connection',
    'agent_profile', 'kb_entry', 'calendar_settings', 'booking', 'api_key',
    'subscription', 'task', 'automation', 'campaign', 'webhook_event',
    'usage_record', 'agent_memory'
  ];
BEGIN
  FOREACH t IN ARRAY domain_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
      EXECUTE format($f$
        CREATE POLICY tenant_isolation ON %I
          USING      (organization_id = current_setting('app.current_org', true))
          WITH CHECK (organization_id = current_setting('app.current_org', true))
      $f$, t);
      RAISE NOTICE 'RLS aplicada a %', t;
    ELSE
      RAISE NOTICE 'tabla % no existe aún: la política se aplicará cuando se cree', t;
    END IF;
  END LOOP;
END
$$;

-- Las 3 tablas de sesión de auth (better-auth) quedan FUERA del modelo de
-- tenant según el modelo multi-tenant §4: no reciben política tenant_isolation.
