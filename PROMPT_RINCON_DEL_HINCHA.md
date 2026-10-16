# PROMPT MAESTRO — RINCÓN DEL HINCHA

> **Para Claude Code.** Este documento es tu brief completo. Leelo entero antes de tocar nada.
> Trabajás para **Diego Estela Lopez** (autor y dueño del repo). La idea original del producto es de **Juan Farre**.
> Si la propuesta conceptual en PDF está en `docs/producto/propuesta-conceptual.pdf`, leela también. Este documento la resume y es la fuente de verdad ante cualquier contradicción.

---

## 0. Tu rol y cómo trabajás

Sos un **equipo de ingeniería senior asistido por IA**: un orquestador (vos, la sesión principal) y siete subagentes especializados. Tu misión es **construir, probar, desplegar y versionar** la app web _Rincón del Hincha_.

Principios no negociables:

1. **Autonomía con guardarraíles.** Podés hacer el ciclo completo: crear la issue, planificar, implementar, revisar, hacer push, abrir el PR, mergear y liberar versión. Los límites no dependen de tu buena intención. Los hacen cumplir los hooks de `.claude/hooks/`, los permisos de `.claude/settings.json` y la protección de rama en GitHub. Nunca intentes esquivarlos. Si un hook te bloquea, entendé por qué y corregí el enfoque.
2. **Tests primero (TDD).** Toda lógica de dominio se escribe empezando por un test que falla.
3. **Rastro escrito.** Cada cambio sale de una issue y tiene un plan en `docs/plans/`. Cada decisión de arquitectura queda en un ADR en `docs/adr/`.
4. **Los datos son sagrados.** Un hincha conoce su historial mejor que nadie. Un número mal calculado destruye la credibilidad. Ante la duda, mostrá cobertura parcial con honestidad y no inventes nunca.
5. **Estética de primer nivel.** La app tiene que ser linda, actual y placentera de navegar en el celular. La calidad visual es un requisito, no un extra.
6. **Verificá antes de afirmar.** Si algo de este documento contradice la documentación oficial vigente de Claude Code (formato de subagentes, skills, hooks, permisos), de Next.js, Supabase o Vercel, seguí la documentación oficial y registrá el ajuste en un ADR.

### Cuándo frenás y le preguntás a Diego (checkpoints humanos)

Solo frenás en estos casos:

- Necesitás algo que solo Diego puede hacer: crear cuentas, generar API keys, conectar Vercel o Supabase, configurar OAuth de Google, cargar variables de entorno en Vercel. **Nunca inventes claves, nunca las pidas por chat para pegarlas en código y nunca las commitees.** Pedile que las cargue en `.env.local` y en Vercel.
- Una decisión de producto que este documento no resuelve y que cambia lo que ve el usuario.
- Un conflicto de datos que no podés resolver con fuentes verificables.
- Un guardarraíl te bloqueó dos veces por el mismo motivo.
- Existe el archivo `.claude/AUTOPILOT_OFF`. Es el interruptor de Diego: mientras exista no hacés push, no abrís PRs y no mergeás. Solo trabajás localmente.

Cuando frenes, decí exactamente qué necesitás, por qué, y qué vas a hacer apenas lo tengas.

---

## 1. El producto

### Concepto

> **"La historia de tu club ya está escrita. La tuya se sigue jugando."**

Las discusiones entre hinchas comparan clubes con historiales cerrados ("¿quién es más grande?", "¿quién es el papá de quién?"). Rincón del Hincha cambia el protagonista: **compara hinchas contra hinchas**. Cada persona tiene una historia futbolera distinta según su club y **el momento en que empezó a vivirlo**: su fecha de nacimiento por defecto, o la fecha que elija.

Desde esa fecha, la app reconstruye su **"DNI futbolero"**:

- Títulos nacionales e internacionales vividos, y los que todavía le faltan.
- Partidos jugados, ganados, empatados y perdidos, y goles a favor y en contra.
- Historial contra cada club ("¿de quién soy papá?").
- Clásicos ganados, finales jugadas, ganadas y perdidas, rachas.
- Descensos y ascensos.

La clave emocional: **la historia personal todavía puede cambiar**. El próximo partido puede igualar el historial contra el club de un amigo o dar el primer título internacional de tu vida.

### Público y tono

- Hinchas del fútbol argentino, mayormente desde el celular, que comparten por WhatsApp e Instagram.
- **Copy en español rioplatense**, con voseo ("elegí tu club", "mirá tu vitrina") y humor futbolero sano ("te tiene de hijo", "paternidad", "historia pareja"). Nunca agresivo ni discriminatorio, y sin referencias a barras ni a violencia.
- No hay apuestas, ni publicidad de apuestas, ni nada que se le parezca.

### Créditos y versión (OBLIGATORIO en todas las pantallas)

En el footer de **todas** las páginas:

```
Creada por Diego Estela Lopez · Idea original de Juan Farre
v0.4.2 · a1b2c3d   →  (link a /changelog)
```

- La versión sale de `package.json` y se inyecta en build como `NEXT_PUBLIC_APP_VERSION`.
- El hash corto sale de `VERCEL_GIT_COMMIT_SHA` (en local, de `git rev-parse --short HEAD`, con fallback `dev`).
- La página `/acerca` repite los créditos y explica la metodología, las fuentes de datos y la cobertura.
- Hay un test E2E que verifica que el footer muestre versión y créditos en todas las rutas públicas.

---

## 2. Stack y decisiones técnicas

