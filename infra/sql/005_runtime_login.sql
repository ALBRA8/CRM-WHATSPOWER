-- 005_runtime_login.sql — Rol LOGIN de runtime para la aplicación (F5).
-- Fuente: MODELO_MULTI_TENANT.md §4.1 y ENTREGA_S4_4.md §7.2 (riesgo #2).
--
-- El modelo documentado define `app_runtime` como rol NOLOGIN (grupo de
-- privilegios DML) y exige que el RUNTIME de la aplicación nunca conecte con
-- el rol dueño de los objetos. Este archivo crea el rol LOGIN que los
-- despliegues usan para conectar: miembro del grupo `app_runtime`, hereda sus
-- grants (004), y no es dueño de nada → FORCE RLS le muerde y el DDL le queda
-- prohibido.
--
-- La CONTRASEÑA del rol la fija el operador en el despliegue (fuera del repo):
--   ALTER ROLE vestro_runtime PASSWORD '<secreto del gestor de secretos>';
-- Ver infra/SECRETOS.md (generación, almacenamiento y rotación) y
-- infra/README.md §5. El verificador real es apps/web/scripts/verificar-rol-runtime.mjs.
--
-- Idempotente. Ejecutar con el rol administrador DESPUÉS de 001_roles.sql
-- (necesita que el grupo exista). No concede privilegios por sí mismo: solo
-- la pertenencia al grupo y el hardening del rol.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vestro_runtime') THEN
    CREATE ROLE vestro_runtime LOGIN;
  END IF;
END
$$;

-- Pertenece al grupo documentado; hereda SELECT/INSERT/UPDATE/DELETE y USAGE
-- de secuencias (grants de 004_grants.sql, incluidos los default privileges
-- para tablas futuras).
GRANT app_runtime TO vestro_runtime;

-- Hardening explícito: el rol de runtime jamás administra el clúster.
ALTER ROLE vestro_runtime
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;

-- La conexión de runtime lleva el contexto por operación a nivel de
-- aplicación (scoped() + AsyncLocalStorage). Cuando se active la valla de BD
-- en el despliegue (003 aplicado + contexto por transacción), el fail-closed
-- de la política tenant_isolation aplica a este rol: sin
-- app.current_org fijado, cero filas (batería T2).
