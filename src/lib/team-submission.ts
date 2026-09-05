import { evaluateTeam, type CharacterPool, type MemberSelection, type TeamComposition } from "@/lib/domain";

/**
 * Decyzja zapisu drużyny — jedno miejsce, w którym surowe wejście z formularza staje się
 * `TeamComposition` albo odrzuceniem, i w którym próg jest sprawdzany tym samym `evaluateTeam`
 * co w wyspie (Guardrail PRD: „reguła obowiązuje także poza interfejsem").
 *
 * Moduł jest czysty: bez `astro:*`, bez `@/lib/supabase`. Leży w `src/lib/` (granica I/O — zna
 * kształt pola formularza), nie w `src/lib/domain/` (sama reguła). Parser nie sprawdza limitów
 * ani puli — to robi `evaluateTeam`; rozdział jest celowy, żeby test parsera nie duplikował
 * testów reguły.
 */

/** Nazwa ukrytego pola formularza — wspólna dla `EmbarkGate` i `POST /api/teams`. */
export const COMPOSITION_FIELD = "composition";

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
 * JSON → `TeamComposition`; `null` przy każdym odstępstwie od kształtu (nie rzuca).
 *
 * Przyjmuje wyłącznie tablicę obiektów z `characterId: string` i `perkIds: string[]`. Nie-JSON,
 * nie-tablica, element nie-obiekt, brak lub zły typ pola → `null`. Nadmiarowe pola są odrzucane.
 */
export function parseTeamComposition(raw: string): TeamComposition | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const members: MemberSelection[] = [];

  for (const item of parsed) {
    const member = toMemberSelection(item);
    if (member === null) return null;
    members.push(member);
  }

  return members;
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