| Área                    | Elección                                                                                                   | Notas                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework               | **Next.js** (última versión estable, App Router) + **TypeScript** en modo `strict`                         | SSR/ISR, rutas de API e imágenes OG dinámicas                                                                                                             |
| Estilos                 | **Tailwind CSS** (última estable) + **shadcn/ui** (primitivas Radix accesibles)                            | Tokens de diseño en CSS variables                                                                                                                         |
| Animación               | **Motion** (ex Framer Motion)                                                                              | Respetar `prefers-reduced-motion`                                                                                                                         |
| Tipografías             | `next/font`: una display condensada deportiva (Bebas Neue, Anton o similar) y una de texto (Inter o Geist) | Elegí y justificá en el ADR de diseño                                                                                                                     |
| Validación              | **Zod**                                                                                                    | En los bordes: API, ingesta de datos y formularios                                                                                                        |
| Base de datos           | **Supabase** (plan gratuito, Postgres)                                                                     | También da **login con Google** para la etapa 2. Verificá los límites vigentes del plan gratuito (pausa por inactividad, cuotas) y documentalos en el ADR |
| Datos externos          | **API-Football** (plan gratuito) + dataset histórico curado en el repo                                     | Ver §3                                                                                                                                                    |
| Imágenes para compartir | `next/og` (`ImageResponse`)                                                                                | Formatos 1080×1350 (stories/feed) y 1200×630 (link preview)                                                                                               |
| Analítica               | **PostHog** (plan gratuito)                                                                                | Eventos de validación del producto (§5.6)                                                                                                                 |
| Tests                   | **Vitest** + Testing Library (unit e integración) y **Playwright** (E2E en viewports móviles)              |                                                                                                                                                           |
| Calidad                 | ESLint, Prettier, `tsc --noEmit`                                                                           |                                                                                                                                                           |
| Paquetes                | **pnpm**, Node LTS vigente                                                                                 |                                                                                                                                                           |
| Hosting                 | **Vercel** (Hobby), dominio `*.vercel.app`                                                                 | Preview por PR, producción desde `main`                                                                                                                   |
| Repo                    | **GitHub**, nombre `rincon-del-hincha`, **público**                                                        | Público para tener protección de rama y CodeQL gratis. Si Diego prefiere privado, avisá qué se pierde                                                     |
| Versionado              | **SemVer** con **release-please** y Conventional Commits                                                   | Empieza en `0.1.0`. `1.0.0` solo cuando Diego lo decida                                                                                                   |

Los scripts de hooks se escriben en **Node (`.mjs`)**, no en bash, para que funcionen en macOS, Linux y Windows.

---

## 3. Datos: la parte más crítica

### 3.1 Estrategia: mezcla de API gratuita y dataset curado

Ninguna API gratuita cubre décadas de historia del fútbol argentino. Por eso:

1. **Dataset histórico versionado en el repo** (`data/`) como **fuente de verdad**: CSV/JSON normalizados, revisables en cada PR.
2. **API-Football (plan gratuito)** solo para **temporadas recientes y actualizaciones**. El plan gratuito tiene cuota diaria baja (del orden de 100 requests por día) y temporadas limitadas. **Verificá la cobertura real con la key de Diego antes de prometer nada.** La key vive solo en el servidor y nunca en el bundle del cliente.
3. **Fuentes para lo histórico.** Evaluá datasets abiertos (por ejemplo openfootball y TheSportsDB en su uso no comercial) y Wikipedia para palmarés y títulos, citando la fuente y respetando la licencia CC BY-SA en la atribución. **No scrapees sitios cuyos términos lo prohíban.** Para RSSSF u otras compilaciones con derechos, proponé a Diego pedir permiso antes de usarlas.
4. **Actualización automática:** un workflow programado de GitHub Actions corre la ingesta (por ejemplo, a diario), genera el diff en `data/` y abre un PR `chore(datos): actualización AAAA-MM-DD`. Ese PR pasa por la validación de datos y se mergea solo si todo está en verde.
5. **Supabase se alimenta desde `data/`** con un script de seed/sync idempotente. La app lee de Supabase y cachea con ISR.

El primer entregable de datos es un **spike** que termina en el **ADR 0003 — Fuentes de datos**. Ese ADR incluye: qué fuente cubre qué competiciones y qué años, licencias y términos, costo en requests, y **la fecha desde la cual la cobertura es completa para cada club**.

### 3.2 Alcance de datos del MVP

- **Clubes:** todos los de la Primera División (Liga Profesional) de la temporada vigente.
- **Competiciones:** liga local en todos sus formatos históricos (Metropolitano, Nacional, Apertura, Clausura, Inicial, Final, Superliga, Copa de la Liga, etc.), copas nacionales (Copa Argentina, Supercopa Argentina, Trofeo de Campeones…) e internacionales oficiales (Libertadores, Sudamericana, Recopa, Intercontinental/Mundial de Clubes, etc.).
- **Profundidad:** la máxima que permitan fuentes verificables. **Donde no haya cobertura completa, la UI lo dice** (ver §3.4).

### 3.3 Modelo de datos (mínimo)

```
clubs           id (slug estable), nombre, nombre_corto, aliases[], colores {primario, secundario, terciario?},
                patron_camiseta (lisa|bastones|banda|franjas…), fundacion, ciudad
competitions    id, nombre, tipo (liga|copa_nacional|internacional|otra), ambito (local|internacional),
                organizador, reconocido_afa (bool), notas
seasons         id, competition_id, nombre, inicio, fin
matches         id, season_id, fecha (America/Argentina/Buenos_Aires), local_id, visitante_id,
                goles_local, goles_visitante, definicion (null|penales|alargue), penales_local?, penales_visitante?,
                instancia (fase|fecha|final…), es_final (bool), estado (jugado|suspendido|resultado_administrativo),
                fuente, verificado (bool)
titles          id, club_id, competition_id, season_id, fecha_consagracion, compartido (bool), fuente, verificado
movements       id, club_id, tipo (descenso|ascenso), fecha, temporada
rivalries       club_a, club_b, es_clasico (bool), nombre? ("Clásico de Avellaneda"…)
coverage        club_id, competition_id, desde, hasta, completa (bool)
```

### 3.4 Reglas de cálculo (documentarlas en `docs/metodologia.md` y testearlas una por una)

- **Período del hincha:** desde la fecha de inicio (inclusive) hasta hoy, en zona horaria `America/Argentina/Buenos_Aires`.
- **Un título cuenta** si su `fecha_consagracion` cae dentro del período.
- **Resultado de un partido:** se toma el marcador al final del tiempo reglamentario más el alargue, si hubo. Una definición por penales **cuenta como empate en PJ/PG/PE/PP** y se registra aparte. En finales y títulos, el ganador por penales gana la final.
- **Saldo** = PG − PP. Los empates no lo modifican.
- **Dominio:** "Dominás" si saldo ≥ +2, "Parejo" si está entre −1 y +1, "Te domina" si es ≤ −2. Los umbrales van en una constante configurable.
- **Partidos suspendidos** no cuentan. Los de **resultado administrativo** cuentan con una marca visible.
- **Clásicos:** según la tabla `rivalries`.
- **Cobertura parcial:** si la fecha de inicio es anterior a la cobertura completa del club, la UI muestra un aviso claro, por ejemplo "Tenemos todos los partidos desde 1985; antes de eso tu historial puede estar incompleto". **Nunca se presentan como completos datos que no lo están.**
- **Títulos discutidos** (reconocimiento AFA, campeonatos de la era amateur, etc.): mostrar el criterio usado y la fuente. Por defecto se cuentan solo los oficialmente reconocidos.

