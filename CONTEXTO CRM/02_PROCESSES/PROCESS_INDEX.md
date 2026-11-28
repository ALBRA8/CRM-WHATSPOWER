# PROCESS INDEX — procesos de trabajo del proyecto

| # | Proceso | Documento/sección | Estado |
|---|---|---|---|
| P-001 | Flujo de fases F0-F12 y dependencias duras | `00_MASTER/ROADMAP_CONSTRUCCION.md` §0 | VIGENTE |
| P-002 | Criterios obligatorios de aceptación de una entrega | `00_MASTER/INSTRUCCION_MAESTRA.md` §8 | VIGENTE |
| P-003 | Definición de Hecho global (código, typecheck/lint/build/test, contrato, auditoría, docs, sin secretos) | `00_MASTER/ROADMAP_CONSTRUCCION.md` «Definición de Hecho» | VIGENTE |
| P-004 | Mantenimiento de la matriz de paridad (capacidad = código + prueba verificable) | `00_MASTER/MATRIZ_PARIDAD_VOCERO.md` cabecera | VIGENTE |
| P-005 | Batería de pruebas de fuga multi-tenant T1-T15 en CI | `00_MASTER/MODELO_MULTI_TENANT.md` §9 | DEFINIDO — ejecución en F5 |
| P-006 | Evolución de contratos (/v1 compatible, /v2 + deprecación, prueba de vigía) | `06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §12 | VIGENTE |
| P-007 | Mantenimiento de CONTEXTO CRM tras cada entrega | `README.md` «Cómo mantenerla» | VIGENTE |
| P-008 | Verificación de licencias desde lockfile + THIRD_PARTY_NOTICES | `09_KNOWLEDGE/MATRIZ_LICENCIAS.md`; `THIRD_PARTY_NOTICES.md` raíz | DEFINIDO — parte de S4.1 |
| P-009 | Regla de migración destructiva: nunca sin backup + revisión + staging | `00_MASTER/MODELO_MULTI_TENANT.md` §4.4 | VIGENTE |
| P-010 | Estructura de una sesión de trabajo (08_SESSIONS): objetivo, hechos con evidencia, resultados de verificación, próximo paso | `08_SESSIONS/SESSION_INDEX.md` | VIGENTE |

## Procedimiento estándar de una entrega (resumen operativo)

1. Elegir el sprint del roadmap; leer sus criterios de aceptación.
2. Construir en entregas pequeñas, verificables y reversibles (rama o commit independiente).
3. Ejecutar `pnpm typecheck && pnpm lint && pnpm test && pnpm build` y registrar la salida real (comandos + códigos de salida + conteos).
4. Verificar que no se eliminó ninguna capacidad de VOCERO (matriz de paridad).
5. Si el toque toca un contrato: publicar el cambio en `packages/contracts` + prueba de vigía.
6. Actualizar CONTEXTO CRM (PROJECT_STATE, TEST_INDEX, SESSION, DECISION_LOG si hubo decisiones).
7. Commit con mensaje descriptivo y push.
