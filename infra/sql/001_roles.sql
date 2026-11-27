-- 001_roles.sql — Roles de base de datos del modelo multi-tenant
-- Fuente: MODELO_MULTI_TENANT.md §4.1. El rol de la aplicación NUNCA es dueño
-- de los objetos; el DDL se ejecuta con app_migrations, el runtime con app_runtime.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_migrations') THEN
    CREATE ROLE app_migrations NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_super') THEN
    CREATE ROLE app_super NOLOGIN;  -- super-admin con switch-organization auditado
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime, app_super;

-- Los privilegios de tablas se conceden por migración tras crear cada tabla:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON <tabla> TO app_runtime;
-- El super-admin opera con la política super_admin_access (003) y auditoría obligatoria.
