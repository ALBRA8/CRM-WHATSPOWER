# PROVENANCE — apps/web

- **Origen:** https://github.com/ALBRA8/vestro-crm (VESTRO CRM)
- **Commit exacto migrado:** `aa90a8146f05c836d0e1e242cb7f137e07b06e32`
  (Merge pull request #215 from ALBRA8/release/2.12.0)
- **Versión:** 2.12.0 · **Licencia:** MIT (ver THIRD_PARTY_NOTICES.md en la raíz del monorepo)
- **Fecha de migración:** 2026-11-27
- **Modificaciones aplicadas en la migración:** ninguna sobre el código fuente.
  Solo se retiró `pnpm-workspace.yaml` interno (su contenido `allowBuilds` y
  `overrides` se trasladó al workspace raíz del monorepo; pnpm solo lee el
  workspace raíz). El `package.json` conserva sus scripts y dependencias.

Regla vigente (instrucción maestra, §2): VESTRO se conserva completo. Cualquier
cambio futuro sobre esta carpeta debe preservar el comportamiento y quedar
registrado en `CONTEXTO CRM/` (sesiones + matriz de paridad).
