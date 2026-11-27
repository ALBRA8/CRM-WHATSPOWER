#!/usr/bin/env bash
# prueba-persistencia-recuperacion.sh — F5: persistencia tras reinicio y
# recuperación ante fallos, contra el servidor PostgreSQL REAL (no simulado).
#
# Qué hace, en orden:
#   P1  escribe un marcador de auditoría con un nonce ÚNICO en la base origen;
#   P2  REINICIO CONTROLADO del servidor (equivalente operativa a
#       `systemctl restart postgresql` / restart del contenedor);
#   P3  verifica que el marcador sobrevive el reinicio (persistencia) y que la
#       cadena de hash sigue enlazada;
#   F1  MATA el postmaster con SIGKILL (crash real — caída de proceso);
#   F2  arranca el servidor de nuevo (recuperación: replay de WAL);
#   F3  verifica que la base se recupera sola, el marcador sigue ahí y la
#       cadena de hash quedó íntegra tras el crash.
#
# Requiere acceso al binario del servidor (PG_BIN) y al PGDATA del clúster:
#   DATABASE_URL='postgresql://...' \
#   PG_BIN=/ruta/a/los/binarios-del-servidor \
#   PGDATA=/ruta/al/cluster \
#   infra/backup/prueba-persistencia-recuperacion.sh
#
# En producción el reinicio y el arranque tras crash los ejecuta el supervisor
# (systemd/Docker/K8s); este script documenta la MISMA secuencia de validación
# que el operador debe replicar una vez por entorno antes de producción.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL es requerida}"
: "${PG_BIN:?PG_BIN es requerida (directorio con pg_ctl/postgres)}"
: "${PGDATA:?PGDATA es requerida (directorio de datos del clúster)}"

NODE_DIR="${NODE_DIR:-$(cd "$(dirname "$0")" && pwd)/../../apps/web}"

NONCE="f5_$(date -u '+%Y%m%dT%H%M%SZ')_$$"
PORT=$(DATABASE_URL="$DATABASE_URL" node -e "console.log(new URL(process.env.DATABASE_URL).port || '5432')")

marcador() {
  cd "$NODE_DIR"
  DATABASE_URL="$DATABASE_URL" NONCE="$NONCE" node - <<'NODE'
const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, {max:1, onnotice: () => {}});
(async () => {
  if (process.env.MODO === "escribir") {
    const orgs = await sql`SELECT id FROM organization ORDER BY created_at LIMIT 1`;
    const org = orgs.length ? orgs[0].id : null;
    if (!org) { console.error("sin organizaciones en la base"); process.exit(1); }
    await sql.unsafe(`SET ROLE app_runtime`);
    await sql.unsafe(`SET app.current_org = '${org.replaceAll("'", "''")}'`);
    // NOTA F5: el meta va con sql.json() — un string JS enviado como parámetro
    // llega a ::jsonb como jsonb-STRING (doble codificación), no como objeto.
    await sql`INSERT INTO audit_log (organization_id, actor_type, actor_id, action, entity, entity_id, meta)
             VALUES (${org}, 'user', 'f5_persist', 'persistence.marker', 'platform', 'f5',
                     ${sql.json({ nonce: process.env.NONCE })}::jsonb)`;
    console.log(`   marcador escrito nonce=${process.env.NONCE} org=${org}`);
  } else {
    // La lectura se hace CON CONTEXTO (FORCE RLS aplica también al dueño):
    // marcador bajo el contexto de su organización; cadena completa bajo
    // super-admin auditado (AUD-4 de la batería).
    const orgs = await sql`SELECT id FROM organization ORDER BY created_at LIMIT 1`;
    const org = orgs[0].id;
    await sql.unsafe(`SET ROLE app_runtime`);
    await sql.unsafe(`SET app.current_org = '${org.replaceAll("'", "''")}'`);
    const filas = await sql`SELECT id FROM audit_log WHERE action = 'persistence.marker' AND meta->>'nonce' = ${process.env.NONCE}`;
    console.log(`   marcadores con nonce=${process.env.NONCE}: ${filas.length}`);
    await sql.unsafe(`RESET ROLE`);
    await sql.unsafe(`RESET app.current_org`);
    await sql.unsafe(`SET ROLE app_super`);
    await sql.unsafe(`SET app.super_admin = 'on'`);
    await sql.unsafe(`SET app.super_admin_org = 'platform'`);
    const eventos = await sql.unsafe(`SELECT organization_id, id, prev_hash, hash FROM audit_log ORDER BY organization_id, id`);
    const porOrg = new Map();
    for (const ev of eventos) {
      const l = porOrg.get(ev.organization_id) ?? [];
      l.push(ev); porOrg.set(ev.organization_id, l);
    }
    let ok = true;
    for (const [, l] of porOrg) {
      if (l[0].prev_hash !== null) ok = false;
      for (let i = 1; i < l.length; i++) if (l[i].prev_hash !== l[i-1].hash) ok = false;
    }
    console.log(`   cadena de hash íntegra: ${eventos.length} eventos, ${porOrg.size} orgs → ${ok ? "OK" : "ROTA"}`);
    if (filas.length !== 1 || !ok) process.exit(1);
  }
  await sql.end({timeout:1});
})().catch(e => { console.error("MARCADOR_ERROR:", e.message); process.exit(1); });
NODE
}

echo "== F5 persistencia y recuperación — servidor real en 127.0.0.1:$PORT"
MODO=escribir marcador

echo "== P2 reinicio controlado del servidor (persistencia)"
"$PG_BIN/pg_ctl" -D "$PGDATA" -m fast restart -l /tmp/pg-f5-restart.log >/dev/null 2>&1
sleep 2
MODO=verificar marcador
echo "PASS  P3 marcador sobrevive el reinicio + cadena de hash íntegra"

echo "== F1 crash real: SIGKILL al postmaster"
# El PID del postmaster es la PRIMERA línea de postmaster.pid (firma de PostgreSQL).
POSTMASTER_PID=$(head -1 "$PGDATA/postmaster.pid")
kill -9 "$POSTMASTER_PID"
sleep 2
echo "== F2 arranque tras crash (recuperación con replay de WAL)"
# El arranque tras crash re-declara el puerto/listen de producción (como haría
# systemd con su ExecStart); la recuperación (replay de WAL) la hace el servidor.
"$PG_BIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -c listen_addresses=127.0.0.1" -l /tmp/pg-f5-recuperacion.log start >/dev/null 2>&1
sleep 3
MODO=verificar marcador
echo "PASS  F3 base recuperada tras crash: marcador íntegro + cadena de hash íntegra"

echo "== PRUEBA F5 COMPLETA: persistencia y recuperación ante fallos verificadas"
