# 0009 — Data model naming (English field and file names)

Status: **Accepted** (2026-10-16, Diego). It follows the project language policy (everything in English except user-facing app copy) and changes names fixed in the master prompt; the mapping below is the contract. Diego also confirmed: jersey pattern `hoops` means horizontal stripes (`vertical_stripes` are the vertical ones); an optional `standings.json` is added for control totals; for league titles, support means the club played at least one counted match that season.

## Context

The master prompt (`PROMPT_RINCON_DEL_HINCHA.md`, section 3.3) describes the minimum data model with Spanish field names (`nombre`, `fuente`, `compartido`, `verificado`...). CLAUDE.md, written later, sets the project language policy: **everything is in English** (code, data contracts, docs) except the **user-facing app copy**, which is Rioplatense Spanish. `docs/methodology.md` already uses English names (for example `consecration_date`).

The files in `data/` are a public, versioned contract read by the validator (`pnpm data:validate`), the seed script, the ingestion adapters and, later, `src/domain`. Mixing languages there would leak into every type and query. Issue #9 introduces the Zod schemas that fix this contract, so the naming must be decided now, before issue #8 fills `data/`.

The master prompt also lists `fuente` only on `matches` and `titles`, while CLAUDE.md says "every record has a source" and issue #9 asks to fail on "any record without `fuente`".

## Decision

1. **All file names, field names and enum values of the data model are English, snake_case.** Files are `data/<entity>.json`, each one a JSON array of records.
2. **Every record of every entity has a non-empty `source`** (URL or citation). `verified` exists on `matches` and `titles`, as in section 3.3.
3. **Schemas are strict**: an unknown key (for example a leftover `fuente`) is a validation error.
4. **Domain and UI labels stay Spanish.** PJ/PG/PE/PP, "Dominás", "Te domina", "Clásico de Avellaneda", club names, competition names and every string shown to the user remain Rioplatense Spanish. Only identifiers and keys are English. Record values that are names (`name`, `short_name`, `aliases`, rivalry `name`) keep their real Spanish text.
5. A new optional file **`standings.json`** holds source-backed control totals per club and season (needed for the "W+D+L = P" rule, see plan 0003). It is an addition to section 3.3.

### Mapping from section 3.3

| Section 3.3 (Spanish)                                      | Data model (English)                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `clubs.nombre`, `nombre_corto`, `aliases[]`                | `name`, `short_name`, `aliases`                                                    |
| `colores {primario, secundario, terciario?}`               | `colors {primary, secondary, tertiary?}`                                           |
| `patron_camiseta` (lisa, bastones, banda, franjas...)      | `jersey_pattern` (`solid`, `vertical_stripes`, `sash`, `hoops`, `halves`, `other`) |
| `fundacion`, `ciudad`                                      | `founded`, `city`                                                                  |
| `competitions.nombre`, `tipo`, `ambito`                    | `name`, `type`, `scope`                                                            |
| `tipo`: liga, copa_nacional, internacional, otra           | `league`, `national_cup`, `international`, `other`                                 |
| `ambito`: local, internacional                             | `domestic`, `international`                                                        |
| `organizador`, `reconocido_afa`, `notas`                   | `organizer`, `afa_recognized`, `notes`                                             |
| `seasons.nombre`, `inicio`, `fin`                          | `name`, `start`, `end`                                                             |
| `matches.fecha`                                            | `date` (calendar date in America/Argentina/Buenos_Aires)                           |
| `local_id`, `visitante_id`                                 | `home_id`, `away_id`                                                               |
| `goles_local`, `goles_visitante`                           | `home_goals`, `away_goals`                                                         |
| `definicion` (null, penales, alargue)                      | `decision` (`null`, `penalties`, `extra_time`)                                     |
| `penales_local?`, `penales_visitante?`                     | `home_penalties`, `away_penalties`                                                 |
| `instancia`, `es_final`                                    | `stage`, `is_final`                                                                |
| `estado` (jugado, suspendido, resultado_administrativo)    | `status` (`played`, `suspended`, `administrative_result`)                          |
| `fuente`, `verificado`                                     | `source`, `verified`                                                               |
| `titles.fecha_consagracion`, `compartido`                  | `awarded_on`, `shared`                                                             |
| `movements.tipo` (descenso, ascenso), `fecha`, `temporada` | `type` (`relegation`, `promotion`), `date`, `season_id`                            |
| `rivalries.club_a`, `club_b`, `es_clasico`, `nombre?`      | `club_a`, `club_b`, `is_classic`, `name`                                           |
| `coverage.desde`, `hasta`, `completa`                      | `from`, `to` (null while ongoing), `complete`                                      |
| (new) control totals                                       | `standings`: `club_id`, `season_id`, `played`, `won`, `drawn`, `lost`, `source`    |

`docs/methodology.md` currently says `consecration_date`; it is renamed to `awarded_on` in the same PR that implements plan 0003.

## Consequences

- One language for every identifier: types, Zod schemas, Supabase columns (seed) and adapters share the same names with no translation layer.
- Issue #8 wording (`fuente`, `verificado`) must be read as `source`, `verified`. Contributors who copy section 3.3 literally get a strict-schema error that names the unknown key, so the mistake is caught in CI.
- The master prompt stays as historical input; this ADR is the authority for data names.
- Adding `standings.json` grows the model by one optional file; if Diego rejects it, the control-totals rule can only check internal invariants (see plan 0003, "Approval needed").
