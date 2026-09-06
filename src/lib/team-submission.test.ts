import { describe, expect, it } from "vitest";

import {
  CHARACTER_POOL,
  COMPETENCY_THRESHOLD,
  addMember,
  evaluateTeam,
  removeMember,
  togglePerk,
  type Competency,
  type TeamComposition,
} from "@/lib/domain";
import { findThresholdSolution } from "@/lib/domain/solvability";
import {
  COMPOSITION_FIELD,
  MAX_COMPOSITION_PAYLOAD_BYTES,
  gateTeamSubmission,
  parseTeamComposition,
} from "@/lib/team-submission";

/**
 * Dowód Guardraila „zapisana drużyna zawsze spełnia próg — reguła obowiązuje także poza
 * interfejsem": bramka serwerowa przepuszcza wyłącznie składy z `isValid` i odrzuca każdy inny
 * kształt wejścia. Progi i limity w asercjach są literałami z PRD (`6`, `2`), identyfikatory
 * z `CHARACTER_POOL`, nie literały (uwaga F3 z przeglądu S-01).
 */

const POOL_IDS = CHARACTER_POOL.map((character) => character.id);

function perkIdsOf(characterId: string): readonly string[] {
  const character = CHARACTER_POOL.find((candidate) => candidate.id === characterId);
  if (character === undefined) throw new Error(`Character ${characterId} missing from pool`);
  return character.perks.map((perk) => perk.id);
}

/**
 * Kompetencja, do której perk dokłada punkty — szukana po `id` w całej puli, bo perki żyją
 * w postaciach. Istniejący `perkIdsOf` zwraca same identyfikatory, więc test edycji potrzebuje
 * drugiego lookupu, żeby wiedzieć, **którą** kompetencję cofa odznaczenie.
 */
function competencyOfPerk(perkId: string): Competency {
  for (const character of CHARACTER_POOL) {
    const perk = character.perks.find((candidate) => candidate.id === perkId);
    if (perk !== undefined) return perk.competency;
  }
  throw new Error(`Perk ${perkId} missing from pool`);
}

/** Skład domykający próg z solvera — rzuca, gdy pula jest nierozwiązywalna (to sprawdza F-02). */
function solvedComposition(): TeamComposition {
  const solution = findThresholdSolution(CHARACTER_POOL);
  if (solution === null) throw new Error("CHARACTER_POOL has no threshold solution");
  return solution;
}

/** Skład zbudowany wyłącznie przez pisarzy z `roster.ts`: dwie postacie, jedna z dwoma perkami. */
function rosterBuiltComposition(): TeamComposition {
  const first = addMember([], POOL_IDS[0], CHARACTER_POOL);
  if (!first.ok) throw new Error(first.reason.kind);
  const second = addMember(first.composition, POOL_IDS[1], CHARACTER_POOL);
  if (!second.ok) throw new Error(second.reason.kind);

  let composition = second.composition;
  for (const perkId of perkIdsOf(POOL_IDS[1]).slice(0, 2)) {
    const toggled = togglePerk(composition, POOL_IDS[1], perkId, CHARACTER_POOL);
    if (!toggled.ok) throw new Error(toggled.reason.kind);
    composition = toggled.composition;
  }

  return composition;
}

describe("COMPOSITION_FIELD", () => {
  it("jest stałym literałem nazwy pola — obie strony formularza dzielą go przez import", () => {
    expect(COMPOSITION_FIELD).toBe("composition");
  });
});

describe("parseTeamComposition — limit rozmiaru ładunku", () => {
  it("uczciwy skład maksymalnej wielkości mieści się w limicie z ogromnym zapasem", () => {
    // To jest właściwa treść tego testu: limit nie może trafić gracza. Gdyby przyszła zmiana
    // (dłuższe identyfikatory, większy skład) zbliżyła uczciwy ładunek do granicy, ten test
    // spada, zanim zrobi to użytkownik.
    const raw = JSON.stringify(solvedComposition());

    expect(raw.length).toBeLessThan(MAX_COMPOSITION_PAYLOAD_BYTES / 2);
    expect(parseTeamComposition(raw)).not.toBeNull();
  });

  it("ładunek powyżej limitu jest odrzucany bez parsowania", () => {
    // Poprawny JSON, poprawny kształt — odrzucony wyłącznie za rozmiar, więc dowodzi, że kontrola
    // stoi przed `JSON.parse`, a nie wynika z niepoprawnej treści.
    const huge = JSON.stringify(Array.from({ length: 5000 }, () => ({ characterId: POOL_IDS[0], perkIds: [] })));

    expect(huge.length).toBeGreaterThan(MAX_COMPOSITION_PAYLOAD_BYTES);
    expect(parseTeamComposition(huge)).toBeNull();
  });

  it("bramka mapuje przerośnięty ładunek na invalid-payload, nie below-threshold", () => {
    // Różnica jest widoczna dla gracza: `below-threshold` mówi „uzupełnij kompetencje", a to nie
    // jest prawda o ładunku, którego nie dało się nawet odczytać.
    const huge = JSON.stringify(Array.from({ length: 5000 }, () => ({ characterId: POOL_IDS[0], perkIds: [] })));

    expect(gateTeamSubmission(huge, CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "invalid-payload" },
    });
  });
});

