-- 004_grants.sql — Privilegios del rol de runtime (MODELO_MULTI_TENANT.md §4.1).
--
-- El modelo documentado exige: el DDL se ejecuta con el rol dueño de las
-- migraciones; el RUNTIME de la aplicación NUNCA es dueño de los objetos y
-- opera con `app_runtime` (sin DDL). Sin estos grants el rol no puede leer ni
-- escribir, y la doble valla (app scoped() + RLS) no es verificable end-to-end.
--
-- S4.3: completado al detectarse en la batería multi-tenant que el modelo de
-- roles documentado no podía ejecutarse (0 privilegios). Incluye:
--  1. DML sobre todas las tablas existentes de public para app_runtime.
--  2. Privilegios por defecto para las tablas creadas por migraciones futuras.
--  3. USAGE en secuencias (ids bigserial / inserts con DEFAULT).
-- Idempotente. Ejecutar tras cada migración o dejarlo cubierto por (2).
-- Nota: audit_log ya recibe sus grants específicos (SELECT, INSERT) en 002;
-- el grant de UPDATE/DELETE que pudiera tocarla aquí es inofensivo porque los
-- triggers de append-only la rechazan (probado en la batería).

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name::text
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_runtime', t);
  END LOOP;
END
$$;

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT sequencename::text FROM pg_sequences WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I TO app_runtime', s);
  END LOOP;
END
$$;

-- Tablas/secuencias futuras creadas por el rol dueño (migraciones) quedan
-- accesibles al runtime sin paso manual.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'whatspower') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE whatspower IN SCHEMA public
             GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE whatspower IN SCHEMA public
             GRANT USAGE, SELECT ON SEQUENCES TO app_runtime';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime, app_super;
