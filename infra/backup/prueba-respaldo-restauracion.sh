#!/usr/bin/env bash
# prueba-respaldo-restauracion.sh — F5: ciclo REAL completo de respaldo y
# restauración con verificación (no es un ensayo: es la prueba operativa).
#
# Qué hace, en orden:
#   1. Siembra eventos de auditoría en la base origen (con contexto de org por
#      app_runtime) para que la cadena de hash tenga contenido verificable.
#   2. Respaldar: infra/backup/backup.sh (pg_dump -Fc + integridad).
#   3. Restaurar: infra/backup/restaurar.sh a una base RESTORE_DB aparte.
#   4. Verificar: apps/web/scripts/verificar-restauracion.mjs compara conteos
#      por tabla, RLS, cadena de hash y migraciones.
#
# Uso (todas las variables con defaults de desarrollo local):
#   DATABASE_URL='postgresql://vestro:...@127.0.0.1:5433/vestro' \
#   [PG_DUMP_BIN] [PG_RESTORE_BIN] [BACKUP_DIR] [RESTORE_DB] \
#   infra/backup/prueba-respaldo-restauracion.sh
#
# Exit 1 si CUALQUIER paso falla. El operador de producción corre este ciclo
# al menos una vez por entorno antes de dar el respaldo por bueno.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
WEB="$REPO_ROOT/apps/web"

: "${DATABASE_URL:?DATABASE_URL es requerida}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/vestro-backups-f5}"
RESTORE_DB="${RESTORE_DB:-vestro_f5_restaurada}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"

echo "== F5 prueba real: respaldo → restauración → verificación"
echo "   origen: $DATABASE_URL"
echo "   backup: $BACKUP_DIR · restaurada: $RESTORE_DB"

# 1. siembra de eventos de auditoría (dos organizaciones, cadena verificable)
cd "$WEB"  # node resuelve `postgres` desde apps/web
node - <<'NODE'
const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, {max:1, onnotice: () => {}});
(async () => {
  const orgs = await sql`SELECT id FROM organization ORDER BY created_at LIMIT 1`;
  const org = orgs.length ? orgs[0].id : "org_f5_backup_prueba";
  if (!orgs.length) {
    await sql`INSERT INTO organization (id, name, slug) VALUES (${org}, 'Org Prueba Backup F5', 'org-f5-backup') ON CONFLICT DO NOTHING`;
  }
  await sql.unsafe(`SET ROLE app_runtime`);
  await sql.unsafe(`SET app.current_org = '${org.replaceAll("'", "''")}'`);
  await sql`INSERT INTO audit_log (organization_id, actor_type, actor_id, action, entity, entity_id, meta)
           VALUES (${org}, 'user', 'f5_backup_test', 'backup.evidence', 'platform', 'f5', '{"prueba":"respaldo F5"}'::jsonb)`;
  await sql`INSERT INTO audit_log (organization_id, actor_type, actor_id, action, entity, entity_id, meta)
           VALUES (${org}, 'user', 'f5_backup_test', 'backup.evidence', 'platform', 'f5', '{"prueba":"respaldo F5 segundo"}'::jsonb)`;
  const n = await sql`SELECT count(*)::int n FROM audit_log WHERE organization_id = ${org}`;
  console.log(`   sembrados eventos de auditoría: org=${org} filas=${n[0].n}`);
  await sql.unsafe(`RESET ROLE`);
  await sql.end({timeout:1});
})().catch(e => { console.error("SIEMBRA_ERROR:", e.message); process.exit(1); });
NODE

# 2. respaldo
DATABASE_URL="$DATABASE_URL" BACKUP_DIR="$BACKUP_DIR" \
PG_DUMP_BIN="$PG_DUMP_BIN" PG_RESTORE_BIN="$PG_RESTORE_BIN" \
  "$HERE/backup.sh"

DUMP_FILE=$(ls -t "$BACKUP_DIR"/*.dump | head -1)
echo "== respaldo generado: $DUMP_FILE"

# 3. restauración a base aparte
DATABASE_URL="$DATABASE_URL" RESTORE_BACKUP="$DUMP_FILE" RESTORE_DB="$RESTORE_DB" \
PG_RESTORE_BIN="$PG_RESTORE_BIN" RESTORE_FRESH=1 \
  "$HERE/restaurar.sh"

# 4. verificación comparativa
RESTORE_URL=$(DATABASE_URL="$DATABASE_URL" RESTORE_DB="$RESTORE_DB" node -e "
const u = new URL(process.env.DATABASE_URL); u.pathname = '/' + process.env.RESTORE_DB; console.log(u.toString());
")
cd "$WEB"
DATABASE_URL="$DATABASE_URL" RESTORE_DATABASE_URL="$RESTORE_URL" \
  node scripts/verificar-restauracion.mjs

echo "== PRUEBA F5 COMPLETA: respaldo y restauración verificados"
