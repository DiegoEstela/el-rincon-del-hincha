// The card of one match as the screens show it (rivalry detail, trophy detail): the date, the
// competition, the score from both sides with the fan side marked, the result and a note. Pure.
import type { Outcome } from "@/domain/match-outcome";
import type { MatchView } from "@/domain/types";
import {
  ADMINISTRATIVE_NOTE,
  competitionLabel,
  formatMatchDate,
  penaltiesNote,
  resultLabel,
} from "./rivalry-copy";

export type MatchSide = Readonly<{ name: string; goals: number; isFan: boolean }>;

export type MatchCardView = Readonly<{
  /** "27 de abril de 2025" */
  date: string;
  /** "Primera División · Liga Profesional 2025" */
  competition: string;
  home: MatchSide;
  away: MatchSide;
  outcome: Outcome;
  /** "Ganaste" */
  result: string;
  /** Penalties or administrative note. */
  note: string | null;
  /** "River 2, Boca 1": the score as one sentence for screen readers. */
  spoken: string;
}>;

export type CardNames = Readonly<{
  /** Short name of a club id (the id itself when the catalog does not have it). */
  shortName: (clubId: string) => string;
  competitionNames: ReadonlyMap<string, string>;
  seasonNames: ReadonlyMap<string, string>;
}>;

export function buildMatchCard(view: MatchView, names: CardNames): MatchCardView {
  const fanIsHome = view.match.home_id !== view.rivalId;
  const side = (id: string, goals: number, isFan: boolean): MatchSide => ({
    name: names.shortName(id),
    goals,
    isFan,
  });
  const home = side(view.match.home_id, fanIsHome ? view.goalsFor : view.goalsAgainst, fanIsHome);
  const away = side(view.match.away_id, fanIsHome ? view.goalsAgainst : view.goalsFor, !fanIsHome);
  return {
    date: formatMatchDate(view.match.date),
    competition: competitionLabel(
      names.competitionNames.get(view.competitionId) ?? view.competitionId,
      names.seasonNames.get(view.match.season_id) ?? view.match.season_id,
    ),
    home,
    away,
    outcome: view.outcome,
    result: resultLabel(view.outcome),
    note: view.isAdministrative ? ADMINISTRATIVE_NOTE : penaltiesNote(view),
    spoken: `${home.name} ${home.goals}, ${away.name} ${away.goals}`,
  };
}
