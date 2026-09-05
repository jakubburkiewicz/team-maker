import { describe, expect, it } from "vitest";

import { isTeamId } from "@/lib/team-repo";

/**
 * Testowana jest wyłącznie czysta część repo — strażnik formatu `isTeamId`. `createTeam`
 * i `getTeamSummary` sięgają po Supabase i są weryfikowane ręcznie (twarda reguła: testy nie
 * bootstrapują Astro ani Supabase).
 */

describe("isTeamId", () => {
  it("UUID v4 przechodzi, także wielkimi literami", () => {
    expect(isTeamId("caa57bde-c35a-4279-b4b3-4577cff21922")).toBe(true);
    expect(isTeamId("CAA57BDE-C35A-4279-B4B3-4577CFF21922")).toBe(true);
  });

  it.each([
    ["nie-UUID", "abc"],
    ["pusty", ""],
    ["UUID bez myślników", "caa57bdec35a4279b4b34577cff21922"],
    ["UUID z ogonem", "caa57bde-c35a-4279-b4b3-4577cff21922x"],
    ["undefined (Astro.params bez segmentu)", undefined],
  ])("%s → false", (_label, value) => {
    expect(isTeamId(value)).toBe(false);
  });
});
