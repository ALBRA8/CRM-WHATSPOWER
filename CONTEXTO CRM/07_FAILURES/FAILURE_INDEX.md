# FAILURE INDEX — riesgos activos, incidentes y prohibiciones

Registro completo de riesgos: `RIESGOS_TECNICOS.md` (40+ entradas). Este índice
sigue los riesgos con mayor exposición y los incidentes de construcción.

## Riesgos top (por exposición)

| ID | Riesgo | Exp. | Mitigación vigente |
|---|---|---|---|
| D2 | Memoria del agente sin tenant (SQLite, sin org_id) | 16 | D-014: mapeo `org:*` + backend Postgres RLS; producción bloqueada hasta verificación |
| L1 | CRM-ALBRA sin licencia | 15 | Cero código copiado; solo especificaciones (D-008) |
| L2 | WHATSPOWER-ULTRA sin licencia | 15 | Reconstrucción clean-room (D-009) |
| O1 | Sin backups ni restauración probada | 15 | Pendiente: backups automáticos + drill por tenant antes de datos reales |
| A1 | SSE mono-instancia | 12 | Backplane multi-replica en F5 |
| I1 | AGENTE-GENERAL sin validación de despliegue en producción | 12 | Auditoría A-011 en F7 antes de activar |
| I3 | Doble respuesta agente/humano | 12 | Contrato de despacho + handoff conservados; prueba E2E «una-respuesta» portada en S4.3 |

## Incidentes de construcción

| # | Incidente | Resolución |
|---|---|---|
| INC-001 (2026-11-27) | `pnpm-workspace.yaml` interno de VOCERO anidado en el monorepo | Retirado; `allowBuilds`/`overrides` al raíz; código fuente intacto (F-010) |

## Prohibiciones permanentes (del mandato)

1. No rehacer desde cero ignorando VOCERO.
2. No eliminar funciones para acelerar.
3. No crear un segundo agente que compita con AGENTE-GENERAL.
4. No mezclar los sistemas en un único bloque de código.
5. Sin dependencias con licencias incompatibles (Baileys/libsignal GPL-3.0, código de CRM-ALBRA/ULTRA).
6. Sin cambios masivos sin pruebas y reversión.
7. No ocultar errores ni declarar avances no comprobados.