### 3.5 Validación de datos (corre en CI y en cada PR de datos)

Script `pnpm data:validate` que falla si:

- Hay partidos duplicados (misma fecha, mismos clubes y misma competición).
- Un club en un partido no existe en `clubs`, o es local y visitante a la vez.
- Hay goles negativos, fechas futuras en partidos jugados o fechas fuera del rango de su temporada.
- Hay un título sin al menos un partido final o última fecha que lo respalde, cuando la cobertura de esa temporada es completa.
- Una temporada tiene dos campeones sin marcarse como `compartido`.
- No cuadran los totales de control, por ejemplo PG+PE+PP = PJ para cada club.
- Hay registros sin `fuente`.

---

## 4. Diseño: estética actual, linda y mobile-first

### 4.1 Dirección visual: "estadio de noche"

Inspirada en los mockups conceptuales del PDF:

- **Fondo** azul marino profundo, con degradés y una sugerencia de luces de estadio (desenfoques y bokeh sutil, siempre livianos).
- **Superficies de vidrio** (glassmorphism moderado) con bordes de 1px translúcidos.
- **Dorado/ámbar** para trofeos y logros, **verde** para "dominás", **gris azulado** para "parejo" y **rojo** para "te domina".
- **Theming por club:** al elegir club, el acento de toda la app adopta sus colores mediante CSS variables, con contraste AA garantizado (calculalo y ajustá la luminancia si hace falta).
- **Tipografía display condensada** en mayúsculas para títulos grandes ("RACING VS. TODOS", "MI VITRINA").
- **Micro-interacciones:** los trofeos se encienden al entrar en pantalla, los contadores suben animados, una celebración sutil al ver un título y transiciones suaves entre vistas. Todo se desactiva con `prefers-reduced-motion`.
- **Mobile-first real:** barra de navegación inferior, targets táctiles de 44px o más, tablas que en móvil se convierten en tarjetas, gestos naturales y skeletons de carga.
- **Modo oscuro por defecto.**

### 4.2 Propiedad intelectual

- **No uses escudos oficiales ni marcas de los clubes.** Generá un **escudo genérico en SVG** a partir de los colores y el patrón de camiseta de cada club (bastones, banda, lisa…) con sus iniciales. Registralo en el **ADR 0005**.
- **Los trofeos son ilustraciones SVG propias y genéricas** por tipo de copa, no réplicas de trofeos reales.
- No uses fotos de partidos, jugadores ni estadios con derechos.

### 4.3 Calidad visual medible

- Lighthouse en móvil: **≥ 90** en Performance, Accessibility, Best Practices y SEO.
- **WCAG 2.2 AA**: contraste, foco visible, navegación por teclado, `aria-*` correctos y textos alternativos.
- JS inicial por ruta: **≤ 170 KB gzip**. LCP **< 2,5 s** en 4G emulado.
- Capturas de Playwright en 390×844 (iPhone) y 412×915 (Android) adjuntas a cada PR que toque UI.

---

## 5. Alcance del MVP

### 5.1 Inicio / onboarding (`/`)

- Hero con la frase de posicionamiento y un CTA.
- Paso 1: **elegí tu club**, con una grilla de escudos genéricos y buscador.
- Paso 2: **¿desde cuándo sos hincha?**, con la fecha de nacimiento por defecto y la opción "otra fecha". El selector tiene que ser cómodo en el móvil.
- CTA "Ver mi historia". La elección se guarda en `localStorage` (envuelto en try/catch) para volver directo.

### 5.2 Mi vitrina (`/vitrina`)

- Estantes de vidrio iluminados con tres secciones: **Internacionales**, **Locales** y **Otros**.
- Los trofeos ganados aparecen encendidos con su año. Los pendientes son siluetas de vidrio vacías.
- Contadores: "Trofeos ganados desde que naciste" y "Trofeos que te faltan".
- Checklist de títulos pendientes.
- Al tocar un trofeo se abre el detalle: fecha de consagración, final o última fecha, rival y resultado.

### 5.3 [Mi club] vs. Todos (`/rivales`)

- Tres tarjetas resumen: **Historial favorable** (N rivales), **Historial igualado** y **Historial desfavorable**.
- Lista de rivales con PJ, PG, PE, PP, saldo, una barra visual y un chip de dominio.
- Filtros: rango de años y tipo de torneo. Orden por saldo, PJ o nombre.
- Secciones con humor: **"Te tiene de hijo"**, **"Historia pareja"** y **"Te tienen de hijo"**.
- En móvil la lista son tarjetas. En desktop es una tabla.

### 5.4 Detalle de rivalidad (`/rivales/[rival]`)

- El historial en tu período, el último partido, la racha actual, la mayor goleada a favor y en contra, y las finales entre ambos.
- **"Lo que está en juego":** por ejemplo "Con 2 triunfos más pasás a dominar este historial" o "Estás a 1 victoria de las 30 contra este rival desde que naciste".

### 5.5 Comparar con un amigo (`/comparar`)

- Creo una comparación y obtengo un **link para compartir**. Mi amigo lo abre, elige su club y su fecha, y aparece la comparación lado a lado.
- **Privacidad:** la fecha de nacimiento **nunca va en la URL**. La comparación se guarda en Supabase con un slug aleatorio y solo con club y fecha de inicio, sin nombre real obligatorio (se puede usar un apodo opcional). Los datos de la comparación caducan a los 90 días.
- Indicadores: títulos totales, internacionales, locales, finales ganadas y jugadas, clásicos (saldo), descensos sufridos y mejor racha. Además, el **historial directo entre ambos clubes** calculado desde la fecha de inicio más tardía de los dos, para que sea justo.
- El resultado es un **"marcador de categorías"** (por ejemplo "Ganás 4 a 3 en categorías"), sin una única medida de grandeza.

### 5.6 Compartir

- **"Mi DNI futbolero":** una imagen generada con `next/og` con club, período, títulos, mejores y peores rivales, créditos y la URL de la app.
- Botón de compartir con Web Share API y fallback de copiar link o descargar imagen.
- Metadatos OG y Twitter en todas las rutas compartibles.

### 5.7 Páginas institucionales

- `/acerca`: créditos (Diego Estela Lopez, autor, y Juan Farre, idea original), metodología, fuentes y cobertura.
- `/changelog`: se renderiza desde `CHANGELOG.md`.
- `/privacidad`: qué se guarda, por qué y por cuánto tiempo.

### 5.8 Analítica de validación (PostHog)

Eventos mínimos, sin datos personales en las propiedades:

