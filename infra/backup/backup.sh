#!/usr/bin/env bash
# backup.sh — Respaldo de la base del CRM (F5).
#
# Qué: pg_dump en formato CUSTOM (-Fc, comprimido y restaurable con pg_restore)
# de la base documentada en DATABASE_URL, con retención por días y bitácora.
# Por qué custom: restauración selectiva por tabla y paralela (--jobs), y es el
# formato que la prueba real de restauración (verificar-restauracion.mjs) valida.
#
# Uso:
#   DATABASE_URL='postgresql://usuario:secreto@host:5432/whatspower' \
#   BACKUP_DIR=/var/backups/whatspower \
#   BACKUP_RETENTION_DAYS=14 \
#   [PG_DUMP_BIN=/ruta/pg_dump] \
#   infra/backup/backup.sh
#
# Variables (todas con default operativo):
#   DATABASE_URL           conexión a la base a respaldar (REQUERIDA)
#   BACKUP_DIR             destino (default /var/backups/whatspower)
#   BACKUP_RETENTION_DAYS  días a conservar (default 14)
#   PG_DUMP_BIN            ruta de pg_dump (default: pg_dump en el PATH)
#   PG_RESTORE_BIN         ruta de pg_restore (default: pg_restore en el PATH)
#
# Programación (producción): ver infra/README.md §6 — cron o systemd timer
# (ejemplos incluidos). El respaldo NUNCA contiene secretos de la app: solo la
# base. La bitácora va a $BACKUP_DIR/backup.log.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL es requerida" >&2
  exit 2
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/whatspower}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
PG_DUMP="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE="${PG_RESTORE_BIN:-pg_restore}"

mkdir -p "$BACKUP_DIR"
log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$BACKUP_DIR/backup.log"; }

STAMP=$(date -u '+%Y%m%dT%H%M%SZ')
DBNAME=$(DATABASE_URL="$DATABASE_URL" node -e "console.log(new URL(process.env.DATABASE_URL).pathname.replace(/^\//,'')||'whatspower')" 2>/dev/null || echo "whatspower")
FILE="$BACKUP_DIR/${DBNAME}_${STAMP}.dump"

log "inicio respaldo base=$DBNAME destino=$FILE"
"$PG_DUMP" --version >>"$BACKUP_DIR/backup.log" 2>&1

"$PG_DUMP" -Fc --no-owner --no-privileges \
  -d "$DATABASE_URL" \
  -f "$FILE"

SIZE=$(du -h "$FILE" | cut -f1)
log "respaldo terminado archivo=$(basename "$FILE") tamaño=$SIZE"

# Integridad: pg_restore --list debe leer el archivo sin errores.
if "$PG_RESTORE" --list "$FILE" >/dev/null 2>&1; then
  log "integridad OK (pg_restore --list legible)"
else
  log "ERROR: el respaldo no es legible por pg_restore — NO CONFIAR en él"
  exit 1
fi

# Retención: borrar respaldos más viejos que RETENTION días.
if [ "$RETENTION" -gt 0 ]; then
  BORRADOS=$(find "$BACKUP_DIR" -name "${DBNAME}_*.dump" -type f -mtime "+$RETENTION" -print -delete | wc -l)
  log "retención $RETENTION días: $BORRADOS respaldos eliminados"
fi

log "OK: $(basename "$FILE")"
