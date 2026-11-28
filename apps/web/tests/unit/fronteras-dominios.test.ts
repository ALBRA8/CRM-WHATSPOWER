/**
 * fronteras-dominios.test.ts — Vigía de fronteras entre los 14 dominios (S4.3).
 *
 * Congela el grafo REAL de dependencias entre dominios de `src/server` para que
 * cualquier acoplamiento nuevo sea una decisión consciente (hay que editar este
 * archivo a propósito). Verifica:
 *  1. Los 14 dominios de ARQUITECTURA_MAESTRA_CRM.md §7 + Platform existen.
 *  2. Los 4 dominios stub (audit, billing, campaigns, automation) contienen
 *     solo su README — sin código, sin declararse implementados.
 *  3. El grafo de imports entre dominios es EXACTAMENTE el congelado (sin
 *     aristas nuevas ni desaparecidas sin revisión).
 *  4. No hay ciclos de archivo NUEVOS: los 2 conocidos (1 ciclo real de valores
 *     heredado de VOCERO en conversations/inbox y 1 benigno de solo-tipos en
 *     integrations/mcp) son los únicos permitidos y están documentados.
 *  5. Las 13 rutas bot congeladas en packages/contracts existen como archivos
 *     de ruta en apps/web (el contrato versionado se respeta).
 *  6. Los servicios satélite consumen @whatspower/contracts (no duplican contratos).
 *  7. El conteo de rutas API del núcleo sigue siendo 143.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const WEB_ROOT = join(import.meta.dirname, "..", "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const SERVER = join(WEB_ROOT, "src", "server");
const CONTRACTS_SRC = join(REPO_ROOT, "packages", "contracts", "src");

const DOMINIOS_MAESTRA = [
  "identity", "organizations", "crm", "conversations", "channels", "agents",
  "knowledge", "automation", "scheduling", "campaigns", "attribution",
  "billing", "integrations", "audit",
] as const;
const PLATFORM = "platform";
const STUBS = ["audit", "billing", "campaigns", "automation"] as const;

const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

function resolveImport(spec: string, fromFile: string): string | null {
  let target: string;
  if (spec.startsWith("@/")) target = join(WEB_ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) target = join(fromFile.replace(/\/[^/]+$/, ""), spec);
  else return null;
  for (const ext of EXTS) {
    const cand = target + ext;
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

/** imports (estáticos o dinámicos) de un archivo; devuelve {spec, typeOnly}. */
const RE_IMPORT =
  /(?:import|export)\s+(type\s+)?[\s\S]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|export\s+\*\s+from\s*['"]([^'"]+)['"]/g;