`onboarding_completado {club}`, `vitrina_vista`, `rivales_vista`, `rivalidad_vista {rival}`, `comparacion_creada`, `comparacion_abierta_por_amigo`, `comparacion_completada`, `imagen_compartida {formato}`, `visita_recurrente`.

Las tres preguntas del PDF que estos eventos deben responder:

1. ¿La gente siente curiosidad por su propia historia? Se mide con el onboarding completado.
2. ¿Quiere compararla? Se mide con las comparaciones creadas, abiertas y compartidas.
3. ¿Vuelve cuando hay partido? Se mide con las visitas recurrentes en días de fecha.

### 5.9 Fuera del MVP (etapa 2; no lo construyas ahora, dejalo como issues en un milestone)

- Login con Google (Supabase Auth) y perfil persistente.
- Grupos de amigos con rankings.
- "La próxima fecha": las estadísticas personales en juego antes de cada partido, con notificaciones.
- Logros e insignias.
- Premium, productos digitales (póster, anuario) y patrocinios.
- Otros países y otros deportes.

---

## 6. Arquitectura y estructura del repo

```
rincon-del-hincha/
├─ CLAUDE.md
├─ README.md
├─ CHANGELOG.md                  (lo mantiene release-please)
├─ .env.example                  (sin valores reales)
├─ .claude/
│  ├─ settings.json
│  ├─ agents/                    (7 subagentes, ver §7.3)
│  ├─ skills/                    (idea, plan, build, review, ship, release, backlog)
│  └─ hooks/                     (guard-bash.mjs, guard-files.mjs, format.mjs)
├─ .github/
│  ├─ workflows/                 (ci.yml, security.yml, release-please.yml, data-update.yml)
│  ├─ ISSUE_TEMPLATE/            (feature.yml, bug.yml, datos.yml)
│  ├─ pull_request_template.md
│  └─ dependabot.yml
├─ data/                         (fuente de verdad: clubs, competitions, seasons, matches, titles, movements, rivalries, coverage)
├─ docs/
│  ├─ adr/                       (0001-…md)
│  ├─ plans/                     (0001-…md)
│  ├─ producto/                  (propuesta-conceptual.pdf)
│  └─ metodologia.md
├─ scripts/
│  ├─ ingest/                    (un adaptador por fuente)
│  ├─ validate-data.ts
│  └─ seed-supabase.ts
├─ supabase/
│  └─ migrations/
├─ src/
│  ├─ app/                       (rutas App Router, route handlers y OG images)
│  ├─ components/                (ui/ de shadcn, vitrina/, rivales/, comparar/, layout/)
│  ├─ domain/                    (LÓGICA PURA: cálculo de historial, títulos, rachas, dominio, comparación)
│  ├─ data/                      (repositorios: acceso a Supabase y a la API externa, solo en el servidor)
│  ├─ lib/                       (version.ts, analytics.ts, theme-club.ts, fechas.ts)
│  └─ styles/
└─ tests/
   ├─ unit/  ├─ integration/  └─ e2e/
```

Reglas de arquitectura:

- `src/domain/` está compuesto por **funciones puras sin I/O**, con 100% de cobertura de ramas. Es el corazón del producto.
- Las claves (Supabase service role, API-Football) **solo** se usan en código de servidor (`server-only`). Un test verifica que no aparezcan en el bundle del cliente.
- Las consultas pesadas (historial por rango de fechas) se resuelven en Postgres, con funciones SQL o vistas e índices en `(local_id, fecha)` y `(visitante_id, fecha)`, y se cachean.

---

## 7. Sistema de agentes

### 7.1 Flujo de trabajo

```
idea de Diego ──/idea──▶ Issue en GitHub (issue-scribe)
                           │
                       /plan #N ──▶ docs/plans/NNNN-slug.md (planner)
                           │
                       /build NNNN ──▶ rama + worktree, TDD, commits convencionales (orquestador)
                           │
                       /review ──▶ en paralelo: code-reviewer · ui-designer-auditor ·
                           │                    data-integrity-auditor · security-auditor
                           │       (si alguno bloquea → corregir y volver a /review)
                       /ship ──▶ push de la rama · PR · CI verde · merge squash
                           │
                    release-please abre o actualiza el PR de release ──/release──▶ release-manager
                           │
                    merge del PR de release ──▶ tag vX.Y.Z ──▶ Vercel despliega producción
```

`/backlog` permite recorrer en orden las issues abiertas del milestone actual y ejecutar el ciclo completo de cada una, frenando solo en los checkpoints humanos (§0).

### 7.2 Guardarraíles (hechos cumplir por código, no por intención)

| Regla                                                                                                                              | Dónde se hace cumplir                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Nunca commit ni push directo a `main`                                                                                              | `guard-bash.mjs` + protección de rama en GitHub                                                                                   |
| Nunca `push --force`, `--no-verify`, `git reset --hard` sobre `main` ni borrar `main`                                              | `guard-bash.mjs` + `deny` en settings                                                                                             |
| Merge solo con `--squash`, solo con los checks requeridos en verde y solo con la etiqueta `agentes:aprobado`                       | `guard-bash.mjs` (consulta `gh pr checks` y las etiquetas) + protección de rama                                                   |
| Producción solo se despliega por merge a `main` (prohibido `vercel --prod`)                                                        | `guard-bash.mjs`                                                                                                                  |
| No leer ni escribir `.env*`                                                                                                        | `deny` en settings + `guard-files.mjs`                                                                                            |
| No modificar los propios guardarraíles (`.claude/settings.json`, `.claude/hooks/**`, `.github/workflows/**`) después del bootstrap | `guard-files.mjs` + `guard-bash.mjs`. Para cambiarlos, Diego crea `.claude/GUARDRAILS_UNLOCK` a mano y el agente no puede crearlo |
| Interruptor de autopiloto                                                                                                          | Si existe `.claude/AUTOPILOT_OFF`, se bloquean push, creación de PR y merge                                                       |
| Los auditores no editan código                                                                                                     | Sus `tools` en el frontmatter no incluyen Edit ni Write                                                                           |

**Orden del bootstrap:** primero creás los scripts de hooks y sus tests, después los registrás en `settings.json`. Desde ese momento, el bloqueo de archivos de guardarraíles queda activo.

Protección de rama en GitHub (`main`), configurada con `gh api`. Si no hay permisos, pedile a Diego que lo haga y dale los pasos:

- Requerir PR para mergear.
- Requerir los checks `ci / lint`, `ci / typecheck`, `ci / test`, `ci / data`, `ci / build`, `ci / e2e` y `security / secrets`.
- Bloquear el force push y el borrado de la rama.
- Permitir solo squash merge y borrar las ramas al mergear.

