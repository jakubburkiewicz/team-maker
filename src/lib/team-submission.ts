import {
  COMPETENCY_THRESHOLD,
  evaluateTeam,
  type CharacterPool,
  type MemberSelection,
  type TeamComposition,
} from "@/lib/domain";

/**
 * Decyzja zapisu drużyny — jedno miejsce, w którym surowe wejście z formularza staje się
 * `TeamComposition` albo odrzuceniem, i w którym próg jest sprawdzany tym samym `evaluateTeam`
 * co w wyspie (Guardrail PRD: „reguła obowiązuje także poza interfejsem").
 *
 * Moduł jest czysty: bez `astro:*`, bez `@/lib/supabase`. Leży w `src/lib/` (granica I/O — zna
 * kształt pola formularza), nie w `src/lib/domain/` (sama reguła). Parser nie sprawdza limitów
 * ani puli — to robi `evaluateTeam`; rozdział jest celowy, żeby test parsera nie duplikował
 * testów reguły.
 *
 * Od S-04 moduł jest **wspólną umową kształtu składu dla obu kierunków**, nie tylko dla zapisu:
 * `toTeamComposition` startuje od `unknown` i obsługuje odczyt (`composition` z PostgREST wraca
 * już sparsowane), a `parseTeamComposition` dokłada nad nim wyłącznie `JSON.parse` dla formularza.
 * Druga kopia umowy `{ characterId, perkIds }` po stronie odczytu rozjechałaby się z tą.
 */

/**
 * Nazwa ukrytego pola formularza — wspólna dla `CompositionGate` i **obu** tras zapisu
 * (`POST /api/teams`, `POST /api/teams/[id]`), bo bramka wysyła ten sam ładunek niezależnie
 * od tego, czy zapis tworzy wiersz, czy podmienia skład istniejącego.
 */
export const COMPOSITION_FIELD = "composition";

/**
 * Tekst odmowy dla `below-threshold` (FR-018) — **jedyna kopia w drzewie**. Bramka w wyspie
 * pokazuje go pod zablokowanym przyciskiem, a obie trasy zapisu odrzucają nim przez `?error=`;
 * druga kopia rozjechałaby się z regułą, którą liczy `evaluateTeam`. Zbudowany
 * z `COMPETENCY_THRESHOLD`, żeby liczba w tekście nie mogła rozminąć się z progiem w domenie.
 */
export const BELOW_THRESHOLD_MESSAGE = `Every competency needs at least ${COMPETENCY_THRESHOLD} points before the team can embark.`;

/** Tekst odmowy dla `invalid-payload` — wspólny dla obu tras zapisu, z tego samego powodu. */
export const INVALID_PAYLOAD_MESSAGE = "Invalid team payload";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Element składu ze zdjętymi nadmiarowymi polami — do bazy idzie wyłącznie `{ characterId, perkIds }`. */
function toMemberSelection(value: unknown): MemberSelection | null {
  if (!isRecord(value)) return null;

  const { characterId, perkIds } = value;

  if (typeof characterId !== "string" || !isStringArray(perkIds)) return null;

  return { characterId, perkIds };
}

/**
 * `unknown` → `TeamComposition`; `null` przy każdym odstępstwie od kształtu (nie rzuca).
 *
 * Przyjmuje wyłącznie tablicę obiektów z `characterId: string` i `perkIds: string[]`. Nie-tablica,
 * element nie-obiekt, brak lub zły typ pola → `null`. Nadmiarowe pola są odrzucane.
 *
 * Wejście jest już wartością, nie tekstem — tędy wchodzi `composition` odczytane z bazy
 * (`getTeamDetail`), które PostgREST zwraca sparsowane. Ścieżka formularza dokłada nad tym
 * `JSON.parse` w `parseTeamComposition`.
 */
export function toTeamComposition(value: unknown): TeamComposition | null {
  if (!Array.isArray(value)) return null;

  const members: MemberSelection[] = [];

  for (const item of value) {
    const member = toMemberSelection(item);
    if (member === null) return null;
    members.push(member);
  }

  return members;
}

/**
 * JSON → `TeamComposition`; `null` przy każdym odstępstwie od kształtu (nie rzuca).
 *
 * Sam `JSON.parse` w `try`/`catch` plus `toTeamComposition` — cała kontrola kształtu jest tam,
 * więc ścieżka zapisu i odczytu nie mogą się rozjechać. Nie-JSON → `null`.
 */
export function parseTeamComposition(raw: string): TeamComposition | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return toTeamComposition(parsed);
}

export type SubmissionRejection = { kind: "invalid-payload" } | { kind: "below-threshold" };

export type SubmissionResult = { ok: true; composition: TeamComposition } | { ok: false; reason: SubmissionRejection };

/**
 * Parser + `evaluateTeam(...).isValid`. `below-threshold` obejmuje też naruszenia limitów —
 * `isValid` zeruje się przy każdym z nich, więc bramka wiąże zapis z werdyktem, nie z samym progiem.
 * Wynik `ok` niesie skład **po parserze** (bez nadmiarowych pól) — to on idzie do bazy.
 */
export function gateTeamSubmission(raw: string, pool: CharacterPool): SubmissionResult {
  const composition = parseTeamComposition(raw);

  if (composition === null) {
    return { ok: false, reason: { kind: "invalid-payload" } };
  }

  if (!evaluateTeam(composition, pool).isValid) {
    return { ok: false, reason: { kind: "below-threshold" } };
  }

  return { ok: true, composition };
}