function importsDe(archivo: string): { spec: string; typeOnly: boolean }[] {
  const src = readFileSync(archivo, "utf8");
  const out: { spec: string; typeOnly: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = RE_IMPORT.exec(src)) !== null) {
    const spec = m[2] || m[3] || m[4];
    if (spec) out.push({ spec, typeOnly: Boolean(m[1]) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1 y 2 — dominios presentes y stubs honestos
// ---------------------------------------------------------------------------
describe("fronteras: los 14 dominios + Platform", () => {
  it("existen exactamente los 15 directorios de la arquitectura maestra", () => {
    const dirs = readdirSync(SERVER).filter((d) =>
      statSync(join(SERVER, d)).isDirectory()
    ).sort();
    expect(dirs).toEqual([...DOMINIOS_MAESTRA, PLATFORM].sort());
  });

  it("los 4 dominios stub contienen solo su README (sin código, sin declararse implementados)", () => {
    for (const stub of STUBS) {
      const contenido = readdirSync(join(SERVER, stub)).sort();
      expect(contenido, `stub ${stub}`).toEqual(["README.md"]);
      const readme = readFileSync(join(SERVER, stub, "README.md"), "utf8");
      expect(readme).toMatch(/Sin código|todavía|stub|Stub|pendiente/i);
    }
  });
});

// ---------------------------------------------------------------------------
// 3 — grafo de dependencias entre dominios congelado
// ---------------------------------------------------------------------------
const archivosPorDominio: Record<string, string[]> = {};
for (const d of [...DOMINIOS_MAESTRA, PLATFORM]) {
  archivosPorDominio[d] = walk(join(SERVER, d));
}
const dominioDe = new Map<string, string>();
for (const [d, files] of Object.entries(archivosPorDominio))
  for (const f of files) dominioDe.set(f, d);

function grafoEntreDominios() {
  const edges = new Map<string, Set<string>>();
  const ciclosValor: string[][] = []; // ciclos del grafo RUNTIME (sin aristas de solo-tipos)
  const ciclosFuente: string[][] = []; // ciclos del grafo FUENTE (incluye aristas de tipo)
  const grafoRuntime = new Map<string, Set<string>>();
  const grafoFuente = new Map<string, Set<string>>();
  for (const [dom, files] of Object.entries(archivosPorDominio)) {
    for (const f of files) {
      for (const { spec, typeOnly } of importsDe(f)) {
        const resuelto = resolveImport(spec, f);
        if (!resuelto) continue;
        const destino = dominioDe.get(resuelto);
        if (destino && destino !== dom) {
          const key = `${dom}->${destino}`;
          if (!edges.has(key)) edges.set(key, new Set());
          edges.get(key)!.add(f);
        }
        if (dominioDe.has(resuelto)) {
          if (!grafoFuente.has(f)) grafoFuente.set(f, new Set());
          grafoFuente.get(f)!.add(resuelto);
          if (!typeOnly) {
            if (!grafoRuntime.has(f)) grafoRuntime.set(f, new Set());
            grafoRuntime.get(f)!.add(resuelto);
          }
        }
      }
    }
  }
  const buscarCiclos = (grafo: Map<string, Set<string>>) => {
    const BLANCO = 0, GRIS = 1, NEGRO = 2;
    const color = new Map([...dominioDe.keys()].map((f) => [f, BLANCO]));
    const pila: string[] = [];
    const ciclos: string[][] = [];
    const dfs = (u: string) => {
      color.set(u, GRIS);
      pila.push(u);
      for (const v of grafo.get(u) ?? []) {
        if (color.get(v) === GRIS) {
          ciclos.push(pila.slice(pila.indexOf(v)).concat(v));
        } else if (color.get(v) === BLANCO) dfs(v);
      }
      pila.pop();
      color.set(u, NEGRO);
    };
    for (const f of dominioDe.keys()) if (color.get(f) === BLANCO) dfs(f);
    return ciclos;
  };
  ciclosValor.push(...buscarCiclos(grafoRuntime));
  ciclosFuente.push(...buscarCiclos(grafoFuente));
  return { edges, ciclosValor, ciclosFuente };
}

/** Grafo congelado el día de S4.3 (2026-11-27) tras la reorganización S4.2.
 *  Clave: "origen->destino", valor: nº de archivos importadores.
 *  Todo cambio aquí es una decisión de frontera consciente: actualizar esta
 *  tabla a propósito y documentarla en CONTEXTO CRM/01_DECISIONS. */
const GRAFO_CONGELADO: Record<string, number> = {
  "agents->channels": 4,
  "agents->conversations": 6,
  "agents->crm": 1,
  "agents->organizations": 2,
  "agents->platform": 6,
  "agents->scheduling": 1,
  "attribution->channels": 2,
  "attribution->conversations": 2,
  "channels->conversations": 9,
  "channels->platform": 1,
  "conversations->agents": 2,
  "conversations->attribution": 1,
  "conversations->channels": 10,
  "conversations->crm": 1,
  "conversations->platform": 6,
  "crm->agents": 1,
  "crm->attribution": 2,
  "crm->conversations": 2,
  "crm->platform": 5,
  "identity->conversations": 1,
  "integrations->agents": 2,
  "knowledge->agents": 1,
  "knowledge->platform": 3,
  "organizations->agents": 1,
  "organizations->platform": 1,
  "organizations->scheduling": 1,
  "platform->agents": 2,
  "platform->attribution": 1,
  "platform->channels": 3,
  // F5: la segunda arista es /api/health observando el estado del backplane
  // SSE (server/conversations/events/backplane.ts) — decisión consciente de
  // observabilidad, read-only, documentada en ENTREGA_F5.md.
  "platform->conversations": 2,
  "platform->crm": 1,
  "platform->integrations": 1,
  "platform->organizations": 1,
  "platform->scheduling": 3,
  "scheduling->conversations": 1,
  "scheduling->crm": 1,
  "scheduling->platform": 3,
};

describe("fronteras: grafo de dependencias entre dominios", () => {
  const { edges } = grafoEntreDominios();

  it("no hay aristas nuevas entre dominios (grafo congelado)", () => {
    const actuales: Record<string, number> = {};
    for (const [k, v] of edges) actuales[k] = v.size;
    for (const [k, n] of Object.entries(GRAFO_CONGELADO)) {
      expect(actuales[k], `arista ${k} sigue existiendo`).toBe(n);
    }
    const nuevas = Object.keys(actuales).filter((k) => !(k in GRAFO_CONGELADO));
    expect(nuevas, `nuevas aristas sin revisión: ${nuevas.join(", ")}`).toEqual([]);
  });

  it("los pares bidireccionales heredados son exactamente los 12 documentados", () => {
    const pares = new Set<string>();
    for (const k of edges.keys()) {
      const [a, b] = k.split("->");
      if (edges.has(`${b}->${a}`)) pares.add([a, b].sort().join("|"));
    }
    expect([...pares].sort()).toEqual(
      [
        "agents|conversations", "agents|crm", "agents|organizations", "agents|platform",
        "attribution|conversations", "channels|conversations", "channels|platform",
        "conversations|crm", "conversations|platform", "crm|platform",
        "organizations|platform", "platform|scheduling",
      ].sort()
    );
  });
});

// ---------------------------------------------------------------------------
// 4 — ciclos a nivel de archivo congelados (heredados, documentados)
// ---------------------------------------------------------------------------
describe("fronteras: ciclos de import entre archivos", () => {
  const { ciclosValor, ciclosFuente } = grafoEntreDominios();

  it("en RUNTIME (imports reales) el único ciclo es el heredado de VOCERO en conversations/inbox (documentado, pendiente de refactor futuro)", () => {
    expect(ciclosValor.length).toBe(1);
    const ciclo = ciclosValor[0] ?? [];
    const rutas = ciclo.map((f) => relative(SERVER, f)).join(" -> ");
    expect(rutas).toContain("conversations/inbox");
    // la cadena exacta conocida: ingest -> reacciones -> send -> ingest
    expect(rutas).toContain("ingest.ts");
    expect(rutas).toContain("reacciones.ts");
    expect(rutas).toContain("send.ts");
  });

  it("en FUENTE existe además un ciclo benigno de solo-tipos en integrations/mcp (se borra en runtime)", () => {
    expect(ciclosFuente.length).toBe(2);
    const extra = ciclosFuente.find((c) => c.length > 0 && !relative(SERVER, c[0] ?? "").startsWith("conversations/inbox"));
    expect(extra && relative(SERVER, extra[0] ?? "")).toContain("integrations/mcp");
  });
});

// ---------------------------------------------------------------------------
// 5 — las 13 rutas bot del contrato versionado existen en el núcleo
// ---------------------------------------------------------------------------
function rutasBotDelContrato(): { method: string; path: string }[] {
  const src = readFileSync(join(CONTRACTS_SRC, "bot-api.ts"), "utf8");
  const inicio = src.indexOf("export const BOT_API_V1_ROUTES");
  const fin = src.indexOf("] as const", inicio);
  expect(inicio, "BOT_API_V1_ROUTES presente en el contrato").toBeGreaterThan(-1);
  const bloque = src.slice(inicio, fin);
  const out: { method: string; path: string }[] = [];
  const re = /\{\s*method:\s*"([A-Z]+)",\s*path:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bloque)) !== null) {
    const metodo = m[1];
    const ruta = m[2];
    if (metodo && ruta) out.push({ method: metodo, path: ruta });
  }
  return out;
}

function rutaExiste(pathContrato: string): boolean {
  // /api/bot/llm/{ruta} -> src/app/api/bot/llm/[...ruta]/route.ts
  // /api/bot/media/{id} -> src/app/api/bot/media/[mediaId]/route.ts
  const PARAMS: Record<string, string> = { "{ruta}": "[...ruta]", "{id}": "[mediaId]", "{mediaId}": "[mediaId]" };
  const partes = pathContrato.replace(/^\//, "").split("/").map((p) => PARAMS[p] ?? p);
  const archivo = join(WEB_ROOT, "src", "app", ...partes, "route.ts");
  return existsSync(archivo);
}

describe("fronteras: contratos versionados respetados", () => {
  it("las 13 rutas bot congeladas en packages/contracts existen como route.ts en apps/web", () => {
    const rutas = rutasBotDelContrato();
    expect(rutas.length).toBe(13);
    for (const r of rutas) {
      expect(rutaExiste(r.path), `ruta bot ${r.method} ${r.path} existe en el núcleo`).toBe(true);
    }
  });

  it("los servicios satélite consumen @whatspower/contracts (no duplican contratos)", () => {
    for (const svc of ["agent-gateway", "flows", "campaigns"]) {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "services", svc, "package.json"), "utf8"));
      expect(pkg.dependencies?.["@whatspower/contracts"], `${svc} depende de contracts`).toBe("workspace:*");
    }
  });

  it("el núcleo conserva exactamente 143 rutas API", () => {
    const contar = (dir: string): number => {
      let n = 0;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) n += contar(p);
        else if (e.name === "route.ts") n += 1;
      }
      return n;
    };
    // 142 → 143: POST /api/demo/sesion (acceso al demo sin registro,
    // DEMO_MODE=on). Decisión consciente: ruta pública nueva con bandera
    // opcional y rate limit propio (FR-062); apagada responde 404 mudo, así
    // que la superficie real de la instancia no cambia.
    expect(contar(join(WEB_ROOT, "src", "app", "api"))).toBe(143);
  });
});
