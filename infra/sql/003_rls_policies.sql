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
-- S4.3 (defecto D-S43-1): la lista fija de 22 nombres no coincidía con las
-- tablas reales (solo 14 recibieron RLS; quedaban 24 tablas org-scoped sin
-- aislar, incluidas las 7 de credenciales y las 3 de OAuth). Ahora la política
-- se descubre DINÁMICAMENTE: toda tabla de public que tenga columna
-- organization_id recibe ENABLE + FORCE RLS + política tenant_isolation.
-- Las tablas globales de better-auth (user, session, account, verification)
-- y la propia organization (registro de tenants) no tienen esa columna y
-- quedan fuera automáticamente, igual que dicta MODELO_MULTI_TENANT.md §4.
-- Idempotente y seguro de ejecutar tras CADA migración que cree tablas nuevas.

DO $$
DECLARE
  t text;
  n_aplicadas int := 0;
BEGIN
  FOR t IN
    SELECT c.table_name::text
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.column_name = 'organization_id'
       AND tb.table_type = 'BASE TABLE'
       AND to_regclass(format('public.%I', c.table_name)) IS NOT NULL
       AND NOT EXISTS (
             SELECT 1 FROM pg_tables pt
              WHERE pt.schemaname = 'public'
                AND pt.tablename = c.table_name
                AND pt.rowsecurity = true
                AND EXISTS (
                  SELECT 1 FROM pg_policies pp
                   WHERE pp.schemaname = 'public'
                     AND pp.tablename = c.table_name
                     AND pp.policyname = 'tenant_isolation'
                )
           )
     ORDER BY c.table_name
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING      (organization_id = current_setting('app.current_org', true))
        WITH CHECK (organization_id = current_setting('app.current_org', true))
    $f$, t);
    n_aplicadas := n_aplicadas + 1;
    RAISE NOTICE 'RLS aplicada a %', t;
  END LOOP;
  RAISE NOTICE '003 RLS: % tablas aisladas en esta ejecución', n_aplicadas;
END
$$;

-- Verificación embebida: la batería (scripts/bateria-multi-tenant.mjs de
-- apps/web) falla si alguna tabla org-scoped queda sin RLS. Este bloque es
-- la valla estática: aborta si queda CUALQUIER tabla con organization_id sin
-- la política tenant_isolation activa.
DO $$
DECLARE
  pendientes text;
BEGIN
  SELECT string_agg(c.table_name, ', ' ORDER BY c.table_name)
    INTO pendientes
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
   WHERE c.table_schema = 'public'
     AND c.column_name = 'organization_id'
     AND tb.table_type = 'BASE TABLE'
     AND EXISTS (
       SELECT 1 FROM pg_tables pt
        WHERE pt.schemaname = 'public' AND pt.tablename = c.table_name
          AND pt.rowsecurity = false
     );
  IF pendientes IS NOT NULL THEN
    RAISE EXCEPTION '003 RLS: tablas org-scoped SIN RLS: %', pendientes;
  END IF;
END
$$;
