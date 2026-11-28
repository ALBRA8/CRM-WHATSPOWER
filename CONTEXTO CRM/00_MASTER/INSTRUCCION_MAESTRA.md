# INSTRUCCIÓN DE CONSTRUCCIÓN — CRM WHATSPOWER (WhatsPower)

**Estado:** VIGENTE — mandato del propietario del proyecto.
**Registrada:** 2026-11-27.
**Alcance:** regla superior de todo el proyecto. Ningún documento, decisión o
código puede contradecirla sin documentar el motivo y presentar el impacto.

## Inicio de Fase 4: Monorepo, modularización e integración

A partir de los documentos de auditoría y arquitectura de las fases anteriores,
se inicia la Fase 4 del proyecto WhatsPower.

**Objetivo:** comenzar la construcción de una plataforma CRM SaaS modular,
comercializable y preparada para trabajar con AGENTE-GENERAL como su único
cerebro de inteligencia y ejecución.

### 1. Antes de modificar código

Lee y utiliza como documentos rectores:

- `ARQUITECTURA_MAESTRA_CRM.md`
- `REPOSITORIOS_AUDITORIA.md`
- `MATRIZ_PARIDAD_VOCERO.md`
- `MATRIZ_LICENCIAS.md`
- `MODELO_MULTI_TENANT.md`
- `CONTRATOS_INTEGRACION.md`
- `ROADMAP_CONSTRUCCION.md`
- `RIESGOS_TECNICOS.md`

No contradigas estas decisiones sin documentar el motivo y presentar el impacto.

### 2. Regla principal: conservar VOCERO completo

VOCERO es la base funcional del CRM.

- Conserva sus 156 capacidades identificadas en la auditoría.
- No elimines funciones, módulos, flujos, pantallas ni comportamientos existentes.
- No reemplaces funcionalidades por versiones simplificadas.
- No marques una capacidad como implementada solo porque aparece en una matriz o interfaz.
- Cada capacidad debe tener una correspondencia verificable en el código y sus respectivas pruebas.
- Si alguna capacidad necesita adaptación, conserva su resultado funcional.

La matriz de paridad debe mantenerse actualizada durante toda la construcción.

### 3. Arquitectura del producto

Construye WhatsPower como un monorepo modular con responsabilidades claramente separadas.

**WHATSPOWER — CRM y entorno empresarial.** Debe gestionar: contactos y empresas;
conversaciones y bandeja omnicanal; WhatsApp y demás canales; leads, clientes y
oportunidades; embudos y pipelines comerciales; cotizaciones y seguimiento;
agenda y calendario; tareas y actividades; automatizaciones y constructor
visual; campañas, difusión y segmentación; documentos y conocimiento
empresarial; finanzas, reportes y métricas; usuarios, roles y permisos;
auditoría e integraciones; configuración y administración de organizaciones.

**AGENTE-GENERAL — único cerebro.** Debe seguir siendo un sistema independiente.
Es responsable de: razonamiento y toma de decisiones; memoria; herramientas y
ejecución; skills y plugins; MCP; workflows y scheduler; firewall y seguridad;
aprobaciones HITL; observabilidad; políticas de ejecución.

No dupliques estas responsabilidades dentro de WhatsPower. Conéctalo mediante
contratos y adaptadores versionados.

### 4. Integración de los demás proyectos

- **CRM-WHATSAPP:** aprovechar sus instaladores, plantillas, perfiles sectoriales, guiones y reglas comerciales.
- **CRM-ALBRA:** reconstruir las capacidades comerciales necesarias sin reutilizar código no autorizado.
- **WHATSPOWER:** incorporar las capacidades de su constructor visual de flujos.
- **WHATSPOWER-ULTRA:** reconstruir las capacidades de campañas, difusión y segmentación sin copiar código no autorizado.
- **VOCERO:** conservar su totalidad funcional.
- **AGENTE-GENERAL:** integrarlo como cerebro independiente.

No mezcles repositorios indiscriminadamente ni fuerces tecnologías incompatibles a compartir un mismo stack.

### 5. Multi-tenancy obligatorio

Diseña desde el inicio el aislamiento real entre organizaciones. Cada tenant
debe tener separados: usuarios y permisos; contactos y empresas; conversaciones
y canales; credenciales e integraciones; memoria y conocimiento;
automatizaciones; documentos; configuraciones; registros y auditoría.

Implementa PostgreSQL con aislamiento por tenant y RLS donde corresponda. No
confíes únicamente en filtros de frontend o parámetros enviados por el cliente.

**AGENTE-GENERAL no podrá activarse para producción hasta que su integración,
identidad y memoria estén aisladas correctamente por tenant y se hayan
verificado sus controles de seguridad.**

### 6. Licencias y propiedad intelectual

Respeta estrictamente la matriz de licencias. No reutilices código de CRM-ALBRA
ni WHATSPOWER-ULTRA sin autorización escrita. Las capacidades necesarias deben
reconstruirse mediante implementación independiente y especificaciones
funcionales, sin copiar código protegido. No incorpores Baileys/libsignal al
producto comercial. Utiliza APIs oficiales de los canales y respeta sus
políticas, permisos y consentimiento de los usuarios.

### 7. Forma de ejecutar esta fase

Trabaja por entregas pequeñas, verificables y reversibles. Orden de trabajo:

1. Preparar el monorepo y su estructura.
2. Definir aplicaciones, paquetes y límites de módulos.
3. Establecer contratos de integración versionados.
4. Modularizar VOCERO sin alterar su comportamiento.
5. Preparar la infraestructura multi-tenant.
6. Crear adaptadores para AGENTE-GENERAL.
7. Preparar la integración de canales y servicios.
8. Configurar pruebas automáticas de paridad y regresión.
9. Documentar cada decisión y cada cambio.

No avances a la siguiente etapa si la anterior rompe funcionalidades existentes.

### 8. Criterios obligatorios de aceptación

Una entrega solo se considera terminada cuando: compila correctamente; pasa
lint y verificaciones de tipos; supera sus pruebas automatizadas; no introduce
regresiones; conserva las capacidades de VOCERO que corresponden a esa entrega;
respeta los contratos de integración; no vulnera el aislamiento entre tenants;
tiene documentación técnica actualizada.

No declares una función como terminada si solo existe visualmente o tiene datos simulados.

### 9. Prohibiciones

- No rehacer el proyecto desde cero ignorando VOCERO.
- No eliminar funciones para acelerar el desarrollo.
- No crear un segundo agente que compita con AGENTE-GENERAL.
- No mezclar todos los sistemas en un único bloque de código.
- No introducir dependencias con licencias incompatibles.
- No hacer cambios masivos sin pruebas y posibilidad de reversión.
- No ocultar errores ni declarar avances que no estén comprobados.

### 10. Entrega de esta primera etapa

Al terminar, entrega: 1) estructura real del monorepo; 2) árbol de directorios;
3) responsabilidad de cada aplicación y paquete; 4) contratos iniciales de
integración; 5) estado de modularización de VOCERO; 6) matriz de capacidades
conservadas, adaptadas y pendientes; 7) resultado real de build, lint,
typecheck y pruebas; 8) riesgos detectados y decisiones pendientes; 9) archivos
modificados y creados.

**IMPORTANTE:** en esta primera etapa prioriza establecer una arquitectura
correcta y preservar el comportamiento existente. No intentes construir todo
WhatsPower de una sola vez. Primero deja una base sólida, comprobable y preparada
para crecer. El resultado debe ser un SaaS empresarial completo, no un
prototipo visual ni una colección de módulos desconectados.
