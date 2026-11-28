# SESIÓN 2026-11-28-c — REBRAND: identidad única CRM WhatsPower

## 1. Objetivo y alcance autorizado

Orden del propietario (2026-11-28): el proyecto se llama **CRM WhatsPower**; el nombre anterior ya no existe y debe desaparecer de todo el sistema para evitar enredos y confusiones entre los repositorios del ecosistema.

Alcance autorizado y ejecutado: renombrado completo del nombre en el árbol de trabajo de `ALBRA8/CRM-WHATSPOWER` (código, documentación, infra, specs, plugin, manifests y lockfile), **sin reescribir el historial git** (sin force push, commits anteriores intactos) y **sin tocar el cerebro** (`AGENTE-GENERAL` sigue en `7f6e908`).

## 2. Hechos con evidencia

- **Inventario previo:** 1.165 coincidencias del nombre anterior en archivos rastreados (variantes en minúscula, CamelCase y MAYÚSCULAS), más un spec con el nombre en su slug (`apps/web/specs/001-*`), el plugin de Claude con una skill de configuración, y el script de entrypoint del contenedor.
- **Renombrado mecánico** con script idempotente (reemplazos a nivel de bytes, reglas específicas antes que genéricas): 383 archivos modificados. Correspondencia aplicada:
  - variantes de caja del nombre nuevo: minúscula `whatspower` (identificadores, slugs, rutas), CamelCase `WhatsPower` (marca e identificadores compuestos), MAYÚSCULAS `WHATSPOWER` (constantes y variables de entorno)
  - composiciones: `crm-whatspower` (slug del repositorio), `whatspower.app` (marca), `crm-whatspower-db` (base de datos), `@whatspower/*` (paquetes), correo E2E `@whatspower.test`
  - `x-whatspower-*` (cabeceras del contrato CRM del puente), `CRM_WHATSPOWER_VERSION` (versión publicada)
- **Renombres de ruta** con `git mv` (4): `specs/001-whatspower-core`, `plugin/whatspower`, `plugin/whatspower/skills/configurar-whatspower`, `whatspower-entrypoint.sh`.
- **Pulido manual:** línea de copyright de `LICENSE` («ALBRA — CRM WhatsPower»), `THIRD_PARTY_NOTICES.md`, comentario de `pnpm-workspace.yaml`, títulos de `ENTREGA_F5.md` y `ENTREGA_CIERRE_POSTF5.md`, `PROVENANCE.md`, README raíz y de `apps/web`.
- **Correcciones colaterales descubiertas al renombrar:** el typo heredado del nombre de imagen `crm-whatpower` se normalizó a `crm-whatspower` (compose, fly, render, tests, docs); tres enlaces `[AGENTE-GENERAL]` del README apuntaban al repo del CRM y ahora apuntan a `ALBRA8/AGENTE-GENERAL`.
- **Compatibilidad del puente verificada antes de renombrar:** el cerebro real (`AGENTE-GENERAL`) no contiene ninguna referencia al nombre anterior; su protocolo usa `x-albra-metadata`, por lo que las cabeceras `x-whatspower-*` (definidas en `apps/web/src/server/agents/brains/contract.ts`) son contrato CRM-side y se actualizaron junto con su arnés (`cerebro-falso.mjs`) y sus E2E.

## 3. Resultados de verificación

- Verificación del nombre anterior (`git grep -i`) sobre el árbol rastreado post-renombrado: **0 coincidencias** (el único resto está en metadatos internos de `.git/index`, que se regeneran con el commit).
- Los **60 `.json`** rastreados reparsean sin error (incl. `docs/openapi.json` y `src/server/integrations/api-v1/openapi.json`).
- `node --check` sobre todos los `.mjs`/`.js` rastreados: **0 fallos de sintaxis**.
- `pnpm-lock.yaml`: las 4 referencias de dependencia del paquete de contratos actualizadas al scope `@whatspower/contracts`.
- **Suite completa no ejecutada en esta sesión:** el sandbox de esta pasada no tiene `node_modules` instalados; la validación aquí es estática (grep + JSON + sintaxis). La suite (1.825 unitarias + batería multi-tenant + E2E) debe re-correrse en el entorno con dependencias antes del siguiente hito; los tests que fijan identificadores renombrados (p. ej. `manifests-plataformas.test.ts`, `version.test.ts`) se actualizaron en el mismo cambio, por lo que siguen en paridad con los manifests.

## 4. Decisiones tomadas

- **D-030** (`01_DECISIONS/DECISION_LOG.md`): identidad de marca única CRM WhatsPower; correspondencia de identificadores; no cambia protocolo del cerebro ni historial.
- `GLOSSARY.md` actualizado: **CRM WhatsPower** es el nombre oficial confirmado por el propietario (sustituye al nombre de trabajo provisional de D-012); ningún otro nombre debe usarse.
- El trazo visual de marca se conserva (es un glifo abstracto sin texto); el nombre en UI/docs sí cambia (`branding.ts` marca por defecto `WhatsPower`, `isWhatsPowerName` compara «whatspower»).

## 5. Pendientes y próximo paso

- Re-correr suite completa + batería multi-tenant + E2E en entorno con dependencias (host ≥8 GB para la corrida continua).
- La activación pública sigue **prohibida** sin autorización expresa del propietario (mandato F5 §7; checklist D-028 en el despliegue real).
- No registrar secretos ni credenciales (regla vigente).
