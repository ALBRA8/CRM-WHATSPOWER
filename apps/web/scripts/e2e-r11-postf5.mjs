/**
 * R11 standalone — corrida POST-F5 (cierre operativo).
 *
 * Ejecuta EXACTAMENTE la sección final `r11BotChecks` del selftest 036
 * (copiada verbatim de e2e-selftest.mjs @ ff691d9), contra el servidor de
 * PRODUCCIÓN (next build + next start) porque el sandbox tiene 3,9 GB y el
 * servidor dev de turbo OOM-ea en la ráfaga (dmesg, corrida B de F5).
 *
 * El setup mínimo (registro + conexión WhatsApp + un inbound) es PREP: hace
 * las operaciones que en la corrida completa generan checks 1..N ya verificados
 * en F5 (270/302), y NO emite checks para no mezclar contabilidades.
 *
 * Uso:
 *   1) servidor corriendo con .env.e2e-036 (misma configuración estándar 036)
 *   2) env -u DATABASE_URL node --env-file=.env.e2e-036 scripts/e2e-r11-postf5.mjs
 */
import {
  apagarAgente,
  levantarCerebroFalso,
  urlDelDespacho,
} from "./lib/cerebro-falso.mjs";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3260";
const BOT_KEY = process.env.BOT_API_KEY;

let cookie = "";
let failures = 0;
let checks = 0;

