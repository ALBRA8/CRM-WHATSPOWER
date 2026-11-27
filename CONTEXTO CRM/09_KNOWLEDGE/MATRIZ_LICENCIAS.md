# MATRIZ_LICENCIAS.md

**Proyecto:** Construcción del nuevo CRM SaaS multi-tenant
**Fase:** 1 — Auditoría legal de titularidad, licencias, dependencias y procedencia
**Fecha:** 2026-11-27
**Verificación:** lectura directa de archivos `LICENSE`, `THIRD_PARTY_NOTICES.md`, `package.json` y manifiestos de los seis repositorios clonados.

## 1. Principios legales del proyecto

1. **Público en GitHub no es open source.** Un repositorio sin licencia está protegido por defecto con «todos los derechos reservados»: ni copiar, ni modificar, ni distribuir, ni usar internamente con fines comerciales sin autorización del titular.
2. **Las obligaciones MIT no se eliminan.** Todo código MIT reutilizado conserva su aviso de copyright y la licencia original en el producto derivado.
3. **Ninguna marca de los proyectos de referencia aparece en la interfaz** del producto nuevo (Vocero, Nea, ALBRA, AILINK, WhatsPower, Ultra, WhatsOn, ManyChat, Zernio u otras).
4. **La titularidad se presume del copyright declarado** hasta verificación adicional. Ante duda, se pide confirmación por escrito al titular.
5. **Inventario vivo:** este documento se actualiza en cada fase; la dependencia no verificada se marca como tal y bloquea el release que la incorpore.
6. **Solo APIs oficiales en el producto comercial.** Transportes no oficiales de WhatsApp (Baileys/libsignal, GPL-3.0) quedan fuera del código base del producto; si algún módulo interno los usa para pruebas, queda confinado y excluido de distribución.

## 2. Inventario de los seis repositorios

| Repositorio | Archivo de licencia | Licencia | Titular (copyright) | Obligaciones al reutilizar | Verificación |
|---|---|---|---|---|---|
| `vocero-crm` v2.12.0 | `LICENSE` (texto MIT completo) | **MIT** | Kevin Belier (2026) | Conservar aviso de copyright y texto de licencia; puede modificarse, venderse y sub-licenciarse | ✅ Verificado |
| `CRM-WHATSAPP` | `LICENSE` (texto MIT completo) + `"license": "MIT"` | **MIT** | Agustín Medina — AILINK (2026) | Ídem MIT | ✅ Verificado |
| `CRM-ALBRA` v0.2.1 | **Sin `LICENSE`**; `package.json` **sin campo `license`**; landing dice «Todos los derechos reservados» | **Ninguna — todos los derechos reservados** | ALBRA / ALBRA GROUP (presunto, según contenido y contexto del ecosistema) | **Prohibida cualquier reutilización sin autorización expresa por escrito del titular** | ✅ Verificado |
| `WHATSPOWER` | `LICENSE` (texto MIT completo) + `"license": "MIT", "author": "ALBRA"` | **MIT** | ALBRA (2026) | Ídem MIT | ✅ Verificado |
| `WHATSPOWER-ULTRA` | **Sin `LICENSE`**; `package.json` `"private": true` **sin campo `license`** | **Ninguna — todos los derechos reservados** | ALBRA / ALBRA GROUP (presunto) | **Prohibida cualquier reutilización sin autorización expresa por escrito del titular** | ✅ Verificado |
| `AGENTE-GENERAL` v1.0.0 | `LICENSE` (MIT) + `pyproject.toml` `license = {text = "MIT"}` + `THIRD_PARTY_NOTICES.md` | **MIT** + terceros declarados | ALBRA (2026); OpenClaw Foundation para el código adaptado | Ídem MIT + mantener `THIRD_PARTY_NOTICES.md` | ✅ Verificado |

## 3. Hallazgo crítico: dos repositorios sin licencia

`CRM-ALBRA` y `WHATSPOWER-ULTRA` son públicos pero **no licenciados**. Consecuencias y caminos:

