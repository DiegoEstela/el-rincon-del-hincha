// User-facing strings of the onboarding errors (Rioplatense Spanish, voseo). Never include the
// date the fan typed: it can be a birth date.
import type { StartDateError } from "@/domain/start-date";

export const NO_CLUB_MESSAGE = "Primero elegí tu club.";

export const START_DATE_MESSAGES: Record<StartDateError, string> = {
  empty: "Poné una fecha para arrancar.",
  format: "Esa fecha no existe. Revisala.",
  not_a_date: "Esa fecha no existe. Revisala.",
  too_early: "Tan atrás no llegamos: elegí una fecha desde el 1 de enero de 1880.",
  future: "Eso todavía no se jugó. Elegí una fecha de hoy para atrás.",
};
