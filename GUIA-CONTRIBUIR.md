# Guía para contribuir — malla-fisi

Cómo está organizado el código y dónde meter mano para agregar lógica sobre la
matriz curricular, sin afectar el resto del sistema.

## Resumen

Aunque el repositorio tiene muchos archivos, **la lógica de la malla está
concentrada en `src/lib/`** y es TypeScript puro (sin React, sin UI). El
componente `MallaBuilder.tsx` (1350 líneas) corresponde únicamente a la capa de
presentación (el drag and drop); **no es necesario modificarlo para agregar
lógica de negocio.**

## El mapa, traducido a MVC

El código está separado en capas, igual que `horarios-unmsm`. Si vienen de
Spring Boot / MVC, esta es la equivalencia:

| MVC clásico            | Aquí (Next.js)                        | Archivo                                  |
|------------------------|----------------------------------------|------------------------------------------|
| **Modelo** (entidades) | Tipos + tabla Postgres                 | `src/lib/domain/types.ts`, `src/lib/data/db.ts` |
| **Dominio** (lógica)   | Funciones puras, sin UI ni DB          | `src/lib/domain/algorithms.ts`, `solver.ts`, `proposals.ts` |
| **Controlador** (API)  | Route handlers                         | `src/app/api/states/route.ts`            |
| **Vista** (UI)         | Componentes React                      | `src/components/*.tsx`                    |
| **Datos** (persistencia)| Neon SQL + localStorage + import/export | `src/lib/data/db.ts`, `storage.ts`, `import.ts`, `export.ts` |

> Next.js es full-stack: front y back viven en el mismo repo. No hay dos
> proyectos separados. Por eso el feedback loop es corto.

**Regla de dependencia** (la misma de horarios-unmsm): el **dominio no conoce
ni el framework ni la base de datos**. `data/` puede importar tipos de
`domain/`, pero `domain/` nunca importa de `data/`. Si necesitan SQL dentro de
un archivo de `domain/`, está mal ubicado.

## Dónde ubicar cada tipo de cambio

### Agregar una nueva regla o validación sobre la malla
(ej: "un ciclo no puede tener más de X créditos", "este curso choca con aquel")

→ `src/lib/domain/algorithms.ts`, función **`detectIssues`**.
Devuelve una lista de `Warning` con `level: "error" | "warning" | "info"`.
Se agrega el chequeo, se hace `push` de un nuevo warning y la interfaz lo muestra automáticamente.

### Cambiar cómo se organiza automáticamente la malla
→ `src/lib/domain/algorithms.ts`, función **`autoOrganize`**.
Es el algoritmo que reparte cursos por ciclo respetando prerrequisitos.

### Agregar una propuesta de arreglo automático
(el botón que sugiere cómo resolver un problema)

→ `src/lib/domain/proposals.ts`, función **`proposalsForWarning`**.
Cada warning puede generar propuestas (`place` / `move` / `remove`).
El `solver.ts` las aplica iterando hasta minimizar el "score" de errores.

### Cambiar el modelo de datos (agregar un campo a un curso)
→ `src/lib/domain/types.ts`. El punto de partida es la interface **`Course`**.
Si el campo se persiste en base de datos, ajustar también el `state` JSONB en
`src/lib/data/db.ts` (la tabla guarda todo el estado como JSON, no columna por campo).

### Cambiar la presentación (la interfaz)
→ `src/components/`. Cada pieza es un componente:
- `MallaBuilder.tsx` — el tablero principal (drag and drop). Es el grande.
- `CourseCard.tsx` — la tarjeta de un curso.
- `CycleColumn.tsx` — una columna = un ciclo.
- `IssuesPanel.tsx` — el panel que lista los warnings.
- `PrereqEditor.tsx` / `PrereqEdges.tsx` — edición y dibujo de prerrequisitos.

### Modificar el endpoint (guardar/cargar de la nube)
→ `src/app/api/states/route.ts` (POST = guardar, GET = listar) y
`src/app/api/states/[id]/route.ts` (un estado por id).
Usan Clerk para auth (`auth()`) y Neon/Postgres para guardar.

## Regla principal

> **La lógica nueva debe ubicarse en `src/lib/`, no en los componentes.**

Los componentes solo invocan las funciones de `src/lib/` y muestran el
resultado. La lógica de negocio dentro de un `.tsx` está mal ubicada. La
separación es estricta: `lib` contiene la lógica, `components` la presentación.

## Flujo de datos (de punta a punta)

```
types.ts          define qué es un Course / una Malla (el modelo)
   │
   ▼
algorithms.ts     detecta problemas + organiza automáticamente (servicio)
   │
   ▼
proposals.ts      propone arreglos para cada problema (servicio)
   │
   ▼
solver.ts         aplica propuestas iterando hasta resolver (servicio)
   │
   ▼
MallaBuilder.tsx  muestra todo y deja arrastrar cursos (vista)
   │
   ▼
storage.ts        guarda en el navegador (localStorage)
api/states        guarda en la nube (Postgres, requiere login)
```

## Correr el proyecto local

```bash
bun install     # instalar dependencias (NO usar npm)
bun dev         # arranca en http://localhost:3000
```

Se requiere un archivo `.env.local` con `DATABASE_URL` (Neon) y las llaves de
Clerk. Solicitarlas al responsable del repositorio; no deben subirse (ya están
en `.gitignore`).

## Git: flujo de contribución

```bash
git checkout -b feat/mi-cambio     # rama nueva; no trabajar directamente sobre main
# ... editar archivos en src/lib/ ...
git add src/lib/domain/algorithms.ts
git commit -m "feat: agrega validación de X"
git push origin feat/mi-cambio
# abrir Pull Request en GitHub para que el responsable del repo lo revise
```

Como primer ejercicio recomendado: agregar un único `Warning` nuevo en
`detectIssues` y verificar que aparece en la pantalla. Completar ese flujo
permite comprender el ciclo de extremo a extremo.
