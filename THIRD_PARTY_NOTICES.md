# THIRD_PARTY_NOTICES — Atribuciones de terceros

Este repositorio combina código nuevo (MIT, ALBRA — proyecto CRM WhatsPower) con código
heredado que conserva su licencia original. Este archivo es el registro legal
de esas atribuciones, según exige cada licencia de origen.

## 1. Núcleo CRM — `apps/web`

Contiene código heredado de un proyecto CRM anterior (v2.12.0), licenciado
bajo la MIT License. El aviso de copyright y de permiso original, cuya
conservación exige la licencia MIT, se reproduce íntegro a continuación y se
aplica al código heredado contenido en `apps/web` (incluido `packages/presets`,
derivado de otro proyecto MIT de la misma procedencia):

```
MIT License

Copyright (c) 2026 Kevin Belier

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

La procedencia exacta (repositorio de origen, commit migrado y fecha) está
registrada internamente en `apps/web/PROVENANCE.md`. Este aviso no afecta al
funcionamiento, a la marca ni a la comercialización del producto: es el
requisito mínimo de la licencia MIT para el código heredado.

## 2. Perfiles sectoriales — `packages/presets`

Perfiles sectoriales (clínica, inmobiliaria, reformas, genérico) derivados de
un proyecto MIT (AILINK). La atribución correspondiente se cubre por el mismo
mecanismo: el aviso MIT aplicable acompaña a este repositorio completo.

## 3. Prohibiciones vigentes (ver `CONTEXTO CRM/09_KNOWLEDGE/MATRIZ_LICENCIAS.md`)

- **No reutilizar código** de CRM-ALBRA ni de WHATSPOWER-ULTRA (sin licencia):
  solo especificaciones funcionales y reconstrucción clean-room con autorización
  escrita del autor.
- **No incorporar Baileys/libsignal** (GPL-3.0) al producto comercial: solo APIs
  oficiales de canal (Meta Cloud API, etc.).
