import type { CharacterPool, MemberSelection, TeamComposition } from "@/lib/domain";

/**
 * Mała, jawna pula pisana pod przypadki testowe reguły — NIE jest to docelowa pula 10–12 postaci
 * z PRD; ta powstaje w F-02 wraz z dowodem swojej rozwiązywalności.
 *
 * Dobór spełnia dwa warunki, na których opierają się przypadki:
 * siedem kompetencji jest pokrytych specjalizacjami (combat dwukrotnie), a perki nawigacyjne
 * są rozsiane na tyle szeroko, że istnieje zarówno skład domykający próg, jak i skład
 * o dokładnie jeden punkt za krótki.
 *
 * Plik importują wyłącznie testy, więc nie trafia do bundla aplikacji.
 */
export const TEST_POOL: CharacterPool = [
  {
    id: "rook",
    specialization: "combat",
    perks: [
      { id: "rook-nav", competency: "navigation" },
      { id: "rook-med", competency: "medicine" },
      { id: "rook-hack", competency: "hacking" },
    ],
  },
  {
    id: "wire",
    specialization: "hacking",
    perks: [
      { id: "wire-nav", competency: "navigation" },
      { id: "wire-eng", competency: "engineering" },
      { id: "wire-stealth", competency: "stealth" },
    ],
  },
  {
    id: "mote",
    specialization: "stealth",
    perks: [
      { id: "mote-neg", competency: "negotiation" },
      { id: "mote-nav", competency: "navigation" },
      { id: "mote-combat", competency: "combat" },
    ],
  },
  {
    id: "cog",
    specialization: "engineering",
    perks: [
      { id: "cog-nav", competency: "navigation" },
      { id: "cog-med", competency: "medicine" },
      { id: "cog-hack", competency: "hacking" },
    ],
  },
  {
    id: "salve",
    specialization: "medicine",
    perks: [
      { id: "salve-neg", competency: "negotiation" },
      { id: "salve-nav", competency: "navigation" },
      { id: "salve-stealth", competency: "stealth" },
    ],
  },
  {
    id: "broker",
    specialization: "negotiation",
    perks: [
      { id: "broker-nav", competency: "navigation" },
      { id: "broker-combat", competency: "combat" },
      { id: "broker-eng", competency: "engineering" },
    ],
  },
  {
    id: "drift",
    specialization: "navigation",
    perks: [
      { id: "drift-combat", competency: "combat" },
      { id: "drift-hack", competency: "hacking" },
      { id: "drift-med", competency: "medicine" },
    ],
  },
  {
    id: "ash",
    specialization: "combat",
    perks: [
      { id: "ash-stealth", competency: "stealth" },
      { id: "ash-neg", competency: "negotiation" },
      { id: "ash-eng", competency: "engineering" },
    ],
  },
];

/** Jeden wybór gracza: postać plus zero lub więcej jej perków. */
export function member(characterId: string, ...perkIds: string[]): MemberSelection {
  return { characterId, perkIds };
}

/**
 * Skład domykający próg: sześć różnych specjalizacji pokrywa sześć kompetencji po 2 punkty,
 * a siódma (navigation) dochodzi do progu wyłącznie z dwóch perków — dokładnie tak, jak wymaga
 * właściwość liczbowa z PRD (sześć postaci nie wnosi siedmiu specjalizacji).
 */
export function thresholdClosingComposition(): TeamComposition {
  return [
    member("rook", "rook-nav"),
    member("wire", "wire-nav"),
    member("mote"),
    member("cog"),
    member("salve"),
    member("broker"),
  ];
}

/** Ten sam skład bez drugiego perka nawigacyjnego — brakuje dokładnie jednego punktu. */
export function onePointShortComposition(): TeamComposition {
  return [member("rook", "rook-nav"), member("wire"), member("mote"), member("cog"), member("salve"), member("broker")];
}