| Opción | Qué implica | Aplicabilidad |
|---|---|---|
| **A. Autorización expresa del titular** | El titular (propietario del proyecto, parte del mandato de este proyecto) añade un archivo `LICENSE` en cada repositorio upstream (p. ej. MIT o Apache-2.0, igual que hizo con `WHATSPOWER` y `AGENTE-GENERAL`) o firma una autorización interna de uso al nuevo producto | Camino recomendado: el ecosistema es propio y ya tiene el precedente de licenciar sus otros dos repos en MIT |
| **B. Reconstrucción clean-room** | Derivar cada capacidad únicamente de su **especificación funcional** (FICHA.md, AUDIT_REPORT.md, matriz de paridad), sin leer ni copiar código | Obligatorio para cualquier pieza que no reciba autorización |
| **C. Exclusión** | La capacidad se reconstruye desde cero con diseño propio, sin referencia al código | Último recurso pieza a pieza |

**Regla adoptada para este proyecto:** mientras no exista el archivo LICENSE o la autorización escrita, el código de `CRM-ALBRA` y `WHATSPOWER-ULTRA` se trata como **especificación de solo lectura** (se puede describir su comportamiento, no copiar su texto). El plan de construcción (Fases 4-9) trabaja así por defecto; si el titular licencia, las fases de `WHATSPOWER`/`ULTRA` pueden acelerarse reutilizando el motor MIT-compatible.

> Nota operativa: ambos repos están bajo la organización `ALBRA8` y coinciden en autoría con los repos ya licenciados MIT (`WHATSPOWER`, `AGENTE-GENERAL`). La probabilidad de obtener licencia es alta; la decisión formal y escrita es de los titulares y **queda registrada como acción pendiente de esta fase** (ver `ROADMAP_CONSTRUCCION.md`, Fase 1).

## 4. Terceros verificados dentro de los repos

| Componente | Repositorio de origen | Licencia | Evidencia | Obligación para el nuevo producto |
|---|---|---|---|---|
| **OpenClaw WhatsApp Extension** (adaptaciones: credenciales atómicas, backoff de reconexión, watchdog, lock de conexión, dedup durable) | `openclaw/openclaw` (extensions/whatsapp) | **MIT © OpenClaw Foundation** | `AGENTE-GENERAL/THIRD_PARTY_NOTICES.md` (leído completo; el código adaptado vive en `dashboard/src/server/openclaw-adapted.js`) | Mantener el aviso en `THIRD_PARTY_NOTICES` del producto |
| **libsignal / Baileys** (`@whiskeysockets/baileys`) | npm | **GPL-3.0 (libsignal)** — riesgo declarado por el propio CRM-WHATSAPP | `CRM-WHATSAPP/CLAUDE.md` («Baileys nunca en package.json»; modo prueba lo descarga aparte por GPL); daemons en CRM-ALBRA y dashboard de AGENTE-GENERAL | **No incluir en el código base del producto comercial.** Solo APIs oficiales; cualquier uso experimental queda confinado y excluido de distribución |
| **Tipografías self-hosted de VOCERO** (Archivo, IBM Plex Sans/Mono, Instrument Serif, Urbanist, Inter) | Google Fonts y similares | **SIL OFL** | `vocero-crm/src/app/fonts/licencias/` (licencias incluidas en el repo) | Reutilizar los archivos y **mantener los archivos de licencia** de las fuentes |
| **Ficha ClonaKit** (metodología clean-room) | Interna de ALBRA | Documentación de proceso | `WHATSPOWER/FICHA_CLONAKIT_MANYCHAT.md`, `WHATSPOWER-ULTRA/FICHA_CLONAKIT_WHATSON_ULTRA.md`, `parity/` | Referencia funcional únicamente; no copiar UI ni textos de los productos de referencia (ManyChat, WhatsOn, WATI, SleekFlow, Kommo) |
| `z-ai-web-dev-sdk` | SDK de entorno | Sin licencia verificada | `CRM-ALBRA/package.json` (acoplado como fallback) | **Excluir** del producto: es dependencia de entorno, no de producto |
| `next-auth` (declarada sin uso) | npm | MIT (estándar) | `CRM-ALBRA/package.json` (0 imports en `src/`) | No trasladar la dependencia muerta |

## 5. Dependencias comunes del nuevo núcleo (verificación pendiente formal)

