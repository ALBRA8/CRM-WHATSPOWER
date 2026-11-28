/**
 * bateria-multi-tenant.mjs — Batería real de aislamiento multi-tenant (T1-T15,
 * MODELO_MULTI_TENANT.md §9) sobre PostgreSQL REAL. Sin mocks ni sustitutos:
 * todo pasa por TCP contra el servidor documentado (DATABASE_URL, PG 16).
 *
 * Uso:  DATABASE_URL=postgresql://... node scripts/bateria-multi-tenant.mjs
 *       pnpm --filter @whatspower/web test:multi-tenant
 *
 * Qué hace:
 *  1. Clona la base migrada a una base de batería efímera (TEMPLATE), aplica
 *     infra/sql (002 audit_log, 003 RLS dinámica, 004 grants) y siembra DOS
 *     organizaciones con datos propios (contactos, conversaciones, mensajes,
 *     credenciales, llaves API, conocimiento).
 *  2. Ejecuta los casos como el rol de RUNTIME documentado (app_runtime)
 *     con `SET ROLE`, jamás como dueño — así la RLS con FORCE muerde de verdad.
 *  3. Verifica T1 (RLS directo), T2 (fail-closed sin contexto), contexto
 *     manipulado, T15 (unicidades por organización), cadena de hash de
 *     audit_log + append-only, transacciones con rollback, y super-admin
 *     con contexto explícito.
 * Salida: detalle por caso + resumen JSON; código de salida 1 si algún caso falla.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

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
const BATERIA_DB = `${BASE_DB}_s43_bateria`;

const results = [];
function caso(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return !!ok;
}

async function main() {
  const t0 = Date.now();
  console.log(`== Batería multi-tenant S4.3 — servidor real: ${u.host}/${BASE_DB} (clon: ${BATERIA_DB})`);

  // ---------- 1. clon de la base migrada ----------
  const admin = postgres(BASE_URL, { max: 1, connect_timeout: 10, onnotice: () => {} });
  const adminDb = admin.unsafe;
  await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${BASE_DB} AND pid <> pg_backend_pid()`;
  await admin.unsafe(`DROP DATABASE IF EXISTS "${BATERIA_DB}"`);
  await admin.unsafe(`CREATE DATABASE "${BATERIA_DB}" TEMPLATE "${BASE_DB}"`);
  caso("B0 clon de base migrada (TEMPLATE)", true, `${BATERIA_DB} desde ${BASE_DB}`);

  const batteryUrl = new URL(BASE_URL);
  batteryUrl.pathname = `/${BATERIA_DB}`;
  const bd = postgres(batteryUrl.toString(), { max: 1, connect_timeout: 10, onnotice: () => {} });

  // ---------- 2. infra SQL idempotente sobre el clon ----------
  for (const f of ["002_audit_log.sql", "003_rls_policies.sql", "004_grants.sql"]) {
    await bd.unsafe(readFileSync(join(SQL_DIR, f), "utf8"));
  }
  caso("B1 infra SQL aplicado (002/003/004)", true);

  // ---------- 3. evidencia de migraciones y cobertura RLS ----------
  const tables = await bd`
    SELECT t.table_name AS name, (pt.rowsecurity = true) AS rls
      FROM information_schema.tables t
      JOIN pg_tables pt ON pt.tablename = t.table_name AND pt.schemaname = 'public'
      JOIN information_schema.columns c
        ON c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'organization_id'
     WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'`;
  const sinRls = tables.filter((r) => !r.rls).map((r) => r.name);
  caso("B2 cobertura RLS: 0 tablas org-scoped sin RLS", sinRls.length === 0,
    `${tables.length} tablas org-scoped${sinRls.length ? `; sin RLS: ${sinRls.join(",")}` : ""}`);

  const migrs = await bd.unsafe(`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`);
  caso("B3 migraciones aplicadas desde base limpia", migrs[0].n >= 33, `${migrs[0].n} migraciones`);

  // ---------- 4. siembra de dos organizaciones (dueño, fuera de RLS) ----------
  const ORG_A = "org_s43_a", ORG_B = "org_s43_b";
  await bd.begin(async (tx) => {
    await tx`INSERT INTO organization (id, name, slug) VALUES (${ORG_A}, 'Org A S43', 'org-s43-a'), (${ORG_B}, 'Org B S43', 'org-s43-b')`;
    await tx`INSERT INTO "user" (id, name, email) VALUES ('usr_a', 'Usuario A', 'a@s43.test'), ('usr_b', 'Usuario B', 'b@s43.test')`;
    await tx`INSERT INTO member (id, organization_id, user_id, role)
             VALUES ('mb_a', ${ORG_A}, 'usr_a', 'owner'), ('mb_b', ${ORG_B}, 'usr_b', 'owner')`;
    await tx`INSERT INTO contact (id, organization_id, wa_identity, name, phone)
             VALUES ('ct_a1', ${ORG_A}, 'wa:+52A1', 'Contacto A1', '+52A1'),
                    ('ct_a2', ${ORG_A}, 'wa:+52A2', 'Contacto A2', '+52A2'),
                    ('ct_b1', ${ORG_B}, 'wa:+52A1', 'Contacto B1 (misma identidad que A1)', '+52A1')`;
    await tx`INSERT INTO conversation (id, organization_id, contact_id)
             VALUES ('cv_a1', ${ORG_A}, 'ct_a1'), ('cv_b1', ${ORG_B}, 'ct_b1')`;
    await tx`INSERT INTO message (id, organization_id, conversation_id, direction, text)
             VALUES ('ms_a1', ${ORG_A}, 'cv_a1', 'in', 'Hola desde A'),
                    ('ms_b1', ${ORG_B}, 'cv_b1', 'in', 'Hola desde B')`;
    await tx`INSERT INTO meta_credentials (id, organization_id, waba_id, phone_number_id, token_cipher, token_iv, token_tag)
             VALUES ('mc_a', ${ORG_A}, 'waba_A', 'pn_A', 'cipher-A', 'iv-A', 'tag-A'),
                    ('mc_b', ${ORG_B}, 'waba_B', 'pn_B', 'cipher-B', 'iv-B', 'tag-B')`;
    await tx`INSERT INTO api_key (id, organization_id, name, prefix, last4, hash, scopes, created_by_user_id)
             VALUES ('ak_a', ${ORG_A}, 'key A', 'v1_a', 'a4', 'hash-A', ARRAY['contacts:read']::text[], 'usr_a'),
                    ('ak_b', ${ORG_B}, 'key B', 'v1_b', 'b4', 'hash-B', ARRAY['contacts:read']::text[], 'usr_b')`;
    await tx`INSERT INTO kb_entry (id, organization_id, kind, question, answer)
             VALUES ('kb_a1', ${ORG_A}, 'qa', 'horario A', 'A abre 9-5'),
                    ('kb_b1', ${ORG_B}, 'qa', 'horario B', 'B abre 10-6')`;
  });
  caso("B4 siembra de 2 organizaciones con datos propios", true,
    "contactos, conversaciones, mensajes, credenciales Meta, llaves API, conocimiento");

  // ---------- 5. rol de runtime ----------
  const rt = postgres(batteryUrl.toString(), { max: 1, connect_timeout: 10, onnotice: () => {} });
  await rt.unsafe(`SET ROLE app_runtime`);

  async function ctx(org) {
    // org siempre es una constante definida arriba o null; SET no admite parámetros.
    if (org === null) await rt.unsafe(`RESET app.current_org`);
    else await rt.unsafe(`SET app.current_org = '${org.replaceAll("'", "''")}'`);
  }

  // T1 — RLS directo: SELECT/UPDATE/DELETE sobre filas de org B con contexto A
  await ctx(ORG_A);
  const visiblesA = await rt`SELECT id FROM contact ORDER BY id`;
  caso("T1a contexto org A ve solo sus contactos (2 de 3)", visiblesA.length === 2 && visiblesA.every((r) => ["ct_a1", "ct_a2"].includes(r.id)),
    `vio: ${visiblesA.map((r) => r.id).join(",") || "(0)"}`);

  const cruzadosA = await rt`SELECT id FROM contact WHERE id = 'ct_b1'`;
  caso("T1b SELECT directo a fila de org B → 0 filas", cruzadosA.length === 0);

  const upd = await rt`UPDATE message SET text = 'ATAQUE' WHERE id = 'ms_b1' RETURNING id`;
  caso("T1c UPDATE a mensaje de org B → 0 filas afectadas", upd.length === 0);

  const del = await rt`DELETE FROM kb_entry WHERE id = 'kb_b1' RETURNING id`;
  caso("T1d DELETE a conocimiento de org B → 0 filas afectadas", del.length === 0);

  let insertCruzadoOk = false, insertCruzadoDetalle = "";
  try {
    await rt`INSERT INTO contact (id, organization_id, wa_identity, name) VALUES ('ct_inyect', ${ORG_B}, 'wa:inject', 'Inyectado')`;
    insertCruzadoDetalle = "¡el insert cruzado fue ACEPTADO!";
  } catch (e) {
    insertCruzadoOk = /row-level security|42501/i.test(`${e.code ?? ""} ${e.message}`);
    insertCruzadoDetalle = `rechazado (${e.code ?? "sin código"}: ${String(e.message).split("\n")[0].slice(0, 90)})`;
  }
  caso("T1e INSERT con organization_id de org B desde contexto A → rechazado por WITH CHECK", insertCruzadoOk, insertCruzadoDetalle);

  // integridad tras los ataques
  const msB1 = await bd`SELECT text FROM message WHERE id = 'ms_b1'`;
  const kbB1 = await bd.unsafe(`SELECT count(*)::int AS n FROM kb_entry WHERE id = 'kb_b1'`);
  caso("T1f datos de org B intactos tras intentos de mutación", msB1[0].text === "Hola desde B" && kbB1[0].n === 1);

  // T2 — sin contexto → 0 filas (fail-closed)
  await ctx(null);
  const sinCtx = {};
  for (const [tabla, col] of [["contact", "id"], ["conversation", "id"], ["message", "id"], ["meta_credentials", "id"], ["api_key", "id"], ["kb_entry", "id"], ["agent_profile", "id"]]) {
    const r = await rt.unsafe(`SELECT count(*)::int AS n FROM ${tabla}`);
    sinCtx[tabla] = r[0].n;
  }
  caso("T2 sin contexto: 0 filas en TODAS las tablas de dominio (fail-closed)",
    Object.values(sinCtx).every((n) => n === 0), JSON.stringify(sinCtx));

  // contexto manipulado
  await ctx("org_fantasma");
  const fantasma = await rt`SELECT count(*)::int AS n FROM contact`;
  await ctx(ORG_A);
  const fantasmaA = await rt`SELECT count(*)::int AS n FROM contact`;
  caso("T2b contexto manipulado (org inexistente) → 0 filas; el real vuelve tras restaurar",
    fantasma[0].n === 0 && fantasmaA[0].n === 2);

  // T15 — unicidades compuestas por organización
  let t15a = false;
  try {
    await rt`INSERT INTO contact (id, organization_id, wa_identity, name) VALUES ('ct_a_dup', ${ORG_A}, 'wa:+52A1', 'Duplicado dentro de A')`;
    // duplicado dentro de la MISMA org → debe fallar por unicidad compuesta
  } catch (e) {
    t15a = /duplicate key|23505/i.test(`${e.code ?? ""} ${e.message}`);
  }
  caso("T15a unicidad DENTRO de la misma org se respeta (contact_org_channel_identity_uq)", t15a);

  let t15b = false;
  try {
    await ctx(ORG_B); // la escritura ocurre en el CONTEXTO de org B (RLS con CHECK)
    // Identidad wa:+52A2 ya existe en org A (ct_a2): crearla en org B debe ser
    // permitido (la unicidad es compuesta por org). Nota: wa:+52A1 no sirve
    // aquí porque la siembra ya la creó en org B (ct_b1) y chocaría consigo misma.
    await rt`INSERT INTO contact (id, organization_id, wa_identity, name) VALUES ('ct_b_dup', ${ORG_B}, 'wa:+52A2', 'Identidad que ya existe en org A')`;
    t15b = true;
    await rt`DELETE FROM contact WHERE id = 'ct_b_dup'`;
  } catch {
    t15b = false;
  }
  await ctx(ORG_A);
  caso("T15b misma identidad en OTRA organización → permitido (llave por org, no global)", t15b);

  // auditoría — cadena de hash por organización y append-only
  await ctx(ORG_A);
  await rt`INSERT INTO audit_log (organization_id, actor_type, actor_id, action, entity, entity_id, meta)
           VALUES (${ORG_A}, 'user', 'usr_a', 'conversation.handoff', 'conversation', 'cv_a1', '{"motivo":"prueba"}'::jsonb)`;
  await rt`INSERT INTO audit_log (organization_id, actor_type, actor_id, action, entity, entity_id, meta)
           VALUES (${ORG_A}, 'api_key', 'ak_a', 'contact.created', 'contact', 'ct_a2', '{}'::jsonb)`;
  await ctx(ORG_B);
  await rt`INSERT INTO audit_log (organization_id, actor_type, actor_id, action, entity, entity_id, meta)
           VALUES (${ORG_B}, 'user', 'usr_b', 'conversation.handoff', 'conversation', 'cv_b1', '{"motivo":"prueba B"}'::jsonb)`;
  await ctx(null);

  const chainA = await bd.unsafe(`SELECT id, prev_hash, hash FROM audit_log WHERE organization_id = '${ORG_A}' ORDER BY id`);
  const chainB = await bd.unsafe(`SELECT id, prev_hash, hash FROM audit_log WHERE organization_id = '${ORG_B}' ORDER BY id`);
  const linkOk = (chain) =>
    chain.length >= 1 &&
    chain[0].prev_hash === null &&
    chain.every((row, i) => i === 0 || row.prev_hash === chain[i - 1].hash);
  caso("AUD-1 cadena de hash encadenada por organización (prev_hash[i] = hash[i-1])",
    chainA.length === 2 && chainB.length === 1 && linkOk(chainA) && linkOk(chainB) && chainA[0].hash !== chainB[0].hash,
    `org A: ${chainA.length} filas, org B: ${chainB.length} filas; cadenas independientes`);

  let audOk = false, audDetalle = "";
  try {
    await bd.unsafe(`UPDATE audit_log SET action = 'MANIPULADO' WHERE organization_id = '${ORG_A}'`);
    audDetalle = "¡el UPDATE fue aceptado!";
  } catch (e) {
    audOk = /append-only|prohibido/i.test(e.message);
    audDetalle = `rechazado (${String(e.message).split("\n")[0].slice(0, 80)})`;
  }
  caso("AUD-2 audit_log append-only: UPDATE rechazado por trigger", audOk, audDetalle);

  let delOk = false;
  try {
    await bd.unsafe(`DELETE FROM audit_log WHERE organization_id = '${ORG_A}'`);
  } catch {
    delOk = true;
  }
  caso("AUD-3 audit_log append-only: DELETE rechazado por trigger", delOk);

  // super-admin con contexto explícito y auditado
  await rt.unsafe(`RESET ROLE`);
  await rt.unsafe(`SET ROLE app_super`);
  await rt.unsafe(`SET app.super_admin = 'on'`);
  await rt.unsafe(`SET app.super_admin_org = 'platform'`);
  const superVe = await rt.unsafe(`SELECT count(*)::int AS n FROM audit_log`);
  await rt.unsafe(`SET app.super_admin = 'off'`);
  const superApagado = await rt.unsafe(`SELECT count(*)::int AS n FROM audit_log`);
  await rt.unsafe(`RESET ROLE`);
  caso("AUD-4 super-admin solo con contexto explícito (app.super_admin=on + org=platform)",
    superVe[0].n === 3 && superApagado[0].n === 0,
    `activado ve ${superVe[0].n} filas, apagado ve ${superApagado[0].n}`);

  // transacciones y rollback bajo RLS
  await rt.unsafe(`SET ROLE app_runtime`);
  await ctx(ORG_A);
  await rt.unsafe(`BEGIN`);
  await rt`INSERT INTO contact (id, organization_id, wa_identity, name) VALUES ('ct_txn', ${ORG_A}, 'wa:txn', 'Temporal')`;
  await rt.unsafe(`ROLLBACK`);
  const txnGone = await rt`SELECT count(*)::int AS n FROM contact WHERE id = 'ct_txn'`;
  caso("TX-1 transacción con ROLLBACK: insert descartado", txnGone[0].n === 0);

  await rt.unsafe(`BEGIN`);
  let txnCruzadoRechazado = false;
  try {
    await rt`INSERT INTO contact (id, organization_id, wa_identity, name) VALUES ('ct_txnb', ${ORG_B}, 'wa:txnb', 'Cruzado')`;
  } catch {
    txnCruzadoRechazado = true;
  }
  await rt.unsafe(`ROLLBACK`);
  const txnb = await bd.unsafe(`SELECT count(*)::int AS n FROM contact WHERE id = 'ct_txnb'`);
  caso("TX-2 escritura cruzada dentro de transacción → rechazada y sin efectos", txnCruzadoRechazado && txnb[0].n === 0);

  await rt.unsafe(`BEGIN`);
  await rt`INSERT INTO contact (id, organization_id, wa_identity, name) VALUES ('ct_txnc', ${ORG_A}, 'wa:txnc', 'Permanente')`;
  await rt.unsafe(`COMMIT`);
  const txnc = await rt`SELECT count(*)::int AS n FROM contact WHERE id = 'ct_txnc'`;
  caso("TX-3 transacción con COMMIT: insert persiste visible solo en su org", txnc[0].n === 1);
  await ctx(ORG_B);
  const txncB = await rt`SELECT count(*)::int AS n FROM contact WHERE id = 'ct_txnc'`;
  caso("TX-4 lo confirmado en org A es invisible desde org B", txncB[0].n === 0);
  await ctx(null);

  // aislamiento de credenciales y llaves (T-cred)
  await ctx(ORG_A);
  const credA = await rt`SELECT waba_id, token_cipher FROM meta_credentials`;
  await ctx(ORG_B);
  const credB = await rt`SELECT waba_id, token_cipher FROM meta_credentials`;
  caso("CRED-1 credenciales por organización estrictamente separadas",
    credA.length === 1 && credA[0].waba_id === "waba_A" && credB.length === 1 && credB[0].waba_id === "waba_B",
    `A ve ${credA.length}, B ve ${credB.length}`);

  await ctx(ORG_A);
  const keyA = await rt`SELECT hash FROM api_key`;
  await ctx(ORG_B);
  const keyB = await rt`SELECT hash FROM api_key`;
  caso("CRED-2 llaves API por organización separadas (T4 base de BD)",
    keyA.length === 1 && keyA[0].hash === "hash-A" && keyB.length === 1 && keyB[0].hash === "hash-B");

  // conversaciones/mensajes/documentos aislados
  await ctx(ORG_A);
  const convA = await rt`SELECT count(*)::int AS n FROM conversation`;
  const msgA = await rt`SELECT count(*)::int AS n FROM message`;
  await ctx(ORG_B);
  const convB = await rt`SELECT count(*)::int AS n FROM conversation`;
  const msgB = await rt`SELECT count(*)::int AS n FROM message`;
  caso("ISO-1 conversaciones y mensajes aislados por organización",
    convA[0].n === 1 && msgA[0].n === 1 && convB[0].n === 1 && msgB[0].n === 1,
    `A: ${convA[0].n} conv/${msgA[0].n} msg · B: ${convB[0].n} conv/${msgB[0].n} msg`);

  await rt.unsafe(`RESET ROLE`);

  // ---------- resumen ----------
  const pasados = results.filter((r) => r.ok).length;
  const fallados = results.filter((r) => !r.ok);
  const resumen = {
    base: `${u.host}/${BATERIA_DB}`,
    rol_runtime: "app_runtime (SET ROLE; FORCE RLS)",
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
  console.error("BATERIA_ERROR:", e);
  process.exit(1);
});