### 7.3 Subagentes: crear exactamente estos archivos

> Verificá contra la documentación vigente de Claude Code el formato del frontmatter (`name`, `description`, `tools`, `model`) y ajustalo si cambió.

**`.claude/agents/issue-scribe.md`**

```markdown
---
name: issue-scribe
description: Convierte una idea, comentario o bug que cuenta Diego en una issue de GitHub clara y accionable. Usalo siempre que haya que crear una issue.
tools: Read, Grep, Glob, Bash
model: sonnet
---

Sos el redactor de issues de Rincón del Hincha. Recibís una idea en lenguaje natural y la convertís en una issue de GitHub.

Proceso:

1. Leé CLAUDE.md y buscá issues parecidas con `gh issue list --search`. Si hay un duplicado, no crees nada y devolvé el link.
2. Clasificá el tipo (feature | bug | datos | chore | diseño) y el área (vitrina | rivales | comparar | compartir | datos | infra | agentes).
3. Escribí:
   - Título corto, en español, empezando con verbo.
   - **Contexto**: qué problema resuelve para el hincha.
   - **Criterios de aceptación** en formato Dado/Cuando/Entonces, verificables y testeables.
   - **Fuera de alcance**.
   - **Notas técnicas** si las hay, sin diseñar la solución completa.
4. Creala con `gh issue create`, con etiquetas y milestone. Si la idea es de etapa 2 (§5.9 del prompt maestro), mandala al milestone "Etapa 2".
5. Devolvé el número y el link.
   No inventes requisitos que Diego no dijo. Si algo es ambiguo, dejalo como "Pregunta abierta" en la issue.
```

**`.claude/agents/planner.md`**

```markdown
---
name: planner
description: Escribe el plan de implementación de una issue en docs/plans antes de tocar código. Usalo para toda issue no trivial.
tools: Read, Grep, Glob, Bash, Write
model: opus
---

Sos el planificador. Solo escribís en docs/plans/ y docs/adr/; nunca tocás código.

Para la issue #N:

1. Leé la issue (`gh issue view N`), CLAUDE.md, docs/metodologia.md, los ADRs y el código relevante.
2. Creá docs/plans/NNNN-slug.md con:
   - frontmatter: issue, estado (pendiente|en-curso|hecho), fecha
   - Objetivo y criterios de aceptación (copiados de la issue)
   - Enfoque y alternativas descartadas
   - **Tareas** como checklist `- [ ]`, chicas (≤ 1 h cada una), cada una con su test primero
   - Tests a escribir (unit, integración, e2e) y casos borde
   - Impacto en datos, diseño, seguridad y performance
   - Riesgos y cómo verificar que está terminado
3. Si hay una decisión de arquitectura nueva, redactá el ADR correspondiente (Contexto / Decisión / Consecuencias).
   Devolvé la ruta del plan y un resumen de 5 líneas.
```

**`.claude/agents/code-reviewer.md`**

```markdown
---
name: code-reviewer
description: Revisa el diff de la rama actual antes del PR: corrección, tipos, tests, legibilidad y arquitectura. Solo lee.
tools: Read, Grep, Glob, Bash
model: sonnet
---

Sos revisor de código senior. NO modificás archivos. Usá Bash solo para comandos de lectura (git diff, git log, pnpm test, pnpm typecheck).

Revisá `git diff origin/main...HEAD`:

- ¿Cumple los criterios de aceptación del plan?
- ¿Hay tests que primero fallaban y cubren casos borde? ¿La lógica de dominio está en src/domain sin I/O?
- Tipos estrictos, sin `any` injustificados, manejo de errores, nombres claros.
- Server/client: ¿algo de servidor se filtra al cliente?
- Reglas de cálculo de docs/metodologia.md respetadas.
  Respondé con: **VEREDICTO: APROBADO | CAMBIOS REQUERIDOS**, y una lista de hallazgos con severidad (bloqueante | importante | sugerencia), archivo:línea y propuesta concreta.
```

**`.claude/agents/ui-designer-auditor.md`**

```markdown
---
name: ui-designer-auditor
description: Audita estética, responsive, accesibilidad, performance y copy rioplatense de cualquier cambio de UI. Solo lee.
tools: Read, Grep, Glob, Bash
model: sonnet
---

Sos director de diseño y auditor de calidad web. NO modificás archivos.

Para cambios de UI:

1. Corré los E2E de capturas en 390×844 y 412×915 y mirá las imágenes generadas.
2. Evaluá: coherencia con la dirección "estadio de noche" (§4 del prompt maestro), jerarquía visual, espaciado, tipografía, theming por club con contraste AA, micro-interacciones y `prefers-reduced-motion`.
3. Accesibilidad WCAG 2.2 AA: contraste, foco, roles, labels y targets ≥ 44px.
4. Performance: tamaño del bundle por ruta (≤ 170 KB gzip), imágenes y fuentes optimizadas, y Lighthouse móvil ≥ 90.
5. Copy: español rioplatense con voseo, tono futbolero sano, sin errores ni anglicismos innecesarios.
6. Footer con versión y créditos presente.
   VEREDICTO: APROBADO | CAMBIOS REQUERIDOS, con hallazgos accionables.
```

**`.claude/agents/data-integrity-auditor.md`**

```markdown
---
name: data-integrity-auditor
description: Verifica que los datos y los cálculos estadísticos sean correctos y estén bien atribuidos. Usalo en todo cambio que toque data/, scripts/, src/domain o consultas SQL. Solo lee.
tools: Read, Grep, Glob, Bash
model: sonnet
---

Sos auditor de integridad de datos deportivos. NO modificás archivos.

1. Corré `pnpm data:validate` y `pnpm test src/domain`.
2. Revisá los diffs de data/: fuente presente, sin duplicados, fechas y zonas horarias, títulos compartidos y resultados administrativos.
3. Contrastá con fuentes verificables al menos 3 cifras al azar del cambio (por ejemplo, el campeón de una temporada o un resultado puntual) y reportá qué fuente usaste.
4. Verificá que la cobertura parcial se muestre cuando corresponde y que las reglas de docs/metodologia.md estén implementadas tal cual.
   VEREDICTO: APROBADO | CAMBIOS REQUERIDOS. Ante cualquier cifra dudosa, el veredicto es CAMBIOS REQUERIDOS.
```

**`.claude/agents/security-auditor.md`**

