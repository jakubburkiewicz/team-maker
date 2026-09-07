import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SavedTeamRef } from "@/lib/team-actions";

interface DeleteTeamDialogProps {
  /**
   * Drużyna, której dotyczy potwierdzenie — **jeden obiekt**, nie dwa pola, żeby „id bez nazwy"
   * i „nazwa bez id" pozostały niereprezentowalne (ta sama logika co `teamId`
   * w `CompositionGate.tsx`). `null` znaczy „nie ma czego potwierdzać": okno nie renderuje wtedy
   * treści i nie może się otworzyć, choćby `open` mówiło inaczej.
   */
  target: SavedTeamRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Usunięcie drużyny po potwierdzeniu (FR-010, US-03). Komponent jest **sterowany**: cel i widoczność
 * przychodzą od rodzica, a własnego przycisku otwierającego nie renderuje. Rozdzielenie „co
 * potwierdzamy" od „skąd otwarto" jest tym, co pozwala liście na `/` postawić **jedno** okno nad
 * N wierszami — dopóki komponent trzymał `open` sam, jedynym sposobem na wiele wyzwalaczy było
 * wiele okien. Wyzwalacze mają dziś dwóch właścicieli: `TeamActions` (kolumna boczna edytora)
 * i `DeleteTeamButton` (gałąź awarii `/teams/[id]`).
 *
 * `submitting` zostaje **w środku**: to własność wysyłki, nie rodzica. Jak `CompositionGate`: po
 * pierwszym kliknięciu oba przyciski gasną, bo drugi POST na już skasowany wiersz dostałby `null`
 * z repo i odesłał na goły 404 zamiast na baner „Team deleted.". Nie `useFormStatus` — przy
 * `action` będącym stringiem React trzyma `pending === false` na stałe.
 *
 * `submitting` **musi** wracać do `false` przy zamknięciu okna, bo szczęśliwa ścieżka
 * (POST → 302 → pełne przeładowanie) nie jest jedyna. Ten komponent jest zamontowany na stałe,
 * a na `/` **jedna** instancja obsługuje N wierszy, więc stan przeżywa zamknięcie okna i wędruje
 * do następnego celu. Escape wciśnięty w trakcie wysyłki zatrzymuje nawigację POST i zamyka okno
 * (Radix nie blokuje Escape sam) — bez resetu zostawiłoby to okno, w którym potwierdzenie **i**
 * `Cancel` są zgaszone, a usuwanie **każdej** drużyny na liście przestaje działać bez widocznego
 * powodu. Reset wisi na zamknięciu, nie na zmianie celu: `target` bywa ten sam przy ponownym
 * otwarciu (`TeamActions`, `DeleteTeamButton` trzymają jedną drużynę), więc `key` na celu tej
 * ścieżki by nie pokrył. Blokowania Escape tu **nie ma** świadomie — zgaszony przycisk przy
 * nieaktualnym `submitting` (np. po powrocie z bfcache) zamieniłby okno w pułapkę bez wyjścia.
 *
 * Okno stoi na prymitywie `alert-dialog`, nie na `dialog.tsx`: `role="alertdialog"` i brak
 * zamykania kliknięciem w tło są dla operacji nieodwracalnej właściwością, nie ozdobą — skoro
 * Non-Goal PRD wyklucza kosz i przywracanie, to okno jest **jedyną** ochroną.
 *
 * Potwierdzenie jest zwykłym submitem, a nie prymitywem akcji z `alert-dialog.tsx`: tamten jest
 * zbudowany na `DialogPrimitive.Close`, którego bezwarunkowe `onOpenChange(false)` zamknęłoby okno
 * w tym samym zdarzeniu, w którym przeglądarka miałaby wystartować wysyłkę. Odłączony przycisk nie
 * ma właściciela formularza i POST nie wychodzi — bez błędu. Okno zamyka nawigacja po 302.
 *
 * Formularz żyje **wewnątrz** treści okna, bo Radix portuje ją do `document.body`: owinięty wokół
 * `<AlertDialog>` nie objąłby przycisku w DOM, a awaria byłaby tej samej, cichej klasy.
 *
 * Prymityw wchodzi z jasnymi tokenami shadcn (`bg-background`, `bg-destructive`), a oba ekrany,
 * które go renderują, są w całości ręcznym motywem cosmic — stąd nadpisujące `className`, wzorem
 * `MemberPickerDialog.tsx:33`.
 */
export default function DeleteTeamDialog({ target, open, onOpenChange }: DeleteTeamDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <AlertDialog
      open={open && target !== null}
      onOpenChange={(next) => {
        if (!next) {
          setSubmitting(false);
        }
        onOpenChange(next);
      }}
    >
      {target !== null && (
        <AlertDialogContent className="border-white/10 bg-[#0f1529] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete team <code className="font-mono">{target.name}</code>?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-100/70">
              This cannot be undone. The roster and its perks are erased for good — there is no recycle bin and no way
              to bring the team back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={submitting}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              Cancel
            </AlertDialogCancel>
            <form
              method="post"
              action={`/api/teams/${encodeURIComponent(target.id)}/delete`}
              onSubmit={() => {
                setSubmitting(true);
              }}
            >
              <Button
                type="submit"
                variant="destructive"
                disabled={submitting}
                className="w-full border border-red-400/40 bg-red-500/80 text-white hover:bg-red-500"
              >
                {submitting ? "Deleting…" : "Delete team"}
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
