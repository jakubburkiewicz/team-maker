import { describe, expect, it } from "vitest";

import { hasUnsavedChanges } from "@/lib/composition-changes";
import type { TeamComposition } from "@/lib/domain";

/**
 * Semantyka **zbiorowa** porównania składów — jedyna nowa logika tej zmiany i jedyna bariera
 * przed cichą utratą pracy gracza (przycisk wyruszenia nie zapisuje).
 *
 * Dwa przypadki, które najłatwiej zgubić przy porównaniu pozycyjnym, mają tu własne opisy: inna
 * kolejność członków oraz zdjęcie i ponowny wybór tego samego perka.
 */
const RIPPER = "ripper";
const VOLT = "volt";
const MIRE = "mire";

const SAVED: TeamComposition = [
  { characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-triage"] },
  { characterId: VOLT, perkIds: ["volt-splice"] },
];

describe("hasUnsavedChanges — brak zmian", () => {
  it("identyczny skład to brak zmian", () => {
    expect(hasUnsavedChanges(SAVED, SAVED)).toBe(false);
  });

  it("ten sam komplet członków w innej kolejności slotów to brak zmian", () => {
    const reordered: TeamComposition = [
      { characterId: VOLT, perkIds: ["volt-splice"] },
      { characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-triage"] },
    ];

    expect(hasUnsavedChanges(reordered, SAVED)).toBe(false);
  });

  it("te same perki wybrane w innej kolejności to brak zmian", () => {
    // To jest ten sam ruch co „zdejmij perk i wybierz go z powrotem": `togglePerk` dokłada perk
    // na koniec listy, więc powrót zmienia kolejność, a nie komplet. Porównanie pozycyjne
    // zostawiłoby tu przycisk wyruszenia zgaszony po ruchu, który niczego nie zmienił.
    const retoggled: TeamComposition = [
      { characterId: RIPPER, perkIds: ["ripper-triage", "ripper-brawl"] },
      { characterId: VOLT, perkIds: ["volt-splice"] },
    ];

    expect(hasUnsavedChanges(retoggled, SAVED)).toBe(false);
  });

  it("dwa puste składy to brak zmian", () => {
    expect(hasUnsavedChanges([], [])).toBe(false);
  });
});

describe("hasUnsavedChanges — zmiany w składzie", () => {
  it("dołożony członek to zmiana", () => {
    const withExtra: TeamComposition = [...SAVED, { characterId: MIRE, perkIds: [] }];

    expect(hasUnsavedChanges(withExtra, SAVED)).toBe(true);
  });

  it("usunięty członek to zmiana", () => {
    const withoutVolt: TeamComposition = [{ characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-triage"] }];

    expect(hasUnsavedChanges(withoutVolt, SAVED)).toBe(true);
  });

  it("wymieniony członek to zmiana, nawet przy tej samej liczbie członków", () => {
    const swapped: TeamComposition = [
      { characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-triage"] },
      { characterId: MIRE, perkIds: ["volt-splice"] },
    ];

    expect(hasUnsavedChanges(swapped, SAVED)).toBe(true);
  });

  it("pusty skład wobec niepustego to zmiana", () => {
    expect(hasUnsavedChanges([], SAVED)).toBe(true);
  });

  it("niepusty skład wobec pustego to zmiana", () => {
    expect(hasUnsavedChanges(SAVED, [])).toBe(true);
  });
});

describe("hasUnsavedChanges — zmiany w perkach", () => {
  it("dołożony perk u istniejącego członka to zmiana", () => {
    const extraPerk: TeamComposition = [
      { characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-triage"] },
      { characterId: VOLT, perkIds: ["volt-splice", "volt-ghost"] },
    ];

    expect(hasUnsavedChanges(extraPerk, SAVED)).toBe(true);
  });

  it("zdjęty perk u istniejącego członka to zmiana", () => {
    const fewerPerks: TeamComposition = [
      { characterId: RIPPER, perkIds: ["ripper-brawl"] },
      { characterId: VOLT, perkIds: ["volt-splice"] },
    ];

    expect(hasUnsavedChanges(fewerPerks, SAVED)).toBe(true);
  });

  it("podmieniony perk u istniejącego członka to zmiana", () => {
    const swappedPerk: TeamComposition = [
      { characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-scout"] },
      { characterId: VOLT, perkIds: ["volt-splice"] },
    ];

    expect(hasUnsavedChanges(swappedPerk, SAVED)).toBe(true);
  });

  it("członek bez perków wobec tego samego członka z perkiem to zmiana", () => {
    const stripped: TeamComposition = [
      { characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-triage"] },
      { characterId: VOLT, perkIds: [] },
    ];

    expect(hasUnsavedChanges(stripped, SAVED)).toBe(true);
  });
});

describe("hasUnsavedChanges — obrona w głąb", () => {
  it("powtórzona postać nie zwija się w jeden klucz i nie przechodzi jako brak zmian", () => {
    // Stan nieosiągalny z wyspy (FR-012 zakazuje powtórzeń, a `addMember` je odrzuca).
    // Porównanie **musi** iść przez `[A, A]` wobec `[A]`, a nie wobec `[A, B]`: przy dwóch różnych
    // postaciach po drugiej stronie rozmiary map i tak się rozjeżdżają, więc sama mapa bez
    // porównania z długością składu przeszłaby taki test na zielono (sonda 2026-09-07).
    const oneMember: TeamComposition = [{ characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-triage"] }];
    const duplicated: TeamComposition = [
      { characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-triage"] },
      { characterId: RIPPER, perkIds: ["ripper-brawl", "ripper-triage"] },
    ];

    expect(hasUnsavedChanges(duplicated, oneMember)).toBe(true);
  });

  it("powtórzony perk nie zwija się w jeden element i nie przechodzi jako brak zmian", () => {
    // Ta sama pułapka piętro niżej: `["p", "p"]` wobec `["p"]`. Zbiory po obu stronach są równe,
    // więc wiąże dopiero porównanie długości list perków.
    const onePerk: TeamComposition = [{ characterId: VOLT, perkIds: ["volt-splice"] }];
    const duplicatedPerk: TeamComposition = [{ characterId: VOLT, perkIds: ["volt-splice", "volt-splice"] }];

    expect(hasUnsavedChanges(duplicatedPerk, onePerk)).toBe(true);
  });
});
