/**
 * Reguła domenowa team-makera — siedem kompetencji, próg dwóch punktów, limity składu.
 *
 * Moduł jest czysty: żadnych wirtualnych modułów Astro, żadnego klienta Supabase, żadnych
 * importów z `src/pages/`. Złamanie tej zasady zamienia regułę w kod wymagający runtime'u
 * Astro i wywala się dopiero przy uruchomieniu testu (AGENTS.md → Hard rules).
 */

/**
 * Siedem kompetencji jako typ związany. Nazwy robocze zostały przyjęte jako docelowe
 * (rozstrzygnięcie F-02) — są czytelne dla obcego bez tutoriala i trafiają dosłownie do enuma
 * `public.competency` w bazie. Zmiana nazwy to migracja, nie tylko edycja tej tablicy.
 */
export const COMPETENCIES = [
  "combat",
  "hacking",
  "stealth",
  "engineering",
  "medicine",
  "negotiation",
  "navigation",
] as const;

export type Competency = (typeof COMPETENCIES)[number];

/** Próg: każda kompetencja musi mieć co najmniej tyle punktów (PRD → FR-018). */
export const COMPETENCY_THRESHOLD = 2;

/** Najwyżej tylu członków w drużynie (PRD → FR-012). */
export const MAX_TEAM_SIZE = 6;

/** Najwyżej tyle perków wybranych u jednego członka (PRD → FR-014). */
export const MAX_PERKS_PER_MEMBER = 2;

/** Każda postać ma dokładnie tyle perków do wyboru (PRD → FR-014). */
export const PERKS_PER_CHARACTER = 3;

/** Specjalizacja postaci wnosi tyle punktów do swojej kompetencji (PRD → Business Logic). */
export const SPECIALIZATION_POINTS = 2;

/** Wybrany perk wnosi tyle punktów do swojej kompetencji (PRD → Business Logic). */
export const PERK_POINTS = 1;

export interface Perk {
  id: string;
  competency: Competency;
}

export interface Character {
  id: string;
  specialization: Competency;
  perks: readonly Perk[];
}

/** Perk z treścią — nazwa pod etykietę w interfejsie (PRD → FR-014). */
export interface PoolPerk extends Perk {
  name: string;
}

/**
 * Postać z treścią pod prawą kolumnę okna wyboru członka (PRD → FR-013).
 *
 * Zawężenie `perks` do `readonly PoolPerk[]` jest legalne, bo pole jest `readonly` — dzięki temu
 * `readonly PoolCharacter[]` jest przypisywalne do `CharacterPool` i wchodzi do `evaluateTeam`
 * bez rzutowania. Reguła i jej fixture'y nie widzą treści.
 */
export interface PoolCharacter extends Character {
  name: string;
  description: string;
  perks: readonly PoolPerk[];
}

/** Wybór gracza dla jednego członka: która postać i które z jej perków. */
export interface MemberSelection {
  characterId: string;
  perkIds: readonly string[];
}

/** Zamknięta pula postaci dostępnych w grze. */
export type CharacterPool = readonly Character[];

/** Skład wybrany przez gracza — od zera do sześciu różnych postaci. */
export type TeamComposition = readonly MemberSelection[];