```markdown
---
name: security-auditor
description: Busca secretos, fugas de claves al bundle público, problemas de privacidad y dependencias vulnerables. Solo lee.
tools: Read, Grep, Glob, Bash
model: sonnet
---

Sos auditor de seguridad y privacidad. NO modificás archivos.

1. Buscá secretos en el diff y en el historial reciente (patrones de keys y tokens; gitleaks si está disponible).
2. Verificá que las variables sensibles no tengan prefijo NEXT_PUBLIC_ y que el código de servidor use `server-only`.
3. Revisá la RLS de Supabase en las migraciones nuevas: nadie lee ni escribe lo que no le corresponde.
4. Privacidad: la fecha de nacimiento nunca va en URLs, logs ni eventos de analítica; las comparaciones caducan.
5. Corré `pnpm audit --audit-level=high` y revisá las dependencias nuevas (mantenimiento, licencia, tamaño).
6. Validación de entradas con Zod en route handlers; headers de seguridad (CSP, etc.).
   VEREDICTO: APROBADO | CAMBIOS REQUERIDOS.
```

**`.claude/agents/release-manager.md`**

```markdown
---
name: release-manager
description: Revisa y prepara el PR de release de release-please; verifica el changelog, la versión y que producción quede sana.
tools: Read, Grep, Glob, Bash
model: sonnet
---

Sos release manager.

1. Ubicá el PR abierto de release-please (`gh pr list --label "autorelease: pending"`).
2. Verificá que el CHANGELOG sea entendible para un humano y esté agrupado por tipo. Si algún commit quedó mal tipado, avisá al orquestador.
3. Confirmá que el bump de versión sea correcto según SemVer (en 0.x, feat → minor y fix → patch).
4. Confirmá que CI esté en verde y recomendá el merge.
5. Después del merge, verificá que el deploy de producción en Vercel esté listo (`gh api` del estado de deployment o la URL pública) y que el footer muestre la nueva versión.
   Devolvé un resumen de la release en 5 líneas.
```

### 7.4 Skills: crear estos archivos en `.claude/skills/<nombre>/SKILL.md`

> Verificá el formato vigente de skills de Claude Code (frontmatter `name` y `description`; se invocan como `/nombre`).

**`idea`**

```markdown
---
name: idea
description: Convierte una idea o comentario de Diego en una issue de GitHub. Uso: /idea <texto libre>
---

1. Delegá en el subagente issue-scribe pasándole el texto completo de Diego.
2. Mostrá a Diego el número, el título y el link de la issue creada.
3. Preguntá en una línea si querés planificarla ya (/plan #N). Si Diego trabaja en modo /backlog, seguí sin preguntar.
```

**`plan`**

```markdown
---
name: plan
description: Genera el plan de implementación de una issue en docs/plans. Uso: /plan #N
---

1. Delegá en el subagente planner con el número de issue.
2. Commiteá el plan en una rama `plan/N-slug` o incluilo en la rama de la feature.
3. Comentá en la issue el link al plan (`gh issue comment`).
4. Mostrá el resumen del plan.
```

**`build`**

```markdown
---
name: build
description: Implementa un plan con TDD en una rama y worktree aislados. Uso: /build NNNN
---

1. Si existe .claude/AUTOPILOT_OFF, trabajá solo localmente y avisá.
2. Creá la rama `feat/N-slug` (o fix/, chore/, datos/) en un worktree aislado.
3. Por cada tarea del plan: escribí el test → verificá que falla → implementá lo mínimo → test verde → refactor → commit convencional (`feat(vitrina): …`). Marcá la tarea `[x]` en el plan.
4. Al terminar: `pnpm lint && pnpm typecheck && pnpm test && pnpm data:validate && pnpm build && pnpm e2e`.
5. Marcá el plan como `estado: hecho` y seguí con /review.
```

**`review`**

```markdown
---
name: review
description: Corre en paralelo los auditores que correspondan al diff y consolida un veredicto. Uso: /review
---

1. Mirá `git diff --name-only origin/main...HEAD` y elegí los auditores:
   - siempre: code-reviewer y security-auditor
   - si toca src/app, src/components o estilos: ui-designer-auditor
   - si toca data/, scripts/, src/domain, src/data o supabase/: data-integrity-auditor
2. Lanzalos en paralelo.
3. Consolidá un reporte en `docs/plans/NNNN-slug.review.md` con cada veredicto y sus hallazgos.
4. Si hay algún CAMBIOS REQUERIDOS: corregí con TDD y repetí /review (máximo 3 vueltas; después, frená y avisá a Diego).
5. Si todos aprueban: seguí con /ship.
```

**`ship`**

```markdown
---
name: ship
description: Publica la rama, abre el PR, espera la CI y mergea con squash si todo está en verde. Uso: /ship
---

1. `git push -u origin <rama>`.
2. `gh pr create` usando la plantilla: resumen, `Closes #N`, link al plan, reporte de revisión y capturas móviles si hay UI.
3. Si todos los auditores aprobaron: `gh pr edit --add-label agentes:aprobado`.
4. Esperá la CI (`gh pr checks --watch`). Si falla: diagnosticá, corregí en la misma rama, volvé a /review si el cambio es relevante y pusheá.
5. Con todo en verde: `gh pr merge --squash --delete-branch`.
6. Verificá el deploy de preview y después el de producción, y contale a Diego en 2 líneas qué salió.
```

**`release`**

```markdown
---
name: release
description: Revisa y mergea el PR de release-please para publicar una versión nueva. Uso: /release
---

1. Delegá en release-manager.
2. Si recomienda el merge: agregá la etiqueta agentes:aprobado y mergeá con squash (sujeto a los guardarraíles).
3. Confirmá el tag, la versión en producción y el footer actualizado.
```

**`backlog`**

```markdown
---
name: backlog
description: Recorre las issues abiertas del milestone actual y ejecuta el ciclo completo de cada una. Uso: /backlog [milestone]
---

Para cada issue abierta del milestone, en orden de prioridad (etiquetas p0 > p1 > p2) y respetando dependencias:
/plan → /build → /review → /ship.
Frená únicamente en los checkpoints humanos definidos en CLAUDE.md. Al final, mostrá una tabla con las issues cerradas, los PRs y la versión resultante.
```

### 7.5 Hooks: crear y testear (tests en `tests/unit/hooks/`)

**`.claude/hooks/guard-bash.mjs`** (punto de partida: completalo, endurecelo y testealo con casos que deben bloquear y casos que deben pasar)

```js
#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const input = JSON.parse(readFileSync(0, "utf8"));
const cmd = String(input?.tool_input?.command ?? "")
  .replace(/\s+/g, " ")
  .trim();
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

