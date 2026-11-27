# NOTICE — Atribuciones de terceros

Este repositorio combina código nuevo (MIT, ALBRA) con código heredado bajo sus
licencias originales. Toda incorporación está registrada en
`CONTEXTO CRM/09_KNOWLEDGE/MATRIZ_LICENCIAS.md`.

| Componente | Origen | Licencia | Ubicación |
|---|---|---|---|
| Núcleo CRM (28 páginas, 142 rutas API, 43 tablas, 65 specs) | VOCERO CRM v2.12.0 — Kevin Belier | MIT | `apps/web` (procedencia en `apps/web/PROVENANCE.md`) |
| Perfiles sectoriales (clínica, inmobiliaria, reformas, genérico) | CRM-WHATSAPP — AILINK | MIT | `packages/presets` (atribución en su README) |
| Motor de flujos (12 nodos, locks, idempotencia) | WHATSPOWER | MIT | integración futura en `services/flows` (Fase 9) |
| Cerebro de IA y ejecución | AGENTE-GENERAL | MIT | repositorio independiente; integración por contratos (`packages/contracts`) |

## Prohibiciones vigentes (ver MATRIZ_LICENCIAS.md)

- **No reutilizar código** de CRM-ALBRA (sin licencia) ni de WHATSPOWER-ULTRA (sin
  licencia): solo especificaciones funcionales y reconstrucción clean-room con
  autorización escrita del autor.
- **No incorporar Baileys/libsignal** (GPL-3.0) al producto comercial: solo APIs
  oficiales de canal (Meta Cloud API, etc.).

La verificación de licencias desde lockfile y la generación de
`THIRD_PARTY_NOTICES` son parte del sprint S4.1 (ver `CONTEXTO CRM/00_MASTER/PROJECT_STATE.md`).
