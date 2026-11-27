# Infraestructura — PostgreSQL 16, RLS y auditoría

## Componentes

| Archivo | Propósito |
|---|---|
| `docker-compose.yml` | PostgreSQL 16 de desarrollo (puerto 5433; credencial solo local) |
| `sql/001_roles.sql` | Roles `app_runtime` (runtime, sin DDL), `app_migrations` (dueño de objetos) y `app_super` (switch-organization auditado) — MODELO_MULTI_TENANT §4.1 |
| `sql/002_audit_log.sql` | Tabla `audit_log` org-scoped, append-only con hash encadenado (pgcrypto) y triggers que rechazan UPDATE/DELETE; RLS con `FORCE` |
| `sql/003_rls_policies.sql` | Plantilla idempotente de política `tenant_isolation` para las tablas de dominio existentes (fail-closed con `current_setting('app.current_org', true)`) |

## Uso

```bash
pnpm infra:up          # levanta PostgreSQL 16 con los SQL aplicados
# Conexión: postgresql://vestro:vestro_dev_only@localhost:5433/vestro
```

## Estado de verificación (honesto)

- **Aplicado en etapa 1 (F4):** los scripts son idempotentes y se ejecutan al
  inicializar el contenedor. No hay Docker en el sandbox de construcción: la
  ejecución real queda pendiente para la Fase 5.
- **Fase 5 (S5.1-S5.3):** aquí corre la batería completa **T1-T15** sobre este
  PostgreSQL real y el pipeline la exige en verde. La prueba T2 («sin contexto
  → 0 filas») es el comportamiento por diseño de las políticas.

## Reglas de operación

1. La aplicación NUNCA se conecta con el rol dueño de los objetos.
2. `SET LOCAL app.current_org = '<orgId>'` al inicio de cada transacción (sin fugas de pool).
3. Ninguna migración destructiva sin backup + revisión + staging (P-009).
4. El super-admin opera con su propio rol y con auditoría obligatoria de cada acceso.
