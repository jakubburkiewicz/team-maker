import {
  COMPETENCIES,
  COMPETENCY_THRESHOLD,
  MAX_PERKS_PER_MEMBER,
  MAX_TEAM_SIZE,
  PERK_POINTS,
  SPECIALIZATION_POINTS,
  type Character,
  type CharacterPool,
  type Competency,
  type MemberSelection,
  type TeamComposition,
} from "@/lib/domain/types";

/**
 * Wyczerpujący solver rozwiązywalności puli — dowód wiążącego warunku z PRD → Business Logic.
 *
 * Plik importują wyłącznie testy: nie wchodzi do barrela `@/lib/domain` ani do bundla aplikacji.
 * Nie jest heurystyką ani próbkowaniem — przeszukuje całą przestrzeń decyzji „pomiń postać albo
 * weź ją z jednym z dopuszczalnych podzbiorów perków".
 *
 * Wykonalność opiera się na jednej obserwacji: **próg jest sufitem**. Punkty ponad próg nie
 * zmieniają werdyktu, więc stanem przeszukiwania jest wektor braków przycięty do zakresu
 * 0–`COMPETENCY_THRESHOLD`, a nie wektor sum. Daje to 3⁷ = 2187 stanów i pozwala memoizować po
 * `(indeks postaci, liczba członków, stan)` — rząd 10⁵ węzłów zamiast ~10⁸ liści naiwnego
 * przeszukania.
 */

/** Braki są przycięte do 0–próg, więc każda kompetencja ma `próg + 1` możliwych wartości. */
const DEFICIT_BASE = COMPETENCY_THRESHOLD + 1;

const STATE_COUNT = DEFICIT_BASE ** COMPETENCIES.length;

/** Stan początkowy: każda kompetencja brakuje pełnego progu. */
const FULL_DEFICIT_STATE = STATE_COUNT - 1;

/** Stan docelowy: zero braków w każdej kompetencji. */
const CLOSED_STATE = 0;

function competencyIndex(competency: Competency): number {
  return COMPETENCIES.indexOf(competency);
}

/** Jedna z dopuszczalnych decyzji „weź postać": które perki i ile punktów dokłada do której kompetencji. */
interface PickOption {
  perkIds: readonly string[];
  /** Pary (indeks kompetencji, punkty) — specjalizacja plus wybrane perki. */
  contributions: readonly (readonly [number, number])[];
}

/** Wszystkie podzbiory o rozmiarze 0..`maxSize`, w kolejności rosnącej rozmiaru. */
function subsetsUpTo<T>(items: readonly T[], maxSize: number): T[][] {
  const result: T[][] = [[]];

  for (let size = 1; size <= maxSize; size += 1) {
    const pick = (start: number, chosen: T[]): void => {
      if (chosen.length === size) {
        result.push(chosen);
        return;
      }
      for (let index = start; index < items.length; index += 1) {
        pick(index + 1, [...chosen, items[index]]);
      }
    };
    pick(0, []);
  }

  return result;
}

function pickOptions(character: Character): PickOption[] {
  return subsetsUpTo(character.perks, MAX_PERKS_PER_MEMBER).map((perks) => ({
    perkIds: perks.map((perk) => perk.id),
    contributions: [
      [competencyIndex(character.specialization), SPECIALIZATION_POINTS],
      ...perks.map((perk) => [competencyIndex(perk.competency), PERK_POINTS] as const),
    ],
  }));
}

function decodeDeficits(state: number): number[] {
  const deficits: number[] = [];
  let rest = state;

  for (const _competency of COMPETENCIES) {
    deficits.push(rest % DEFICIT_BASE);
    rest = Math.floor(rest / DEFICIT_BASE);
  }

  return deficits;
}

function encodeDeficits(deficits: readonly number[]): number {
  let state = 0;

  for (let index = deficits.length - 1; index >= 0; index -= 1) {
    state = state * DEFICIT_BASE + deficits[index];
  }

  return state;
}

/** Stan po dołożeniu postaci — braki maleją o wniesione punkty i nie schodzą poniżej zera. */
function applyOption(state: number, option: PickOption): number {
  const deficits = decodeDeficits(state);

  for (const [index, points] of option.contributions) {
    deficits[index] = Math.max(0, deficits[index] - points);
  }

  return encodeDeficits(deficits);
}

function memoKey(characterIndex: number, members: number, state: number): number {
  return (characterIndex * (MAX_TEAM_SIZE + 1) + members) * STATE_COUNT + state;
}

function memoSize(pool: CharacterPool): number {
  return (pool.length + 1) * (MAX_TEAM_SIZE + 1) * STATE_COUNT;
}

/**
 * Pierwszy znaleziony skład domykający próg, albo `null`, gdy pula jest nierozwiązywalna.
 *
 * Wynik jest legalnym wejściem `evaluateTeam`: co najwyżej `MAX_TEAM_SIZE` różnych postaci,
 * co najwyżej `MAX_PERKS_PER_MEMBER` perków u każdej. Solver nie jest jedynym świadkiem —
 * test przepuszcza wynik przez `evaluateTeam`.
 */
export function findThresholdSolution(pool: CharacterPool): TeamComposition | null {
  const options = pool.map(pickOptions);
  const deadEnds = new Uint8Array(memoSize(pool));
  const chosen: MemberSelection[] = [];

  function search(characterIndex: number, members: number, state: number): boolean {
    if (state === CLOSED_STATE) return true;
    if (characterIndex === pool.length) return false;

    const key = memoKey(characterIndex, members, state);
    if (deadEnds[key] === 1) return false;

    if (members < MAX_TEAM_SIZE) {
      for (const option of options[characterIndex]) {
        chosen.push({ characterId: pool[characterIndex].id, perkIds: option.perkIds });
        if (search(characterIndex + 1, members + 1, applyOption(state, option))) return true;
        chosen.pop();
      }
    }

    if (search(characterIndex + 1, members, state)) return true;

    deadEnds[key] = 1;
    return false;
  }

  return search(0, 0, FULL_DEFICIT_STATE) ? chosen : null;
}

/**
 * Liczba wszystkich domykających par (podzbiór postaci, przypisanie perków), liczona wyczerpująco.
 *
 * Każda para jest liczona dokładnie raz, niezależnie od liczby członków — skład pięciu postaci
 * i ten sam skład z szóstym członkiem to dwie różne pary.
 */
export function countThresholdSolutions(pool: CharacterPool): number {
  const options = pool.map(pickOptions);
  const memo = new Float64Array(memoSize(pool)).fill(-1);

  function count(characterIndex: number, members: number, state: number): number {
    if (characterIndex === pool.length) return state === CLOSED_STATE ? 1 : 0;

    const key = memoKey(characterIndex, members, state);
    if (memo[key] >= 0) return memo[key];

    let total = count(characterIndex + 1, members, state);

    if (members < MAX_TEAM_SIZE) {
      for (const option of options[characterIndex]) {
        total += count(characterIndex + 1, members + 1, applyOption(state, option));
      }
    }

    memo[key] = total;
    return total;
  }

  return count(0, 0, FULL_DEFICIT_STATE);
}