El núcleo se construye sobre el stack de VOCERO. Las licencias de las dependencias principales se **confirmarán contra el lockfile en la Fase 4** (este listado es orientativo y no constituye la verificación final):

| Paquete | Uso | Licencia esperada (a confirmar) |
|---|---|---|
| next, react, react-dom | Framework/UI | MIT |
| drizzle-orm / drizzle-kit | ORM + migraciones | Apache-2.0 |
| better-auth + plugin organization | Auth + organizaciones | MIT |
| postgres (postgres.js) | Driver PostgreSQL | MIT |
| zod | Validación | MIT |
| tailwindcss + tailwindcss-animate | Estilos | MIT |
| lucide-react | Iconos | ISC |
| @dnd-kit/core, @dnd-kit/sortable | Kanban drag & drop | MIT |
| nanoid | IDs con prefijo | MIT |
| vitest, eslint, typescript, playwright | Tooling | MIT/Apache-2.0 |
| (agente) fastapi, uvicorn, pydantic, structlog | Núcleo Python de AGENTE-GENERAL | MIT/BSD/Apache-2.0 (a confirmar) |
| (agente) chromadb, sentence-transformers | Vector store opcional | Apache-2.0 (a confirmar) |
| (agente) cryptography, hvac | Cifrado / Vault | Apache-2.0/BSD (a confirmar) |

**Procedimiento de verificación** (Fase 4): generar `THIRD_PARTY_NOTICES.md` del producto con herramienta automática sobre `pnpm-lock.yaml` y `requirements.txt`, revisión humana de licencias copyleft, y gate de CI que falle si una dependencia con licencia no permitida (GPL/AGPL/SSPL/Proprietary) entra al árbol de dependencias de producción.

## 6. Matriz de reutilización con condición legal

| Repositorio | ¿Se puede usar su código? | Condición | Cómo entra a la plataforma |
|---|---|---|---|
| vocero-crm | Sí | MIT conservado | Código base del núcleo (adaptado); aviso MIT en `THIRD_PARTY_NOTICES` |
| CRM-WHATSAPP | Sí | MIT conservado | Patrones y piezas acotadas (instalador, resolver de presets); aviso MIT |
| CRM-ALBRA | **No (sin licencia)** | Hasta autorización o licencia del titular | Solo como especificación funcional citada |
| WHATSPOWER | Sí | MIT conservado | Servicio independiente casi íntegro; aviso MIT |
| WHATSPOWER-ULTRA | **No (sin licencia)** | Hasta autorización o licencia del titular | Especificación funcional; si se licencia, motor reutilizable |
| AGENTE-GENERAL | Sí | MIT + aviso OpenClaw | Servicio independiente **sin modificar**; integración solo por contratos |

## 7. Procedencia y riesgos documentados

1. **Historial git de CRM-ALBRA:** `OWNER_TODO.md` registra un **PAT compartido en chat pendiente de rotación** y la **purga del historial no ejecutada** (82 entradas `ROTACION-PENDIENTE`). Aunque no reutilicemos el código, si ese repo se licencia después, el producto nuevo **no debe clonar su historial**; solo se puede tomar el árbol con LICENSE añadido.
2. **Secretos en scripts E2E de CRM-ALBRA** (rutas de otra máquina, credenciales literales — hallazgo F6-8 del propio `AUDIT_REPORT.md`): reforzamiento de la regla del producto nuevo — ningún script versiona secretos ni rutas personales (gate de CI con escáner de secretos, heredado de las buenas prácticas de CRM-ALBRA).
3. **Marcas de referencia:** los nombres Vocero, Nea, ALBRA, AILINK, WhatsPower, WhatsPower-Ultra, WhatsOn, ManyChat, WATI, SleekFlow, Kommo, Zernio **no aparecen** en la UI del producto. Las menciones quedan restringidas a documentación técnica interna y a los avisos de licencia obligatorios.
4. **Cumplimiento de canales:** las campañas (ULTRA) y los flujos (WHATSPOWER) operan bajo consentimiento y base legal (el ecosistema ALBRA ya modela Ley 1581 de Habeas Data de Colombia); la plataforma generaliza el modelo de consentimiento y supresión por organización para cualquier jurisdicción del tenant.

