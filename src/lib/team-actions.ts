/**
 * Trzy akcje zapisanej drużyny — dokąd prowadzą i jak nazywają się dla czytnika ekranu.
 *
 * Moduł mieszka w `src/lib/`, a nie w komponentach, z tego samego powodu co `src/lib/nav.ts`:
 * nic pod testem nie może wciągać `astro:*` ani `@/lib/supabase` (AGENTS.md → Hard rules).
 * Adresy i nazwy dostępne przestają być literałami rozsianymi po `src/pages/index.astro`
 * i po kolumnie bocznej edytora — rozjazd między listą a edytorem czerwieni się wtedy
 * w `npm test`, a nie dopiero na ekranie.
 */

/**
 * Odwołanie do zapisanej drużyny: **jeden obiekt**, nie dwa pola. „id bez nazwy" i „nazwa bez id"
 * mają pozostać niereprezentowalne — tą samą logiką co `teamId` w `CompositionGate.tsx`.
 */
export interface SavedTeamRef {
  readonly id: string;
  /** Nazwa-hash drużyny (FR-011). Wchodzi do nazw dostępnych, żeby wiersze listy dały się rozróżnić. */
  readonly name: string;
}

interface TeamActionBase {
  /** Tekst dla ekranu z etykietami — kolumna boczna edytora pokazuje ikonę **i** etykietę. */
  readonly label: string;
  /** Nazwa dostępna przycisku ikonowego w wierszu listy; zawiera nazwę-hash drużyny. */
  readonly ariaLabel: string;
}

/** Wyruszenie i edycja są nawigacją, więc niosą `href`. */
export interface TeamLinkAction extends TeamActionBase {
  readonly kind: "embark" | "edit";
  readonly href: string;
}

/**
 * Usunięcie **nie** niesie `href`: to POST za oknem potwierdzenia (FR-010), nie nawigacja.
 * Brak tego pola w wariancie czyni „delete jako link" niereprezentowalnym, zamiast pilnować
 * tego konwencją.
 */
export interface TeamDeleteAction extends TeamActionBase {
  readonly kind: "delete";
}

export type TeamAction = TeamLinkAction | TeamDeleteAction;

/**
 * Trzy akcje w kolejności wyświetlania. Krotka, a nie tablica — kolejność wiąże wtedy typ,
 * a konsument może wziąć samo wyruszenie i usunięcie (kolumna boczna edytora) bez szukania
 * po `kind`.
 */
export type TeamActions = readonly [embark: TeamLinkAction, edit: TeamLinkAction, remove: TeamDeleteAction];

/**
 * Identyfikator wchodzi do adresu **zakodowany**: dla poprawnego UUID kodowanie jest
 * identycznością, ale moduł nie zakłada, że dostał UUID — tak samo jak nie zakłada tego
 * `src/pages/api/teams/[id].ts`.
 */
export function teamActions({ id, name }: SavedTeamRef): TeamActions {
  const team = `/teams/${encodeURIComponent(id)}`;

  return [
    {
      kind: "embark",
      href: `${team}/embark`,
      label: "Embark on the job",
      ariaLabel: `Embark on the job with team ${name}`,
    },
    {
      kind: "edit",
      href: team,
      label: "Edit team",
      ariaLabel: `Edit team ${name}`,
    },
    {
      kind: "delete",
      label: "Delete team",
      ariaLabel: `Delete team ${name}`,
    },
  ];
}
