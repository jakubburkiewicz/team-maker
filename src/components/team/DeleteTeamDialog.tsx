import { useState } from "react";
import { Trash2 } from "lucide-react";

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

interface DeleteTeamDialogProps {
  teamId: string;
  /** Nazwa-hash drużyny (FR-011) — okno nazywa nią drużynę, żeby potwierdzenie dotyczyło konkretu. */
  teamName: string;
}

/**
 * Usunięcie drużyny po potwierdzeniu (FR-010, US-03). Osobna wyspa, żeby `TeamComposer` nic nie
 * wiedział o usuwaniu: kompozytor ma od S-05 jeden tryb, a warunkowy przycisk, którego
 * `/teams/new` nigdy by nie użył, przywróciłby parę przełączników, które muszą się zgadzać.
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
 * Prymityw wchodzi z jasnymi tokenami shadcn (`bg-background`, `bg-destructive`), a `/teams/[id]`
 * jest w całości ręcznym motywem cosmic — stąd nadpisujące `className`, wzorem
 * `MemberPickerDialog.tsx:33`.
 */
export default function DeleteTeamDialog({ teamId, teamName }: DeleteTeamDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          setOpen(true);
        }}
        className="self-end border border-red-400/40 bg-red-500/15 text-red-100 hover:bg-red-500/25"
      >
        <Trash2 className="size-4" />
        Delete team
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-white/10 bg-[#0f1529] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete team <code className="font-mono">{teamName}</code>?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-100/70">
              This cannot be undone. The roster and its perks are erased for good — there is no recycle bin and no way
              to bring the team back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <form method="post" action={`/api/teams/${teamId}/delete`}>
              <Button
                type="submit"
                variant="destructive"
                className="w-full border border-red-400/40 bg-red-500/80 text-white hover:bg-red-500"
              >
                Delete team
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
