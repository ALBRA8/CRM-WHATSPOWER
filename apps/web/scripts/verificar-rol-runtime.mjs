/**
 * verificar-rol-runtime.mjs — F5: verificación REAL del rol de runtime
 * con privilegios mínimos (MODELO_MULTI_TENANT.md §4.1, infra/sql/005_runtime_login.sql).
 *
 * Uso:
 *   DATABASE_URL=postgresql://owner@host/db \
 *   RUNTIME_ROLE_PASSWORD='<contraseña de whatspower_runtime>' \
 *   node scripts/verificar-rol-runtime.mjs
 *
 * Qué demuestra (contra un clon TEMPLATE de la base migrada, igual que la
 * batería multi-tenant, para no tocar la base del despliegue):
 *   R1  el rol LOGIN existe, es miembro de app_runtime y no es superusuario
 *       ni createrole/createdb/replication/bypassrls;
 *   R2  su inventario de privilegios es EXACTAMENTE el documentado:
 *       SELECT/INSERT/UPDATE/DELETE sobre las tablas de public y USAGE/SELECT
 *       sobre secuencias — y NADA más;
 *   R3  el DDL le queda prohibido: CREATE TABLE, DROP TABLE y CREATE ROLE
 *       son rechazados (42501);
 *   R4  la valla RLS le muerde: sin contexto → 0 filas (fail-closed);
 *       consulta/actualización/borrado cruzados de otra org → 0 filas;
 *       INSERT cruzado → 42501;
 *   R5  el DML dentro de SU organización funciona (insert + select + delete
 *       de una fila de prueba) y la secuencia (USAGE) también;
 *   R6  audit_log sigue append-only para este rol y sus eventos quedan
 *       encadenados por organización;
 *   R7  la app puede ARRANCAR conectada con este rol: la misma URL de
 *       runtime sirve para `select 1` (lo que /api/health exige para dar ok).
 *
 * Salida: detalle por caso + resumen JSON; exit 1 si algún caso falla.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const SQL_DIR = join(REPO_ROOT, "infra", "sql");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(join(WEB_ROOT, ".env"), "utf8");
    const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim();
  } catch {}
  return "postgresql://whatspower:whatspower_dev_only@127.0.0.1:5433/whatspower";
}

const BASE_URL = loadDatabaseUrl();
const u = new URL(BASE_URL);
const BASE_DB = (u.pathname || "/whatspower").replace(/^\//, "") || "whatspower";
const CLONE_DB = `${BASE_DB}_f5_runtime`;

const RUNTIME_PASSWORD = process.env.RUNTIME_ROLE_PASSWORD ?? "whatspower_runtime_dev";

const results = [];
function caso(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return !!ok;
}

async function rejectsWith42501(sql, statement) {
  try {
    await sql.unsafe(statement);
    return { ok: false, detail: "¡aceptado!" };
  } catch (e) {
    const es42501 = e.code === "42501" || /permission denied|row-level security/i.test(String(e.message));
    return { ok: es42501, detail: `rechazado (${e.code ?? "sin código"}: ${String(e.message).split("\n")[0].slice(0, 80)})` };
  }
}

async function main() {
  const t0 = Date.now();
  console.log(`== Verificación rol runtime F5 — servidor real: ${u.host}/${BASE_DB} (clon: ${CLONE_DB})`);

  // ---------- 1. clon de la base migrada + infra SQL ----------
  const admin = postgres(BASE_URL, { max: 1, connect_timeout: 10, onnotice: () => {} });
  await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${CLONE_DB} AND pid <> pg_backend_pid()`;
  await admin.unsafe(`DROP DATABASE IF EXISTS "${CLONE_DB}"`);
  await admin.unsafe(`CREATE DATABASE "${CLONE_DB}" TEMPLATE "${BASE_DB}"`);
  caso("R0 clon de base migrada (TEMPLATE)", true, `${CLONE_DB} desde ${BASE_DB}`);

  const cloneUrl = new URL(BASE_URL);
  cloneUrl.pathname = `/${CLONE_DB}`;
  const bd = postgres(cloneUrl.toString(), { max: 1, connect_timeout: 10, onnotice: () => {} });

  // 005 necesita el grupo de 001; los demás son idempotentes.
  for (const f of ["001_roles.sql", "002_audit_log.sql", "003_rls_policies.sql", "004_grants.sql", "005_runtime_login.sql"]) {
    await bd.unsafe(readFileSync(join(SQL_DIR, f), "utf8"));
  }
  caso("R0b infra SQL aplicado (001/002/003/004/005)", true);

  // Contraseña del rol (el operador la fija fuera del repo; aquí es dev).
  await admin.unsafe(`ALTER ROLE whatspower_runtime PASSWORD '${RUNTIME_PASSWORD.replaceAll("'", "''")}'`);

  // ---------- 2. siembra de una organización de prueba (dueño) ----------
  const ORG = "org_f5_rt";
  const ORG_OTRA = "org_f5_otra";
  await bd.begin(async (tx) => {
    await tx`INSERT INTO organization (id, name, slug) VALUES (${ORG}, 'Org F5 Runtime', 'org-f5-rt'), (${ORG_OTRA}, 'Org F5 Otra', 'org-f5-otra')`;
    await tx`INSERT INTO contact (id, organization_id, wa_identity, name)
             VALUES ('ct_rt_a', ${ORG}, 'wa:rt-a', 'Contacto runtime A'),
                    ('ct_rt_b', ${ORG_OTRA}, 'wa:rt-b', 'Contacto runtime B (otra org)')`;
  });
  caso("R0c siembra de 2 organizaciones", true);

  // ---------- 3. conexión REAL como whatspower_runtime ----------
  const rtUrl = new URL(cloneUrl.toString());
  if (rtUrl.password !== "" || rtUrl.username !== "whatspower_runtime") {
    rtUrl.username = "whatspower_runtime";
    rtUrl.password = RUNTIME_PASSWORD;
  }
  const rt = postgres(rtUrl.toString(), { max: 1, connect_timeout: 10, onnotice: () => {} });

  // R1 — identidad del rol
  const r1 = await rt`SELECT r.rolname, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
                             EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles g ON g.oid = m.roleid
                                     WHERE m.member = r.oid AND g.rolname = 'app_runtime') AS es_miembro
                      FROM pg_roles r WHERE r.rolname = 'whatspower_runtime'`;
  caso("R1 rol LOGIN whatspower_runtime existe y es miembro de app_runtime",
    r1.length === 1 && r1[0].es_miembro === true, `miembro=${r1[0]?.es_miembro}`);
  caso("R1b sin superuser/createrole/createdb/replication/bypassrls",
    r1[0].rolsuper === false && r1[0].rolcreaterole === false && r1[0].rolcreatedb === false &&
    r1[0].rolreplication === false && r1[0].rolbypassrls === false);

  // R2 — inventario de privilegios (exactamente DML + secuencias)
  const tablas = await rt`SELECT count(*)::int n FROM pg_tables WHERE schemaname = 'public'`;
  const conDml = await rt`SELECT count(*)::int n FROM pg_tables pt WHERE pt.schemaname = 'public'
                          AND has_table_privilege('whatspower_runtime', format('%I.%I', pt.schemaname, pt.tablename), 'SELECT')
                          AND has_table_privilege('whatspower_runtime', format('%I.%I', pt.schemaname, pt.tablename), 'INSERT')
                          AND has_table_privilege('whatspower_runtime', format('%I.%I', pt.schemaname, pt.tablename), 'UPDATE')
                          AND has_table_privilege('whatspower_runtime', format('%I.%I', pt.schemaname, pt.tablename), 'DELETE')`;
  caso("R2 DML (SELECT/INSERT/UPDATE/DELETE) sobre TODAS las tablas de public",
    conDml[0].n === tablas[0].n, `${conDml[0].n}/${tablas[0].n} tablas`);

  const sinDdl = await rt`SELECT count(*)::int n FROM information_schema.table_privileges
                          WHERE grantee = 'whatspower_runtime'
                          AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')`;
  caso("R2b NINGÚN privilegio de TRUNCATE/REFERENCES/TRIGGER", sinDdl[0].n === 0, `${sinDdl[0].n} hallazgos`);

  const seqs = await rt`SELECT count(*)::int n FROM pg_sequences WHERE schemaname = 'public'`;
  const seqsOk = await rt`SELECT count(*)::int n FROM pg_sequences s WHERE s.schemaname = 'public'
                          AND has_sequence_privilege('whatspower_runtime', format('%I.%I', s.schemaname, s.sequencename), 'USAGE')`;
  caso("R2c USAGE sobre secuencias", seqs[0].n === seqsOk[0].n, `${seqsOk[0].n}/${seqs[0].n}`);

  // R3 — DDL prohibido
  let r3 = await rejectsWith42501(rt, `CREATE TABLE public.ctl_f5 (id int)`);
  caso("R3a CREATE TABLE rechazado", r3.ok, r3.detail);
  r3 = await rejectsWith42501(rt, `DROP TABLE public.contact`);
  caso("R3b DROP TABLE rechazado", r3.ok, r3.detail);
  r3 = await rejectsWith42501(rt, `CREATE ROLE atacante LOGIN`);
  caso("R3c CREATE ROLE rechazado", r3.ok, r3.detail);

  // R4 — valla RLS (el rol NO es dueño: FORCE RLS le aplica sin SET ROLE)
  const sinCtx = await rt`SELECT count(*)::int n FROM contact`;
  caso("R4a sin app.current_org → 0 filas (fail-closed)", sinCtx[0].n === 0, `vio ${sinCtx[0].n}`);

  await rt.unsafe(`SET app.current_org = '${ORG}'`);
  const propias = await rt`SELECT id FROM contact ORDER BY id`;
  caso("R4b con contexto de su org ve SOLO sus filas", propias.length === 1 && propias[0].id === "ct_rt_a",
    `vio: ${propias.map((r) => r.id).join(",") || "(0)"}`);

  const cruzada = await rt`SELECT id FROM contact WHERE id = 'ct_rt_b'`;
  caso("R4c SELECT a fila de OTRA org → 0 filas", cruzada.length === 0);

  const upd = await rt`UPDATE contact SET name = 'ATAQUE' WHERE id = 'ct_rt_b' RETURNING id`;
  caso("R4d UPDATE a fila de OTRA org → 0 filas afectadas", upd.length === 0);
  const del = await rt`DELETE FROM contact WHERE id = 'ct_rt_b' RETURNING id`;
  caso("R4e DELETE a fila de OTRA org → 0 filas afectadas", del.length === 0);

  let insertCruz = false, insertDetalle = "";
  try {
    await rt`INSERT INTO contact (id, organization_id, wa_identity, name) VALUES ('ct_inyect', ${ORG_OTRA}, 'wa:inyect', 'Inyectado')`;
    insertDetalle = "¡el INSERT cruzado fue ACEPTADO!";
  } catch (e) {
    insertCruz = /42501|row-level security/i.test(`${e.code ?? ""} ${e.message}`);
    insertDetalle = `rechazado (${e.code ?? "sin código"})`;
  }
  caso("R4f INSERT con organization_id de OTRA org → 42501 (WITH CHECK)", insertCruz, insertDetalle);

  // contexto manipulado (org inexistente) → 0 filas
  await rt.unsafe(`SET app.current_org = 'org_fantasma'`);
  const fantasma = await rt`SELECT count(*)::int n FROM contact`;
  await rt.unsafe(`SET app.current_org = '${ORG}'`);
  caso("R4g contexto manipulado (org inexistente) → 0 filas", fantasma[0].n === 0);

  // R5 — DML dentro de su organización + secuencia
  await rt`INSERT INTO contact (id, organization_id, wa_identity, name) VALUES ('ct_rt_ok', ${ORG}, 'wa:rt-ok', 'Escritura del runtime')`;
  const leida = await rt`SELECT name FROM contact WHERE id = 'ct_rt_ok'`;
  await rt`DELETE FROM contact WHERE id = 'ct_rt_ok'`;
  const borrada = await rt`SELECT count(*)::int n FROM contact WHERE id = 'ct_rt_ok'`;
  caso("R5a INSERT/SELECT/DELETE dentro de su org funciona",
    leida.length === 1 && leida[0].name === "Escritura del runtime" && borrada[0].n === 0);

  const secuencia = await rt.unsafe(`SELECT nextval(pg_get_serial_sequence('audit_log', 'id')) AS n`);
  caso("R5b nextval sobre secuencia (USAGE) funciona", !!secuencia[0].n);

  // R6 — audit_log append-only con este rol + cadena por org
  await rt`INSERT INTO audit_log (organization_id, actor_type, actor_id, action, entity, entity_id, meta)
           VALUES (${ORG}, 'user', 'usr_f5', 'runtime.verified', 'platform', 'f5', '{"verificacion":"rol runtime"}'::jsonb)`;
  let aud = await rejectsWith42501(rt, `UPDATE audit_log SET action = 'MANIPULADO' WHERE organization_id = '${ORG}'`);
  const rechazadoUpdate = aud.ok || /append-only|prohibido/i.test(aud.detail);
  caso("R6a audit_log append-only (UPDATE rechazado)", rechazadoUpdate, aud.detail);
  // El trigger append-only rechaza el DELETE con P0001 (raise del trigger),
  // igual que en la batería (AUD-3): se captura el rechazo y se verifica que
  // la fila sigue intacta.
  let delRechazado = false, delDetalle = "";
  try {
    await rt.unsafe(`DELETE FROM audit_log WHERE organization_id = '${ORG}'`);
    delDetalle = "¡el DELETE fue ACEPTADO!";
  } catch (e) {
    delRechazado = /append-only|prohibido|permission denied/i.test(String(e.message));
    delDetalle = `rechazado (${e.code ?? "sin código"}: ${String(e.message).split("\n")[0].slice(0, 70)})`;
  }
  const queda = await rt.unsafe(`SELECT count(*)::int AS n FROM audit_log WHERE organization_id = '${ORG}' AND action = 'runtime.verified'`);
  caso("R6b audit_log append-only (DELETE rechazado y fila intacta)", delRechazado && queda[0].n === 1, delDetalle);
  const evento = await rt.unsafe(`SELECT prev_hash, hash FROM audit_log WHERE organization_id = '${ORG}' AND action = 'runtime.verified'`);
  caso("R6c evento de auditoría con hash encadenado", evento.length === 1 && !!evento[0].hash && evento[0].prev_hash === null);

  // R7 — la app arranca con esta URL (lo mínimo que /api/health exige)
  const ping = await rt`SELECT 1 AS ok`;
  caso("R7 conexión de runtime operativa para la app (select 1)", ping[0].ok === 1);

  await rt.unsafe(`RESET app.current_org`);

  // ---------- resumen ----------
  const pasados = results.filter((r) => r.ok).length;
  const fallados = results.filter((r) => !r.ok);
  const resumen = {
    base: `${u.host}/${CLONE_DB}`,
    rol_runtime: "whatspower_runtime (LOGIN, miembro de app_runtime, NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS)",
    casos: results.length,
    pasados,
    fallidos: fallados.length,
    duracion_ms: Date.now() - t0,
    resultados: results,
  };
  console.log("\n== RESUMEN ==");
  console.log(JSON.stringify(resumen, null, 2));
  await bd.end({ timeout: 1 });
  await rt.end({ timeout: 1 });
  await admin.end({ timeout: 1 });
  if (fallados.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error("VERIFICACION_ERROR:", e);
  process.exit(1);
});
