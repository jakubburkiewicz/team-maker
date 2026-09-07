import { describe, expect, it } from "vitest";

import { teamActions } from "@/lib/team-actions";

/**
 * Adresy, kolejność i kształt nazw dostępnych trzech akcji drużyny.
 *
 * Asercje są **literałami**, nie odczytami z tego, co moduł zwrócił — asercja podążająca za
 * mutacją modułu przestaje cokolwiek wiązać (wzorzec z `src/lib/nav.test.ts`). Dwaj konsumenci
 * (wiersz listy na `/` i kolumna boczna `/teams/[id]`) czytają dokładnie te wartości, więc
 * rozjazd między ekranami czerwieni się tutaj.
 */
const TEAM_ID = "3f1c9a52-8b7d-4e21-9c0a-6d5e4f3b2a10";
const TEAM_NAME = "K7-QN4X";

describe("teamActions — kolejność i treść", () => {
  it("zwraca dokładnie trzy akcje: wyruszenie, edycję i usunięcie, w tej kolejności", () => {
    expect(teamActions({ id: TEAM_ID, name: TEAM_NAME })).toEqual([
      {
        kind: "embark",
        href: "/teams/3f1c9a52-8b7d-4e21-9c0a-6d5e4f3b2a10/embark",
        label: "Embark on the job",
        ariaLabel: "Embark on the job with team K7-QN4X",
      },
      {
        kind: "edit",
        href: "/teams/3f1c9a52-8b7d-4e21-9c0a-6d5e4f3b2a10",
        label: "Edit team",
        ariaLabel: "Edit team K7-QN4X",
      },
      {
        kind: "delete",
        label: "Delete team",
        ariaLabel: "Delete team K7-QN4X",
      },
    ]);
  });

  it("kolejność jest embark → edit → delete", () => {
    const kinds = teamActions({ id: TEAM_ID, name: TEAM_NAME }).map((action) => action.kind);

    expect(kinds).toEqual(["embark", "edit", "delete"]);
  });
});

describe("teamActions — adres niesie dokładnie wyruszenie i edycja", () => {
  it("wyruszenie prowadzi na ekran wyruszenia tej drużyny", () => {
    const [embark] = teamActions({ id: TEAM_ID, name: TEAM_NAME });

    expect(embark.href).toBe("/teams/3f1c9a52-8b7d-4e21-9c0a-6d5e4f3b2a10/embark");
  });

  it("edycja prowadzi na stronę tej drużyny", () => {
    const [, edit] = teamActions({ id: TEAM_ID, name: TEAM_NAME });

    expect(edit.href).toBe("/teams/3f1c9a52-8b7d-4e21-9c0a-6d5e4f3b2a10");
  });

  it("usunięcie NIE niesie adresu — to POST za oknem potwierdzenia, nie nawigacja", () => {
    const [, , remove] = teamActions({ id: TEAM_ID, name: TEAM_NAME });

    expect("href" in remove).toBe(false);
  });
});

describe("teamActions — nazwy dostępne", () => {
  it("każda z trzech nazw dostępnych jest niepusta i zawiera nazwę-hash drużyny", () => {
    // Trzy wiersze listy różnią się dla czytnika ekranu wyłącznie tą nazwą — ikona bez tekstu
    // nie niesie nic innego (pkt 6 zgłoszenia).
    for (const action of teamActions({ id: TEAM_ID, name: TEAM_NAME })) {
      expect(action.ariaLabel).not.toBe("");
      expect(action.ariaLabel).toContain("K7-QN4X");
    }
  });

  it("nazwa dostępna idzie za nazwą drużyny, a nie za identyfikatorem", () => {
    const [embark, edit, remove] = teamActions({ id: TEAM_ID, name: "ZX-9911" });

    expect(embark.ariaLabel).toBe("Embark on the job with team ZX-9911");
    expect(edit.ariaLabel).toBe("Edit team ZX-9911");
    expect(remove.ariaLabel).toBe("Delete team ZX-9911");
  });
});

describe("teamActions — kodowanie identyfikatora", () => {
  it("identyfikator wymagający kodowania nie trafia do adresu surowy", () => {
    // Moduł nie zakłada, że dostał UUID — tak samo jak nie zakłada tego
    // `src/pages/api/teams/[id].ts`. Dla poprawnego UUID kodowanie jest identycznością.
    const [embark, edit] = teamActions({ id: "a/b?c#d", name: TEAM_NAME });

    expect(edit.href).toBe("/teams/a%2Fb%3Fc%23d");
    expect(embark.href).toBe("/teams/a%2Fb%3Fc%23d/embark");
  });

  it("poprawny UUID przechodzi przez kodowanie bez zmiany", () => {
    const [, edit] = teamActions({ id: TEAM_ID, name: TEAM_NAME });

    expect(edit.href).toBe("/teams/3f1c9a52-8b7d-4e21-9c0a-6d5e4f3b2a10");
  });
});