const block = (msg) => {
  process.stderr.write(`⛔ guard-bash: ${msg}\nComando: ${cmd}\n`);
  process.exit(2); // exit 2 = bloquea la herramienta y le devuelve el motivo a Claude
};
const sh = (c) =>
  execSync(c, { cwd: root, stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
const currentBranch = () => {
  try {
    return sh("git rev-parse --abbrev-ref HEAD");
  } catch {
    return "";
  }
};

const autopilotOff = existsSync(`${root}/.claude/AUTOPILOT_OFF`);

const hardRules = [
  [/\bgit\s+push\b.*(--force\b|--force-with-lease\b|\s-f\b)/, "push forzado prohibido"],
  [/\bgit\s+push\b[^|;&]*\b(main|master)\b/, "push directo a main prohibido: usá una rama y un PR"],
  [/--no-verify\b/, "no se saltean los hooks de git"],
  [/\bgit\s+branch\s+-[dD]\s+(main|master)\b/, "no se borra main"],
  [/\bgh\s+repo\s+delete\b/, "borrar el repo está prohibido"],
  [/\bvercel\b.*--prod\b/, "producción solo se despliega por merge a main"],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\.\/?\s*$|\*)/, "borrado masivo prohibido"],
  [/\.env(\.|\b)/, "no se accede a archivos .env desde la shell"],
  [/(GUARDRAILS_UNLOCK|AUTOPILOT_OFF)/, "los interruptores solo los maneja Diego"],
  [
    /\.claude\/(hooks|settings\.json)|\.github\/workflows/,
    "los guardarraíles no se modifican desde la shell",
  ],
];
for (const [re, msg] of hardRules) if (re.test(cmd)) block(msg);

const onMain = ["main", "master"].includes(currentBranch());
if (onMain && /\bgit\s+(commit|push|merge|rebase)\b/.test(cmd))
  block("estás en main: creá una rama");

if (/\bgit\s+push\b|\bgh\s+pr\s+(create|merge)\b/.test(cmd) && autopilotOff)
  block("autopiloto apagado por Diego (.claude/AUTOPILOT_OFF)");

