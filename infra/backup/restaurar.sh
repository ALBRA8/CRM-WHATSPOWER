#!/usr/bin/env bash
# restaurar.sh — Restauración REAL de un respaldo a una base de trabajo (F5).
#
# Qué: crea (o recrea) una base destino y aplica pg_restore del .dump.
# Por qué existe: un respaldo que nunca se restauró es una esperanza, no un
# respaldo. Este script + verificar-restauracion.mjs son la prueba real.
#
# Uso:
#   DATABASE_URL='postgresql://usuario:secreto@host:5432/vestro' \
#   RESTORE_BACKUP=/ruta/respaldo.dump \
#   RESTORE_DB=vestro_restaurado \
#   [PG_RESTORE_BIN=/ruta/pg_restore] \
#   infra/backup/restaurar.sh
#
# Variables:
#   DATABASE_URL    conexión administrativa al servidor (REQUERIDA). La base a
#                   restaurar se deriva del .dump; RESTORE_DB nombra el destino.
#   RESTORE_BACKUP  ruta del .dump a restaurar (REQUERIDA)
#   RESTORE_DB      nombre de la base destino (default vestro_restaurado)
#   RESTORE_FRESH   1 (default) borra la base destino antes de restaurar
#   PG_RESTORE_BIN  ruta de pg_restore (default: pg_restore en el PATH)
#
# NOTA OPERATIVA: la restauración corre contra el servidor REAL, no en la base
# de producción abierta: el destino es una base aparte. Para «levantar el CRM
# desde el respaldo» el operador apunta DATABASE_URL de la app a la base
# restaurada (procedimiento en infra/README.md §6).
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ] || [ -z "${RESTORE_BACKUP:-}" ]; then
  echo "ERROR: DATABASE_URL y RESTORE_BACKUP son requeridas" >&2
  exit 2
fi

RESTORE_DB="${RESTORE_DB:-vestro_restaurado}"
FRESH="${RESTORE_FRESH:-1}"
PG_RESTORE="${PG_RESTORE_BIN:-pg_restore}"

[ -f "$RESTORE_BACKUP" ] || { echo "ERROR: no existe $RESTORE_BACKUP" >&2; exit 2; }

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
ADMIN_URL=$(DATABASE_URL="$DATABASE_URL" node -e "
const u = new URL(process.env.DATABASE_URL);
u.pathname = '/postgres';
console.log(u.toString());
")

log "creando base destino $RESTORE_DB (fresh=$FRESH)"
DATABASE_URL="$ADMIN_URL" node -e "
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, {max:1, onnotice: () => {}});
(async () => {
  if (process.env.RESTORE_FRESH === '1') {
    await sql.unsafe('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = \$1 AND pid <> pg_backend_pid()', [process.env.RESTORE_DB]).catch(() => {});
    await sql.unsafe('DROP DATABASE IF EXISTS ' + JSON.stringify(process.env.RESTORE_DB).replace(/\\\"/g,'\"'));
  }
  const existe = await sql\`SELECT 1 FROM pg_database WHERE datname = \${process.env.RESTORE_DB}\`;
  if (existe.length === 0) await sql.unsafe('CREATE DATABASE ' + JSON.stringify(process.env.RESTORE_DB).replace(/\\\"/g,'\"'));
  await sql.end({timeout:1});
})().catch(e => { console.error(e.message); process.exit(1); });
"

RESTORE_URL=$(DATABASE_URL="$DATABASE_URL" RESTORE_DB="$RESTORE_DB" node -e "
const u = new URL(process.env.DATABASE_URL);
u.pathname = '/' + process.env.RESTORE_DB;
console.log(u.toString());
")

log "pg_restore → $RESTORE_DB"
"$PG_RESTORE" --no-owner --no-privileges -d "$RESTORE_URL" "$RESTORE_BACKUP"
log "restauración OK: base $RESTORE_DB lista para verificar"
echo "RESTORE_DB=$RESTORE_DB"
