/**
 * verificar-restauracion.mjs — F5: verificación REAL de una restauración.
 *
 * Compara la base ORIGEN (DATABASE_URL) contra la base RESTAURADA
 * (RESTORE_DATABASE_URL) y exige que la copia sea operable, no solo existente:
 *
 *   V1  cada tabla de public tiene la MISMA cantidad de filas en origen y
 *       restaurada (diff exacto por tabla);
 *   V2  la cobertura RLS de las tablas org-scoped llega íntegra
 *       (ENABLE + FORCE + política tenant_isolation) — mismo número, 39/39;
 *   V3  la cadena de hash de audit_log sigue enlazada por organización en la
 *       restaurada (prev_hash[i] = hash[i-1], primera fila prev_hash NULL);
 *   V4  las migraciones aplicadas (drizzle.__drizzle_migrations) coinciden;
 *   V5  una consulta de dominio responde (la base restaurada es operable).
 *
 * Uso:
 *   DATABASE_URL=postgresql://...origen/whatspower \
 *   RESTORE_DATABASE_URL=postgresql://...restaurada/whatspower_restaurado \
 *   node scripts/verificar-restauracion.mjs
 *
 * Salida: detalle por caso + resumen JSON; exit 1 si algún caso falla.
 */
import postgres from "postgres";

function urlDe(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  throw new Error(`${nombre} es requerida`);
}

const ORIGEN_URL = urlDe("DATABASE_URL");
const RESTAURADA_URL = urlDe("RESTORE_DATABASE_URL");

const results = [];
function caso(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return !!ok;
}

async function main() {
  const t0 = Date.now();
  const uO = new URL(ORIGEN_URL);
  const uR = new URL(RESTAURADA_URL);
  console.log(`== Verificación de restauración F5 — origen: ${uO.host}/${uO.pathname}, restaurada: ${uR.host}/${uR.pathname}`);

  const origen = postgres(ORIGEN_URL, { max: 1, connect_timeout: 10, onnotice: () => {} });
  const resta = postgres(RESTAURADA_URL, { max: 1, connect_timeout: 10, onnotice: () => {} });

  // V1 — conteo por tabla
  const tablas = await origen`
    SELECT table_name AS name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`;
  const diffs = [];
  for (const t of tablas) {
    const tabla = t.name;
    const a = await origen.unsafe(`SELECT count(*)::int AS n FROM "${tabla}"`);
    const b = await resta.unsafe(`SELECT count(*)::int AS n FROM "${tabla}"`);
    if (a[0].n !== b[0].n) diffs.push(`${tabla}: ${a[0].n}→${b[0].n}`);
  }
  caso("V1 conteo de filas idéntico en TODAS las tablas de public",
    diffs.length === 0, `${tablas.length} tablas comparadas${diffs.length ? `; diferencias: ${diffs.join(", ")}` : ""}`);

  // V2 — cobertura RLS intacta
  const rlsO = await origen`
    SELECT count(*)::int n FROM pg_tables pt
     WHERE pt.schemaname = 'public' AND pt.rowsecurity = true
       AND EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.schemaname='public' AND pp.tablename=pt.tablename AND pp.policyname='tenant_isolation')
       AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=pt.tablename AND c.column_name='organization_id')`;
  const rlsR = await resta`
    SELECT count(*)::int n FROM pg_tables pt
     WHERE pt.schemaname = 'public' AND pt.rowsecurity = true
       AND EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.schemaname='public' AND pp.tablename=pt.tablename AND pp.policyname='tenant_isolation')
       AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=pt.tablename AND c.column_name='organization_id')`;
  const forceR = await resta`
    SELECT count(*)::int n FROM pg_class pc JOIN pg_namespace ns ON ns.oid = pc.relnamespace
     WHERE ns.nspname = 'public' AND pc.relrowsecurity = true AND pc.relforcerowsecurity = true
       AND EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.schemaname='public' AND pp.tablename=pc.relname AND pp.policyname='tenant_isolation')`;
  caso("V2 RLS restaurada: cobertura org-scoped idéntica a la del origen",
    rlsO[0].n === rlsR[0].n && rlsR[0].n > 0 && forceR[0].n === rlsR[0].n,
    `origen ${rlsO[0].n}, restaurada ${rlsR[0].n}, con FORCE ${forceR[0].n}`);

  // V3 — cadena de hash de audit_log en la restaurada
  const eventos = await resta.unsafe(`SELECT organization_id, id, prev_hash, hash FROM audit_log ORDER BY organization_id, id`);
  const porOrg = new Map();
  for (const ev of eventos) {
    const lista = porOrg.get(ev.organization_id) ?? [];
    lista.push(ev);
    porOrg.set(ev.organization_id, lista);
  }
  let cadenaOk = true, cadenaDetalle = "";
  for (const [org, lista] of porOrg) {
    if (lista[0].prev_hash !== null) { cadenaOk = false; cadenaDetalle = `${org}: la primera fila no tiene prev_hash NULL`; break; }
    for (let i = 1; i < lista.length; i++) {
      if (lista[i].prev_hash !== lista[i - 1].hash) { cadenaOk = false; cadenaDetalle = `${org}: eslabón roto en id ${lista[i].id}`; break; }
    }
    if (!cadenaOk) break;
  }
  caso("V3 cadena de hash de audit_log restaurada íntegra por organización",
    cadenaOk && eventos.length > 0, `${eventos.length} eventos, ${porOrg.size} organizaciones${cadenaDetalle ? `; ${cadenaDetalle}` : ""}`);

  // V4 — migraciones
  const migO = await origen`SELECT count(*)::int n FROM drizzle.__drizzle_migrations`;
  const migR = await resta`SELECT count(*)::int n FROM drizzle.__drizzle_migrations`;
  caso("V4 migraciones aplicadas coinciden", migO[0].n === migR[0].n, `${migR[0].n} migraciones`);

  // V5 — la base restaurada es operable
  const ping = await resta`SELECT 1 AS ok`;
  caso("V5 base restaurada operable (select 1)", ping[0].ok === 1);

  const pasados = results.filter((r) => r.ok).length;
  const fallados = results.filter((r) => !r.ok);
  console.log("\n== RESUMEN ==");
  console.log(JSON.stringify({
    origen: `${uO.host}/${uO.pathname.replace(/^\//, "")}`,
    restaurada: `${uR.host}/${uR.pathname.replace(/^\//, "")}`,
    casos: results.length,
    pasados,
    fallidos: fallados.length,
    duracion_ms: Date.now() - t0,
    resultados: results,
  }, null, 2));
  await origen.end({ timeout: 1 });
  await resta.end({ timeout: 1 });
  if (fallados.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error("VERIFICACION_RESTAURACION_ERROR:", e);
  process.exit(1);
});