## 8. Inventario de componentes del producto nuevo (plantilla inicial)

| Componente | Tipo | Origen | Licencia resultante del producto | Titularidad |
|---|---|---|---|---|
| Núcleo CRM (dominios, bandeja, pipeline, agenda, laboratorio) | Propio derivado | vocero-crm (MIT) adaptado | Licencia propia del producto | Titular del nuevo producto |
| Adaptador CRM↔AGENTE-GENERAL | Propio nuevo | — | Propia | Titular del nuevo producto |
| Motor de flujos (WHATSPOWER) | Tercero propio (MIT) | ALBRA | MIT conservado en su servicio | ALBRA |
| Motor de campañas (ULTRA) | Tercero propio (**sin licencia → pendiente**) | ALBRA | Pendiente de licencia o clean-room | ALBRA |
| Motor de inteligencia | Tercero propio (MIT) | ALBRA (albra-seed) | MIT conservado en su servicio | ALBRA |
| Perfiles/presets sectoriales | Propio nuevo (contenido original) | Inspirado funcionalmente en CRM-WHATSAPP | Propia | Titular del nuevo producto |
| Tipografías | Tercero (OFL) | Archivo, Inter, IBM Plex… | OFL conservada | Autores de las fuentes |
| Iconografía y UI kit | Propio | — | Propia | Titular del nuevo producto |
| Logotipo e identidad | Propio nuevo | — | Propia | Titular del nuevo producto |

## 9. Plantilla de avisos obligatorios del producto

```
THIRD_PARTY_NOTICES (fragmento inicial, se completa en Fase 4 con el lockfile)

1. vocero-crm — MIT License — Copyright (c) 2026 Kevin Belier
   https://github.com/kevinrivm/vocero-crm (componentes adaptados: núcleo CRM)
2. CRM-WHATSAPP — MIT License — Copyright (c) 2026 Agustín Medina (AILINK)
   https://github.com/ALBRA8/CRM-WHATSAPP (patrones de instalador y presets sectoriales)
3. WHATSPOWER — MIT License — Copyright (c) 2026 ALBRA
   https://github.com/ALBRA8/WHATSPOWER (servicio de flujos conversacionales)
4. AGENTE-GENERAL (albra-seed) — MIT License — Copyright (c) 2026 ALBRA
   https://github.com/ALBRA8/AGENTE-GENERAL (servicio de inteligencia)
   a. OpenClaw WhatsApp Extension — MIT License — Copyright OpenClaw Foundation
      https://github.com/openclaw/openclaw (adaptaciones declaradas en THIRD_PARTY_NOTICES original)
5. Tipografías — SIL Open Font License (Archivo, IBM Plex, Instrument Serif, Urbanist, Inter)
   (los archivos de licencia de cada fuente se incluyen en /fonts/licencias)
```

## 10. Acciones legales abiertas de la Fase 1

| # | Acción | Responsable | Estado |
|---|---|---|---|
| 1 | Añadir `LICENSE` (MIT) a `ALBRA8/CRM-ALBRA` y `ALBRA8/WHATSPOWER-ULTRA`, o autorización escrita de uso al nuevo producto | Titular ALBRA | Pendiente — bloquea solo la reutilización de código, no el plan clean-room |
| 2 | Rotar el PAT compartido documentado en `CRM-ALBRA/OWNER_TODO.md` | Titular ALBRA | Pendiente (independiente de este proyecto) |
| 3 | Confirmar titularidad exacta de `vocero-crm` y de `CRM-WHATSAPP` (individual: Kevin Belier, Agustín Medina/AILINK) y autorización de uso comercial si se requiere más allá de MIT | Dirección del proyecto | MIT ya permite uso comercial — acción de cortesía/registro |
| 4 | Generar `THIRD_PARTY_NOTICES.md` del producto desde lockfiles y publicarlo en el nuevo repositorio | Equipo de construcción (Fase 4) | Programado |
| 5 | Gate de CI contra licencias copyleft en dependencias de producción | Equipo de construcción (Fase 4) | Programado |
| 6 | No clonar historial git de repos con secretos pendientes de purga (CRM-ALBRA) | Equipo de construcción | Regla fija |