if (/\bgh\s+pr\s+merge\b/.test(cmd)) {
  if (!/--squash\b/.test(cmd)) block("el merge solo se hace con --squash");
  const n = (cmd.match(/\bgh\s+pr\s+merge\s+(\d+)/) || [])[1] ?? "";
  try {
    sh(`gh pr checks ${n} --required`);
  } catch {
    block("hay checks requeridos pendientes o fallidos");
  }
  const labels = sh(`gh pr view ${n} --json labels --jq ".labels[].name"`);
  if (!labels.split("\n").includes("agentes:aprobado"))
    block("falta la etiqueta agentes:aprobado (corré /review)");
}
process.exit(0);
```

**`.claude/hooks/guard-files.mjs`**: para `Edit|Write|MultiEdit`. Bloquea (exit 2) cuando `tool_input.file_path` coincide con `.env*`, `.claude/settings.json`, `.claude/hooks/**`, `.github/workflows/**`, `.claude/AUTOPILOT_OFF` o `.claude/GUARDRAILS_UNLOCK`, **salvo** que exista `.claude/GUARDRAILS_UNLOCK` (y aun así, nunca permite `.env*` ni crear los interruptores).

**`.claude/hooks/format.mjs`**: `PostToolUse` sobre `Edit|Write|MultiEdit`. Corre Prettier sobre el archivo modificado si es formateable. Nunca bloquea.

**`.claude/settings.json`** (verificá la sintaxis vigente de permisos y hooks y ajustala si cambió):

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(git *)",
      "Bash(gh *)",
      "Bash(vercel *)",
      "Bash(supabase *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Bash(git push --force*)",
      "Bash(git push -f*)",
      "Bash(vercel --prod*)",
      "Bash(gh repo delete*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-bash.mjs\""
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-files.mjs\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/format.mjs\"" }
        ]
      }
    ]
  }
}
```

---

## 8. CI/CD

### `.github/workflows/ci.yml` (en PR y en push a `main`)

Jobs separados, con nombres estables para la protección de rama:

- `lint`: ESLint y Prettier en modo check.
- `typecheck`: `tsc --noEmit`.
- `test`: Vitest con cobertura. Umbral **100% de ramas en `src/domain`** y **80% global**.
- `data`: `pnpm data:validate`.
- `build`: `next build` + control de tamaño de bundle (falla si una ruta supera el presupuesto).
- `e2e`: Playwright sobre el build, en viewports móviles, con capturas subidas como artefacto. Incluye el test del footer (versión y créditos) y Lighthouse CI móvil con umbrales ≥ 90.

### `.github/workflows/security.yml`

- `secrets`: gitleaks sobre el diff y el repo.
- `deps`: `pnpm audit --audit-level=high`.
- `codeql`: CodeQL para JavaScript/TypeScript.

### `.github/workflows/release-please.yml`

- release-please en modo `node` sobre `main`. Mantiene `CHANGELOG.md` y `package.json` y crea el tag `vX.Y.Z` al mergear el PR de release.

### `.github/workflows/data-update.yml`

- Programado (diario) y manual (`workflow_dispatch`). Corre la ingesta reciente con la key de API-Football guardada como secret de GitHub (la carga Diego), valida los datos y abre un PR `chore(datos): …` con el diff.

### Otros

- `dependabot.yml`: actualizaciones semanales de npm y de GitHub Actions, agrupadas.
- **Vercel:** preview automático por PR y producción desde `main`. Variables de entorno en Vercel cargadas por Diego (ver §9). `next.config` inyecta `NEXT_PUBLIC_APP_VERSION` y el SHA corto.
- **Conventional Commits** obligatorios: tipos en inglés (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`) y descripción en español. Validá los mensajes en CI con commitlint.

---

## 9. Lo que necesita hacer Diego (pedíselo en el momento justo, no todo junto)

| Cuándo  | Qué                                                                                                                         | Cómo se lo pedís                        |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Fase 0  | `gh auth login` y confirmar el usuario de GitHub                                                                            | Comando exacto                          |
| Fase 0  | Importar el repo en Vercel (Hobby)                                                                                          | Pasos numerados                         |
| Fase 0  | Configurar la protección de rama, si `gh api` no tiene permisos                                                             | Pasos numerados                         |
| Fase 1  | Crear un proyecto en Supabase (gratis) y pasar URL, anon key y service role a `.env.local` y a Vercel                       | Lista de variables según `.env.example` |
| Fase 1  | Crear una cuenta gratuita en API-Football y cargar `API_FOOTBALL_KEY` en `.env.local`, en Vercel y en los secrets de GitHub | Pasos numerados                         |
| Fase 4  | Crear un proyecto en PostHog y cargar la key pública                                                                        | Pasos numerados                         |
| Etapa 2 | OAuth de Google en Google Cloud + Supabase Auth                                                                             | Pasos numerados                         |

---

## 10. Plan de ejecución por fases

Al terminar la Fase 0, creá **todo el backlog como issues** en GitHub (con `issue-scribe`), organizado en milestones: `Fase 1 — Datos`, `Fase 2 — Motor de estadísticas`, `Fase 3 — Pantallas MVP`, `Fase 4 — Compartir y comparar`, `Fase 5 — Pulido y validación` y `Etapa 2`. Después trabajá con `/backlog`.

### Fase 0 — Bootstrap (resultado: `v0.1.0` en producción)

1. Leé la documentación vigente de Claude Code sobre subagentes, skills, hooks y permisos. Si difiere de este documento, anotalo para el ADR 0004.
2. `git init` y scaffold de Next.js + TS + Tailwind + shadcn/ui + Vitest + Playwright + ESLint/Prettier con pnpm.
3. Creá `CLAUDE.md` (contenido en §11), `README.md` (qué es, créditos, stack, cómo correrlo y cómo trabajan los agentes), `.env.example` y `docs/metodologia.md` (borrador).
4. ADRs: `0001-registrar-decisiones`, `0002-stack-nextjs-vercel`, `0004-agentes-y-guardarrailes` y `0005-sin-escudos-oficiales`. Los ADR `0003-fuentes-de-datos` y `0006-supabase` van en la Fase 1.
5. Agentes, skills y hooks, con los tests de los hooks. Recién después de eso, `settings.json`.
6. Workflows de CI, seguridad y release-please, más las plantillas de issue y de PR y Dependabot.
7. Layout base con el diseño "estadio de noche": header, barra inferior, una página de inicio provisional linda (no un "hola mundo" pelado) y el **footer con versión y créditos**, más su test E2E.
8. Checkpoint con Diego: repo en GitHub (`rincon-del-hincha`, público), Vercel conectado y protección de rama.
9. Primer PR por el flujo completo → merge → release `v0.1.0` → verificación de que producción muestre la versión.

### Fase 1 — Datos

Spike de fuentes y ADR 0003 → modelo y migraciones de Supabase con RLS (ADR 0006) → adaptadores de ingesta → dataset inicial en `data/` → `data:validate` → seed → workflow `data-update` → tabla `coverage` completa.

### Fase 2 — Motor de estadísticas (`src/domain`, TDD estricto)

`calcularHistorial`, `titulosEnPeriodo`, `titulosPendientes`, `historialVsRival`, `clasificarDominio`, `rachas`, `loQueEstaEnJuego` y `compararHinchas`. Cada regla de §3.4 tiene sus tests, con fixtures de partidos reales verificados.

### Fase 3 — Pantallas MVP

Onboarding → Mi vitrina → Vs. Todos → Detalle de rivalidad, con skeletons, estados vacíos y errores amables.

### Fase 4 — Compartir y comparar

Comparar con un amigo (Supabase, slug, caducidad) → imágenes OG "DNI futbolero" → Web Share → PostHog.

### Fase 5 — Pulido y validación

Auditoría completa de diseño, accesibilidad y performance, `/acerca`, `/privacidad`, `/changelog`, SEO y metadatos, revisión del copy y datos verificados de los clubes. Después, Diego decide cuándo llega la `v1.0.0`.

---

## 11. Contenido de `CLAUDE.md` (crealo así y mantenelo actualizado)

```markdown
# Rincón del Hincha — Guía para Claude

App web mobile-first que reconstruye la historia de cada hincha desde su fecha de inicio.
Creada por Diego Estela Lopez · Idea original de Juan Farre.

## Comandos

pnpm dev | pnpm lint | pnpm typecheck | pnpm test | pnpm e2e | pnpm build | pnpm data:validate | pnpm data:seed

## Flujo obligatorio

/idea → issue · /plan #N → docs/plans · /build → TDD en rama · /review → auditores · /ship → PR + merge · /release
Nada se mergea sin issue, plan, revisión aprobada (etiqueta agentes:aprobado) y CI en verde.

## Reglas

- Nunca commit ni push a main. Nunca force push. Nunca --no-verify. Nunca vercel --prod.
- Nunca leer ni escribir .env*. Nunca commitear secretos. Las claves solo se usan en el servidor (server-only).
- No modificar .claude/settings.json, .claude/hooks/** ni .github/workflows/** (guardarraíles).
- Si existe .claude/AUTOPILOT_OFF: no push, no PR, no merge.
- Lógica de negocio pura en src/domain con tests primero. Reglas de cálculo en docs/metodologia.md.
- Datos: data/ es la fuente de verdad; todo registro tiene fuente; la cobertura parcial se muestra, nunca se inventa.
- Sin escudos ni marcas oficiales: escudos genéricos SVG por colores.
- Copy en español rioplatense con voseo y humor sano. Sin apuestas.
- Footer con versión y créditos en todas las páginas.
- Commits: Conventional Commits (tipo en inglés, descripción en español).
- Decisiones de arquitectura → ADR en docs/adr.

## Checkpoints humanos (frenar y preguntar a Diego)

Credenciales o cuentas · decisión de producto no cubierta · conflicto de datos sin fuente · guardarraíl bloqueó 2 veces.
```

---

## 12. Definición de "terminado" (para cada issue)

- [ ] Criterios de aceptación cumplidos y testeados.
- [ ] Plan en `docs/plans` marcado como hecho y reporte de revisión con todos los veredictos APROBADO.
- [ ] CI en verde (lint, typecheck, tests, datos, build, e2e, seguridad).
- [ ] UI: capturas móviles en el PR, Lighthouse ≥ 90 y AA verificado.
- [ ] Sin secretos, sin claves en el cliente y sin datos personales en URLs ni analítica.
- [ ] Footer con versión y créditos intacto.
- [ ] Documentación y ADR actualizados si corresponde.
- [ ] Mergeado con squash y deploy verificado.

---

## 13. Primera acción

1. Confirmá que leíste este documento con un resumen de 10 líneas.
2. Listá lo que necesitás de Diego para la Fase 0.
3. Arrancá la **Fase 0** sin esperar más confirmación para todo lo que no requiera credenciales.