describe("parseTeamComposition", () => {
  it("round-trip przez JSON.stringify składu zbudowanego przez addMember + togglePerk daje równy skład", () => {
    const composition = rosterBuiltComposition();

    expect(parseTeamComposition(JSON.stringify(composition))).toEqual(composition);
  });

  it("pusta tablica daje pusty skład", () => {
    expect(parseTeamComposition("[]")).toEqual([]);
  });

  it.each([
    ["nie-JSON", "not json"],
    ["obiekt zamiast tablicy", "{}"],
    ["element nie-obiekt", "[1]"],
    ["element null", "[null]"],
    ["element bez perkIds", JSON.stringify([{ characterId: POOL_IDS[0] }])],
    ["perkIds z liczbą", JSON.stringify([{ characterId: POOL_IDS[0], perkIds: [1] }])],
    ["perkIds nie-tablica", JSON.stringify([{ characterId: POOL_IDS[0], perkIds: "x" }])],
    ["characterId liczbowe", JSON.stringify([{ characterId: 1, perkIds: [] }])],
  ])("%s → null", (_label, raw) => {
    expect(parseTeamComposition(raw)).toBeNull();
  });

  it("nadmiarowe pole znika z wyniku — do bazy idzie wyłącznie characterId i perkIds", () => {
    const raw = JSON.stringify([{ characterId: POOL_IDS[0], perkIds: [], name: "x" }]);

    expect(parseTeamComposition(raw)).toEqual([{ characterId: POOL_IDS[0], perkIds: [] }]);
  });

  it("nie sprawdza limitów ani puli — siedmiu nieznanych członków przechodzi przez parser", () => {
    const raw = JSON.stringify(
      Array.from({ length: 7 }, (_, index) => ({ characterId: `ghost-${index}`, perkIds: [] })),
    );

    expect(parseTeamComposition(raw)).toHaveLength(7);
  });
});

