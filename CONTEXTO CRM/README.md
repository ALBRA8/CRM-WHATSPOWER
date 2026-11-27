# CONTEXTO CRM

## Memoria documental de continuidad del proyecto CRM WHATSPOWER (Vestro)

**Estado:** BASELINE INICIALIZADO — FASE 4 EN_CURSO
**Última actualización:** 2026-11-27
**Propósito:** conservar decisiones, auditorías, hallazgos, pruebas, integraciones, fallos, sesiones y conocimiento necesarios para construir el CRM SaaS multi-tenant Vestro sin repetir investigaciones y sin contradecir lo ya decidido.

## Naturaleza de esta memoria

Esta carpeta está implementada como Markdown versionado e índices. Es la
memoria de continuidad del proyecto: no es una base de datos vectorial ni
reemplaza al código y sus pruebas.

## Regla de fuente de verdad

- **Código + tests + evidencia de ejecución** son la fuente de verdad técnica.
- **PROJECT_STATE** (00_MASTER) es el inventario de lo que existe y de los alcances probados.
- **MATRIZ_PARIDAD_VOCERO** se mantiene viva durante toda la construcción: una capacidad no se marca como implementada solo porque aparece en la matriz o en la UI; exige correspondencia verificable en código y pruebas.
- No elevar PROPOSED / PLANNED / NOT_DEMONSTRATED a VERIFIED sin evidencia real (compilación, lint, typecheck, tests o E2E ejecutados).
- Los conteos de tests se copian como «reportados» hasta ejecutarlos nuevamente; los resultados de esta sesión quedan en 08_SESSIONS con su evidencia.
- No registrar secretos, tokens ni credenciales en este contexto.

## Documentos rectores (no se contradicen sin documentar motivo e impacto)

| Documento | Ubicación |
|---|---|
| Instrucción maestra de construcción (Fase 4) | `00_MASTER/INSTRUCCION_MAESTRA.md` |
| Estado del proyecto | `00_MASTER/PROJECT_STATE.md` |
| Arquitectura maestra | `00_MASTER/ARQUITECTURA_MAESTRA_CRM.md` |
| Modelo multi-tenant (RLS, T1-T15) | `00_MASTER/MODELO_MULTI_TENANT.md` |
| Roadmap de construcción (F0-F12) | `00_MASTER/ROADMAP_CONSTRUCCION.md` |
| Matriz de paridad VOCERO (156 capacidades) | `00_MASTER/MATRIZ_PARIDAD_VOCERO.md` |
| Glosario | `00_MASTER/GLOSSARY.md` |
| Auditoría de los 6 repositorios | `04_AUDITS/REPOSITORIOS_AUDITORIA.md` |
| Contratos de integración (15 operaciones) | `06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` |
| Riesgos técnicos (40+) | `07_FAILURES/RIESGOS_TECNICOS.md` |
| Matriz de licencias | `09_KNOWLEDGE/MATRIZ_LICENCIAS.md` |

## Estructura

```text
CONTEXTO CRM/
├── README.md
├── INDEX.md
├── 00_MASTER/ (INSTRUCCION_MAESTRA, PROJECT_STATE, ARCHITECTURE, MULTI_TENANT, ROADMAP, MATRIZ_PARIDAD, GLOSSARY)
├── 01_DECISIONS/DECISION_LOG.md
├── 02_PROCESSES/PROCESS_INDEX.md
├── 03_FINDINGS/FINDINGS_INDEX.md
├── 04_AUDITS/ (AUDIT_INDEX + REPOSITORIOS_AUDITORIA)
├── 05_TESTS/TEST_INDEX.md
├── 06_INTEGRATIONS/ (INTEGRATION_INDEX + CONTRATOS_INTEGRACION)
├── 07_FAILURES/ (FAILURE_INDEX + RIESGOS_TECNICOS)
├── 08_SESSIONS/ (SESSION_INDEX + sesiones fechadas)
└── 09_KNOWLEDGE/ (KNOWLEDGE_INDEX + MATRIZ_LICENCIAS)
```

## Cómo mantenerla

Después de cada fase, sprint, auditoría, prueba o cambio importante:

1. Actualizar PROJECT_STATE si cambia la fase, los bloqueadores o el próximo hito.
2. Registrar decisiones nuevas en DECISION_LOG (formato D-XXX).
3. Añadir hallazgos a FINDINGS_INDEX y auditorías a AUDIT_INDEX.
4. Registrar pruebas con su alcance real en TEST_INDEX (ejecutadas vs reportadas).
5. Actualizar integraciones, fallos, sesiones y conocimiento según corresponda.
6. Actualizar la matriz de paridad cuando cambie el estado de una capacidad.
7. Actualizar INDEX para que ningún documento útil quede invisible.
8. Citar commits, archivos y resultados de ejecución cuando existan.
9. No registrar secretos ni credenciales.