function ok(name, cond, extra = "") {
  checks++;
  if (cond) {
    console.log(`  OK  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      origin: BASE,
      ...(cookie ? { cookie } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  }
  let json = null;
  try {
    json = await res.clone().json();
  } catch {}
  return { res, json };
}

function bot(path, opts = {}) {
  return api(path, {
    ...opts,
    headers: { "x-api-key": BOT_KEY ?? "", ...(opts.headers ?? {}) },
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function hasta(cond, ms = 15000, paso = 400) {
  const fin = Date.now() + ms;
  for (;;) {
    if (await cond()) return true;
    if (Date.now() > fin) return false;
    await sleep(paso);
  }
}
const PN = "PN-E2E-1";

/* ------------------------------------------------------------------
 * PREP (no emite checks): lo mismo que hace el setup de la corrida
 * completa, sin sumar al total de R11.
 * ------------------------------------------------------------------ */
async function prep() {
  console.log("== PREP (sin checks): registro + conexión + 1 inbound ==");
  const email = "e2e@whatspower.test";
  const password = "password-e2e-123";
  let su = await api("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ email, password, name: "Operador E2E" }),
  });
  if (!su.res.ok) {
    su = await api("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }
  if (!su.res.ok) throw new Error(`PREP registro/login falló: ${JSON.stringify(su.json)}`);
  console.log("  prep: operador autenticado");

  const conn = await api("/api/settings/whatsapp", {
    method: "PUT",
    body: JSON.stringify({ wabaId: "WABA-E2E", phoneNumberId: PN, token: "tok-e2e" }),
  });
  if (!conn.res.ok) throw new Error(`PREP conexión WhatsApp falló: ${JSON.stringify(conn.json)}`);
  console.log("  prep: PN-E2E-1 conectado vía wa-mock");

  await api("/api/dev/wa-mock/outbox", { method: "DELETE" });

  const inb = await api("/api/dev/wa-mock/inbound", {
    method: "POST",
    body: JSON.stringify({
      phoneNumberId: PN,
      fromUserId: "bsu_e2e_1",
      name: "Dueña Dental",
      text: "hola, vi su anuncio",
      waMessageId: "wamid.e2e.r11prep.1",
    }),
  });
  if (!inb.res.ok) throw new Error(`PREP inbound falló: ${JSON.stringify(inb.json)}`);
  await sleep(1500);
  const convs = (await api("/api/conversations")).json?.conversations ?? [];
  if (!convs.length) throw new Error("PREP: no hay conversación tras el inbound");
  console.log(`  prep: ${convs.length} conversación(es) — suficiente para R11`);
}

/* ============================================================
 * R11 — copiada VERBATIM de e2e-selftest.mjs (ff691d9)
 * ============================================================ */
async function r11BotChecks() {
  const RUN = Date.now().toString().slice(-6);

  console.log("\n== R11: 700 requests sin key desde una IP vs. el cerebro ==");
  const deReferencia = ((await api("/api/conversations")).json?.conversations ?? [])[0];
  ok("hay una conversación para que el cerebro pregunte", Boolean(deReferencia));
  const IP = `10.${Number(RUN.slice(0, 2))}.${Number(RUN.slice(2, 4))}.${Number(RUN.slice(4, 6))}`;
  const intento = (key, ip = IP) =>
    fetch(`${BASE}/api/bot/context?conversationId=${deReferencia?.id}`, {
      headers: { "x-forwarded-for": ip, ...(key ? { "x-api-key": key } : {}) },
    }).then((r) => r.status);
  const vistos = {};
  const cerebroDurante = [];
  for (let lote = 0; lote < 14; lote++) {
    const fallidos = Array.from({ length: 50 }, (_, i) =>
      intento(i % 2 ? "clave-equivocada-0123456789" : undefined)
    );
    const cerebro = lote === 7 ? [intento(BOT_KEY, "10.255.0.1"), intento(BOT_KEY)] : [];
    const [estados, deCerebro] = await Promise.all([
      Promise.all(fallidos),
      Promise.all(cerebro),
    ]);
    for (const s of estados) vistos[s] = (vistos[s] ?? 0) + 1;
    cerebroDurante.push(...deCerebro);
  }
  ok(
    "la inundación: 30 → 401 y las otras 670 → 429 (frenada por IP)",
    vistos[401] === 30 && vistos[429] === 670,
    JSON.stringify(vistos)
  );
  ok(
    "el cerebro DURANTE la inundación → 200 (otra IP y la misma)",
    cerebroDurante.length === 2 && cerebroDurante.every((s) => s === 200),
    JSON.stringify(cerebroDurante)
  );
  const despues = [await intento(BOT_KEY, "10.255.0.1"), await intento(BOT_KEY)];
  ok(
    "el cerebro DESPUÉS de la inundación → 200",
    despues.every((s) => s === 200),
    JSON.stringify(despues)
  );
  const otraIp = await intento(undefined, `10.254.${Number(RUN.slice(2, 4))}.${Number(RUN.slice(4, 6))}`);
  ok("otra IP sin key sigue en 401 (el freno es por IP, no global)", otraIp === 401, `status=${otraIp}`);

  console.log("\n== R11: contexto por BSUID de quien escribió con teléfono ==");
  const inbound = (body) =>
    api("/api/dev/wa-mock/inbound", {
      method: "POST",
      body: JSON.stringify({ phoneNumberId: PN, ...body }),
    });
  const convDe = async (canonico) =>
    ((await api("/api/conversations")).json?.conversations ?? []).find(
      (c) => c.contact.phone === canonico
    );
  const mensajesDe = async (id) =>
    (await api(`/api/conversations/${id}/messages`)).json?.messages ?? [];
  const CANON = `524629${RUN}`;
  const BSU = `MX.r11.${RUN}`;
  const NOMBRE = `R11 BSUID ${RUN}`;
  await inbound({
    from: `5214629${RUN}`,
    fromUserId: BSU,
    name: NOMBRE,
    text: "hola, les escribo con mi número",
    waMessageId: `wamid.e2e.r11.tel.${RUN}`,
  });
  await hasta(async () => Boolean(await convDe(CANON)));
  const conv = await convDe(CANON);
  ok("el contacto nace con el teléfono como identidad", Boolean(conv));

  await inbound({
    fromUserId: BSU,
    name: NOMBRE,
    text: "y ahora sin número",
    waMessageId: `wamid.e2e.r11.bsu.${RUN}`,
  });
  const reconciliado = await hasta(async () =>
    conv ? (await mensajesDe(conv.id)).some((m) => m.text === "y ahora sin número") : false
  );
  ok("la ingesta reconcilia el mensaje solo-BSUID a la MISMA conversación", reconciliado);

  const bsuid = encodeURIComponent(`bsuid:${BSU}`);
  const porBsuid = await bot(`/api/bot/context?waIdentity=${bsuid}`);
  ok(
    "GET /api/bot/context?waIdentity=bsuid:<id> → 200 (antes 404)",
    porBsuid.res.status === 200,
    `status=${porBsuid.res.status}`
  );
  ok(
    "…y es el MISMO contacto y conversación (su identidad sigue siendo el teléfono)",
    porBsuid.json?.conversation?.id === conv?.id &&
      porBsuid.json?.contact?.waIdentity === CANON,
    JSON.stringify({ conv: porBsuid.json?.conversation?.id, contact: porBsuid.json?.contact })
  );
  const neutro = await bot(`/api/bot/context?identity=${bsuid}`);
  ok(
    "el nombre neutro `identity` resuelve igual",
    neutro.json?.conversation?.id === conv?.id,
    `status=${neutro.res.status}`
  );
  const nadie = await bot(
    `/api/bot/context?waIdentity=${encodeURIComponent(`bsuid:MX.r11.nadie.${RUN}`)}`
  );
  ok("un BSUID que nadie tiene sigue en 404", nadie.res.status === 404, `status=${nadie.res.status}`);
}

async function main() {
  if (!BOT_KEY || BOT_KEY.length < 16) {
    console.error("BOT_API_KEY ausente o corta (<16).");
    process.exit(1);
  }
  // El cerebro falso NO se necesita para R11 (ningún check exige respuesta del
  // agente); el interruptor del Agente queda apagado y el cerebro cerrado.
  try {
    await prep();
    await r11BotChecks();
  } catch (err) {
    failures++;
    console.error("ERROR FATAL:", err);
  } finally {
    try {
      if (cookie) await apagarAgente(api);
    } catch {}
  }
  console.log(`\n===== R11: ${checks - failures}/${checks} checks OK, ${failures} fallos =====`);
  process.exit(failures ? 1 : 0);
}

main();
