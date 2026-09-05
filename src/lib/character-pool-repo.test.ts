import { describe, expect, it } from "vitest";

import { mapPoolRows, type CharacterRow } from "@/lib/character-pool-repo";
import { evaluateTeam } from "@/lib/domain";

/**
 * Testowane jest wyłącznie czyste `mapPoolRows` na ręcznie zbudowanych wierszach — zgodnie
 * z twardą regułą: testy nie bootstrapują Astro ani Supabase.
 */

function rows(): CharacterRow[] {
  return [
    {
      id: "vesper",
      name: "Vesper Kane",
      description: "Ex-corporate strike-team lead.",
      specialization: "combat",
      sort_order: 0,
      perks: [
        { id: "vesper-breach-protocols", name: "Breach Protocols", competency: "hacking", sort_order: 0 },
        { id: "vesper-extraction-routes", name: "Extraction Routes", competency: "navigation", sort_order: 1 },
        { id: "vesper-field-triage", name: "Field Triage", competency: "medicine", sort_order: 2 },
      ],
    },
    {
      id: "torque",
      name: 'Dolores "Torque" Amani',
      description: "Chop-shop mechanic.",
      specialization: "engineering",
      sort_order: 1,
      perks: [
        { id: "torque-improvised-weapons", name: "Improvised Weapons", competency: "combat", sort_order: 0 },
        { id: "torque-service-tunnels", name: "Service Tunnel Access", competency: "navigation", sort_order: 1 },
      ],
    },
  ];
}

describe("mapPoolRows", () => {
  it("odwzorowuje wiersze na PoolCharacter z zachowaniem kolejności postaci i perków", () => {
    const pool = mapPoolRows(rows());

    expect(pool.map((character) => character.id)).toEqual(["vesper", "torque"]);
    expect(pool[0]).toEqual({
      id: "vesper",
      name: "Vesper Kane",
      description: "Ex-corporate strike-team lead.",
      specialization: "combat",
      perks: [
        { id: "vesper-breach-protocols", name: "Breach Protocols", competency: "hacking" },
        { id: "vesper-extraction-routes", name: "Extraction Routes", competency: "navigation" },
        { id: "vesper-field-triage", name: "Field Triage", competency: "medicine" },
      ],
    });
    expect(pool[1].perks.map((perk) => perk.id)).toEqual(["torque-improvised-weapons", "torque-service-tunnels"]);
  });

  it("nie przenosi sort_order do wyniku — kolejność jest w tablicy, nie w polu", () => {
    const pool = mapPoolRows(rows());

    expect(pool[0]).not.toHaveProperty("sort_order");
    expect(pool[0].perks[0]).not.toHaveProperty("sort_order");
  });

  it("wynik jest legalnym wejściem evaluateTeam — postacie i perki są rozpoznawane", () => {
    const pool = mapPoolRows(rows());
    const result = evaluateTeam(
      [
        { characterId: "vesper", perkIds: ["vesper-breach-protocols", "vesper-field-triage"] },
        { characterId: "torque", perkIds: ["torque-service-tunnels"] },
      ],
      pool,
    );

    expect(result.violations).toEqual([]);
    expect(result.scores.combat).toBe(2);
    expect(result.scores.engineering).toBe(2);
    expect(result.scores.hacking).toBe(1);
    expect(result.scores.medicine).toBe(1);
    expect(result.scores.navigation).toBe(1);
  });

  it("postać bez perków nie wywraca mapowania", () => {
    const [vesper] = rows();
    const pool = mapPoolRows([{ ...vesper, perks: [] }]);

    expect(pool).toHaveLength(1);
    expect(pool[0].perks).toEqual([]);
    expect(evaluateTeam([{ characterId: "vesper", perkIds: [] }], pool).violations).toEqual([]);
  });

  it("pusta lista wierszy daje pustą pulę", () => {
    expect(mapPoolRows([])).toEqual([]);
  });

  it("specjalizacja spoza COMPETENCIES rzuca błąd z nazwą wiersza i wartością", () => {
    const [vesper] = rows();

    expect(() => mapPoolRows([{ ...vesper, specialization: "piloting" }])).toThrow(/piloting.*vesper/);
  });

  it("kompetencja perka spoza COMPETENCIES rzuca błąd zamiast przejść dalej", () => {
    const [vesper] = rows();
    const broken: CharacterRow = {
      ...vesper,
      perks: [{ id: "vesper-mystery", name: "Mystery", competency: "sorcery", sort_order: 0 }],
    };

    expect(() => mapPoolRows([broken])).toThrow(/sorcery.*vesper-mystery/);
  });
});