describe("gateTeamSubmission", () => {
  it("skład z solvera przechodzi jako ok, a isValid potwierdza niezależnie evaluateTeam", () => {
    const solution = solvedComposition();

    const result = gateTeamSubmission(JSON.stringify(solution), CHARACTER_POOL);

    expect(result).toEqual({ ok: true, composition: solution });
    expect(evaluateTeam(solution, CHARACTER_POOL).isValid).toBe(true);
  });

  it("sześć postaci bez perków nie domyka progu — perki są konieczne (PRD → Business Logic)", () => {
    const composition = POOL_IDS.slice(0, 6).map((characterId) => ({ characterId, perkIds: [] }));

    expect(gateTeamSubmission(JSON.stringify(composition), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("siódmy członek doklejony na siłę do domkniętego składu → below-threshold", () => {
    const solution = solvedComposition();
    const taken = new Set(solution.map((member) => member.characterId));
    const spare = POOL_IDS.filter((id) => !taken.has(id));
    const forced: TeamComposition = [
      ...solution,
      ...spare.slice(0, 7 - solution.length).map((characterId) => ({ characterId, perkIds: [] })),
    ];

    expect(forced).toHaveLength(7);
    expect(gateTeamSubmission(JSON.stringify(forced), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("trzeci perk doklejony na siłę do domkniętego składu → below-threshold", () => {
    const [first, ...rest] = solvedComposition();
    const forced: TeamComposition = [
      { characterId: first.characterId, perkIds: perkIdsOf(first.characterId) },
      ...rest,
    ];

    expect(forced[0].perkIds).toHaveLength(3);
    expect(gateTeamSubmission(JSON.stringify(forced), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("ten sam perk dwukrotnie u jednego członka → below-threshold (nie liczy się podwójnie)", () => {
    const [first, ...rest] = solvedComposition();
    const [perkId] = perkIdsOf(first.characterId);
    const forced: TeamComposition = [{ characterId: first.characterId, perkIds: [perkId, perkId] }, ...rest];

    expect(forced[0].perkIds).toHaveLength(2);
    expect(gateTeamSubmission(JSON.stringify(forced), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("characterId spoza puli → below-threshold", () => {
    const [first, ...rest] = solvedComposition();
    const forced: TeamComposition = [{ characterId: "ghost", perkIds: first.perkIds }, ...rest];

    expect(gateTeamSubmission(JSON.stringify(forced), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("nie-JSON → invalid-payload", () => {
    expect(gateTeamSubmission("not json", CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "invalid-payload" },
    });
  });

  it("pusta tablica → below-threshold", () => {
    expect(gateTeamSubmission("[]", CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("wynik ok niesie skład po parserze — bez nadmiarowych pól", () => {
    const solution = solvedComposition();
    const raw = JSON.stringify(solution.map((member) => ({ ...member, note: "drop me" })));

    const result = gateTeamSubmission(raw, CHARACTER_POOL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.composition).toEqual(solution);
    for (const member of result.composition) {
      expect(member).not.toHaveProperty("note");
    }
  });
});

/**
 * Próg działa **w obie strony** (US-02, FR-009): bramka nie wie, czy zapisuje nowy wiersz, czy
 * podmienia istniejący, więc edycja przechodzi przez dokładnie tę samą regułę co pierwszy zapis.
 * Bez tego bloku ryzyko „fragment sprawdzający próg tylko przy pierwszym zapisie łamie Guardrail
 * tylnymi drzwiami" byłoby komentarzem, a nie wykonywalnym zdaniem w CI.
 *
 * Każdy skład idzie przez `JSON.stringify` — bramka przyjmuje string, więc to jest ta sama droga,
 * którą idzie formularz. Punktem wyjścia jest zawsze `solvedComposition()`; `roster.ts` służy
 * do wykonywania na nim **ruchów**, nie do budowania go od zera.
 */
describe("gateTeamSubmission — edycja zapisanej drużyny", () => {
  it("usunięcie członka cofa próg — zapis zmian jest odrzucany tak samo jak pierwszy zapis", () => {
    const saved = solvedComposition();
    const [dropped] = saved;

    const edited = removeMember(saved, dropped.characterId);

    expect(edited).toHaveLength(saved.length - 1);
    expect(gateTeamSubmission(JSON.stringify(edited), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("odznaczenie perka cofa jego kompetencję poniżej progu — blokada nie omija perków", () => {
    const saved = solvedComposition();
    // Rozwiązanie solvera stawia wszystkie siedem kompetencji **dokładnie** na progu, więc każdy
    // wybrany perk jest ostatnim punktem swojej kompetencji — wystarczy wziąć pierwszy z brzegu
    // i sprawdzić, którą kompetencję cofa. Twardy identyfikator rozsypałby się po zmianie seeda.
    const owner = saved.find((member) => member.perkIds.length > 0);
    if (owner === undefined) throw new Error("Solved composition has no perks to unselect");
    const [perkId] = owner.perkIds;
    const competency = competencyOfPerk(perkId);

    const toggled = togglePerk(saved, owner.characterId, perkId, CHARACTER_POOL);
    expect(toggled.ok).toBe(true);
    if (!toggled.ok) return;

    expect(toggled.composition).not.toContainEqual(owner);
    expect(evaluateTeam(toggled.composition, CHARACTER_POOL).scores[competency]).toBeLessThan(COMPETENCY_THRESHOLD);
    expect(gateTeamSubmission(JSON.stringify(toggled.composition), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("wymiana członka utrzymująca próg przechodzi, a zapisany skład niesie nową postać", () => {
    const saved = solvedComposition();
    const [dropped] = saved;
    const without = removeMember(saved, dropped.characterId);

    // Zastępca jest **znajdowany**, nie wpisywany: po usunięciu członka próg domyka dokładnie jedna
    // postać z puli i zmiana seeda mogłaby ją podmienić. Usunięty jest wykluczony z kandydatów —
    // ponowne dodanie tej samej postaci odtworzyłoby skład zapisany, a to nie jest wymiana.
    const replacement = POOL_IDS.filter(
      (id) => id !== dropped.characterId && !without.some((member) => member.characterId === id),
    ).find((id) => {
      const added = addMember(without, id, CHARACTER_POOL);
      return added.ok && gateTeamSubmission(JSON.stringify(added.composition), CHARACTER_POOL).ok;
    });
    if (replacement === undefined) throw new Error("No single character closes the threshold after the removal");

    const added = addMember(without, replacement, CHARACTER_POOL);
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const result = gateTeamSubmission(JSON.stringify(added.composition), CHARACTER_POOL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const savedIds = result.composition.map((member) => member.characterId);
    expect(savedIds).toContain(replacement);
    expect(savedIds).not.toContain(dropped.characterId);
    expect(savedIds).toHaveLength(saved.length);
  });
});
