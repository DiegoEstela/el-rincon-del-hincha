// Source-name fixtures for plan 0007: team NAMES only (no rows, no scores).
// openfootball names: argentina/2025_ar1.txt (CC0). Kaggle names: distinct team names read from
// the local, gitignored liga_2023.csv.
export type ClubSourceRow = {
  id: string;
  openfootball: string;
  kaggle: string | null;
};

export const CLUB_SOURCE_ROWS: readonly ClubSourceRow[] = [
  { id: "aldosivi", openfootball: "Aldosivi", kaggle: "Aldosivi" },
  { id: "argentinos-juniors", openfootball: "Argentinos Juniors", kaggle: "Argentinos" },
  { id: "atletico-tucuman", openfootball: "Atlético Tucumán", kaggle: "Atl Tucuman" },
  { id: "banfield", openfootball: "Banfield", kaggle: "Banfield" },
  { id: "barracas-central", openfootball: "Barracas Central", kaggle: "Barracas Central" },
  { id: "belgrano", openfootball: "Belgrano de Córdoba", kaggle: "Belgrano" },
  { id: "boca-juniors", openfootball: "Boca Juniors", kaggle: "Boca Juniors" },
  { id: "central-cordoba-sde", openfootball: "Central Córdoba SdE", kaggle: "Central Cba (SdE)" },
  { id: "defensa-y-justicia", openfootball: "Defensa y Justicia", kaggle: "Def y Justicia" },
  { id: "deportivo-riestra", openfootball: "Deportivo Riestra", kaggle: null },
  { id: "estudiantes-la-plata", openfootball: "Estudiantes", kaggle: "Estudiantes (LP)" },
  { id: "gimnasia-la-plata", openfootball: "Gimnasia de La Plata", kaggle: "Gimnasia (LP)" },
  { id: "godoy-cruz", openfootball: "Godoy Cruz", kaggle: "Godoy Cruz" },
  { id: "huracan", openfootball: "Huracán", kaggle: "Huracan" },
  { id: "independiente", openfootball: "Independiente", kaggle: "Independiente" },
  {
    id: "independiente-rivadavia",
    openfootball: "Independiente Rivadavia",
    kaggle: "Ind Rivadavia",
  },
  { id: "instituto", openfootball: "Instituto de Córdoba", kaggle: "Instituto" },
  { id: "lanus", openfootball: "Lanús", kaggle: "Lanus" },
  { id: "newells-old-boys", openfootball: "Newell's Old Boys", kaggle: "Newells" },
  { id: "platense", openfootball: "Platense", kaggle: "Platense" },
  { id: "racing-club", openfootball: "Racing Club", kaggle: "Racing Club" },
  { id: "river-plate", openfootball: "River Plate", kaggle: "River Plate" },
  { id: "rosario-central", openfootball: "Rosario Central", kaggle: "Rosario Central" },
  { id: "san-lorenzo", openfootball: "San Lorenzo", kaggle: "San Lorenzo" },
  { id: "san-martin-san-juan", openfootball: "San Martín de San Juan", kaggle: "San Martin (SJ)" },
  { id: "sarmiento-junin", openfootball: "Sarmiento de Junín", kaggle: "Sarmiento (J)" },
  { id: "talleres-cordoba", openfootball: "Talleres de Córdoba", kaggle: "Talleres (C)" },
  { id: "tigre", openfootball: "Tigre", kaggle: "Tigre" },
  { id: "union", openfootball: "Unión de Santa Fe", kaggle: "Union" },
  { id: "velez-sarsfield", openfootball: "Vélez Sarsfield", kaggle: "Velez" },
];

/**
 * Clubs that played the seasons we ingest (openfootball 2018-19 to 2024) but are not in the 2025
 * Primera División list above (plan 0012). Spellings verified against the pinned openfootball files
 * and the Kaggle file. `San Martin (T)` is San Martín de Tucumán (Kaggle team id 81), not a lookalike.
 */
export const FORMER_CLUB_ROWS: readonly (ClubSourceRow & { kaggle: string })[] = [
  { id: "arsenal", openfootball: "Arsenal de Sarandí", kaggle: "Arsenal" },
  { id: "colon", openfootball: "Colón de Santa Fe", kaggle: "Colon" },
  { id: "patronato", openfootball: "Patronato de Paraná", kaggle: "Patronato" },
  { id: "san-martin-tucuman", openfootball: "San Martín de Tucumán", kaggle: "San Martin (T)" },
];

export const OPENFOOTBALL_2025_NAMES: readonly string[] = CLUB_SOURCE_ROWS.map(
  (r) => r.openfootball,
);

/** Kaggle spelling to the expected club id, for the 2025 clubs and the former clubs. */
export const KAGGLE_CLUB_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  [...CLUB_SOURCE_ROWS, ...FORMER_CLUB_ROWS].flatMap((r) =>
    r.kaggle === null ? [] : [[r.kaggle, r.id]],
  ),
);

/** Strings no source uses that sit close to a real club name: they must never resolve. */
export const NEAR_MISS_NAMES: readonly string[] = [
  "San Martín",
  "San Martin",
  "Colon de Santa Fe",
  "Patronato de Parana",
  "Arsenal de Sarandi",
  "Arsenal FC",
  "Independiente Riv",
  "Rivadavia",
];

/** Kaggle names that look close but belong to other clubs: they must never resolve. */
export const KAGGLE_LOOKALIKE_NAMES: readonly string[] = [
  "Huracan (C)",
  "Huracan (CR)",
  "Huracan (IW)",
  "Huracan (LH)",
  "Huracan (SR)",
  "Huracan (TA)",
  "Racing (C)",
  "Central Cba (R)",
  "Estudiantes (BA)",
  "Estudiantes (RC)",
  "Estudiantes (SdE)",
  "Gimnasia (CdU)",
  "Gimnasia (J)",
  "Gimnasia (M)",
  "Gimnasia (S)",
  "San Lorenzo (MdP)",
  "San Martin (M)",
  "Sarmiento (R)",
  "Talleres (RdE)",
  "Def. de Belgrano",
];
