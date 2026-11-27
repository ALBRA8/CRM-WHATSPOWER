# Infraestructura — PostgreSQL 16, RLS, auditoría y operación (F5)

## Componentes

| Archivo | Propósito |
|---|---|
| `docker-compose.yml` | PostgreSQL 16 de desarrollo (puerto 5433; credencial solo local) |
| `sql/001_roles.sql` | Roles `app_runtime` (runtime, sin DDL), `app_migrations` (dueño de objetos) y `app_super` (switch-organization auditado) — MODELO_MULTI_TENANT §4.1 |
| `sql/002_audit_log.sql` | Tabla `audit_log` org-scoped, append-only con hash encadenado (pgcrypto) y triggers que rechazan UPDATE/DELETE; RLS con `FORCE` |
| `sql/003_rls_policies.sql` | Plantilla idempotente de política `tenant_isolation` para las tablas de dominio existentes (fail-closed con `current_setting('app.current_org', true)`) |
| `sql/004_grants.sql` | Grants DML de `app_runtime` sobre todas las tablas/secuencias + default privileges para tablas futuras |
| `sql/005_runtime_login.sql` | **F5** — rol LOGIN `vestro_runtime` (miembro de `app_runtime`, `NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS`) con el que la app puede conectarse sin ser dueña de objetos |
| `backup/backup.sh` | **F5** — respaldo `pg_dump -Fc` con retención por días, bitácora y verificación de integridad (`pg_restore --list`) |
| `backup/restaurar.sh` | **F5** — restauración real del `.dump` a una base aparte |
| `backup/prueba-respaldo-restauracion.sh` | **F5** — ciclo completo: siembra → respaldo → restauración → verificación comparativa |
| `backup/prueba-persistencia-recuperacion.sh` | **F5** — persistencia tras reinicio controlado y recuperación tras crash real (SIGKILL + replay de WAL) |

## Uso

```bash
pnpm infra:up          # levanta PostgreSQL 16 con los SQL aplicados
# Conexión: postgresql://vestro:vestro_dev_only@localhost:5433/vestro
```

## 5. Rol de runtime con privilegios mínimos (F5)

El modelo (MODELO_MULTI_TENANT §4.1) exige que el runtime NUNCA sea dueño de
los objetos. La cadena completa:

1. `001` crea el grupo `app_runtime` (NOLOGIN, sin DDL).
2. `004` le concede SELECT/INSERT/UPDATE/DELETE sobre tablas y USAGE sobre
   secuencias (incluidas las futuras, por default privileges).
3. `005` crea el rol LOGIN `vestro_runtime`, miembro del grupo, sin privilegios
   de administración y sin `BYPASSRLS`.
4. La app conecta con `DATABASE_URL_RUNTIME` si el despliegue la define
   (`apps/web/src/lib/db/index.ts`); sin ella sigue usando `DATABASE_URL` como
   siempre (comportamiento de S4.3/S4.4 intacto).
5. Verificación real: `apps/web/scripts/verificar-rol-runtime.mjs`
   (`pnpm --filter @vestro/web test:rol-runtime`) prueba contra PostgreSQL real
   que el rol: solo tiene DML+secuencias (R2), el DDL le queda prohibido (R3),
   la valla RLS le muerde — sin contexto 0 filas, cruzado 0 filas/42501 (R4),
   el DML dentro de su org y las secuencias funcionan (R5), audit_log sigue
   append-only (R6) y la app puede arrancar con esa URL (R7).

**Nota honesta (pendiente operativo):** activar el rol de runtime como
conexión única del HTTP de la app exige propagar `app.current_org` en cada
operación sobre el pool (SET LOCAL por transacción, MODELO_MULTI_TENANT §5.3).
La app hoy aisla con `scoped()` + AsyncLocalStorage (primera valla) y la valla
de BD está probada como segunda valla (batería 26/26 + R1-R7). El corte
completo de rol queda como trabajo operativo declarado, no como hecho.

## 6. Backups, restauración y recuperación (F5)

```bash
# ciclo completo recomendado (al menos una vez por entorno antes de producción):
DATABASE_URL='postgresql://...' PG_DUMP_BIN=pg_dump PG_RESTORE_BIN=pg_restore \
  infra/backup/prueba-respaldo-restauracion.sh

# persistencia tras reinicio + recuperación tras crash real:
DATABASE_URL='postgresql://...' PG_BIN=<binarios servidor> PGDATA=<cluster> \
  infra/backup/prueba-persistencia-recuperacion.sh
```

Programación del respaldo automático (producción):

- **cron**: `0 2 * * * DATABASE_URL='postgresql://...' BACKUP_DIR=/var/backups/vestro BACKUP_RETENTION_DAYS=14 PG_DUMP_BIN=/usr/bin/pg_dump /opt/vestro/infra/backup/backup.sh >> /var/log/vestro-backup.log 2>&1`
- **systemd timer**: unidad `vestro-backup.service` (`Type=oneshot`, mismo
  Environment que arriba, ExecStart=backup.sh) + `vestro-backup.timer`
  (`OnCalendar=*-*-* 02:00:00`, `Persistent=true`).
- **Docker**: sidecar `pg_dump` programado o respaldo gestionado por la
  plataforma; el `.dump` resultante debe ir a almacenamiento externo (regla
  3-2-1) — el respaldo en el MISMO host no es un respaldo.
- El despliegue del CRM debe probar la restauración (`prueba-respaldo-...`)
  cada vez que cambia la versión de PostgreSQL o la estrategia de respaldo.

Qué se verificó en la corrida F5 (PostgreSQL 16.16 real, ver
ENTREGA_F5.md §pruebas): 44/44 tablas con conteos idénticos tras restaurar,
RLS 39/39 con FORCE restaurado, cadena de hash de audit_log íntegra,
34 migraciones, base operable; persistencia tras reinicio controlado y
recuperación tras SIGKILL con replay de WAL, marcador y cadena intactos.

## 7. Backplane SSE multi-instancia (F5)

`SSE_BACKPLANE=postgres` enciende el backplane (LISTEN/NOTIFY de la MISMA
PostgreSQL, sin servicios nuevos): los eventos de bandeja atraviesan
instancias y cada instancia entrega cada evento exactamente una vez. `off`
(default) conserva el bus in-process verificado en S3/S4. Detalles y límites
(payload 8 KB con compresión gzip automática) en
`apps/web/src/server/conversations/events/backplane.ts`; estado visible en
`/api/health` (`sse.mode`, `sse.connected`, contadores).

## Reglas de operación

1. La aplicación NUNCA se conecta con el rol dueño de los objetos: en
   producción, `DATABASE_URL_RUNTIME` apunta a `vestro_runtime` (005).
2. `SET LOCAL app.current_org = '<orgId>'` al inicio de cada transacción (sin fugas de pool).
3. Ninguna migración destructiva sin backup + revisión + staging (P-009).
4. El super-admin opera con su propio rol y con auditoría obligatoria de cada acceso.
5. Un respaldo que nunca se restauró no es un respaldo: correr el ciclo de
   restauración verificada tras cada cambio de versión de BD o de estrategia.
