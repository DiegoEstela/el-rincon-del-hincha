"use client";

import { Info, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { nextFocusIndex } from "@/lib/focus-trap";
import { INFO_ITEMS, isActiveRoute } from "@/lib/nav";

/** Mobile-only info button that opens a native modal <dialog> with Acerca and Privacidad. */
export function InfoMenu() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The header is hidden from 1024px up: never leave a modal open behind it.
  useEffect(() => {
    const query = window.matchMedia?.("(min-width: 1024px)");
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) dialogRef.current?.close();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  function openSheet() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  function closeSheet() {
    dialogRef.current?.close();
  }

  function trapTab(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
    );
    const index = nextFocusIndex(
      focusables.indexOf(document.activeElement as HTMLElement),
      focusables.length,
      event.shiftKey,
    );
    if (index < 0) return;
    event.preventDefault();
    focusables[index].focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Más información"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="info-sheet"
        onClick={openSheet}
        className="border-line-strong text-muted hover:text-foreground flex size-11 items-center justify-center rounded-full border motion-safe:transition-colors"
      >
        <Info aria-hidden size={20} />
      </button>

      <dialog
        id="info-sheet"
        ref={dialogRef}
        aria-labelledby="info-sheet-title"
        onKeyDown={trapTab}
        onClose={() => {
          setOpen(false);
          buttonRef.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSheet();
        }}
        className="info-sheet bg-raised border-line-strong text-foreground fixed inset-x-3 top-auto bottom-3 m-0 mx-auto w-auto max-w-md rounded-2xl border p-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="info-sheet-title" className="font-display text-2xl">
            Más info
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={closeSheet}
            className="text-muted hover:text-foreground flex size-11 items-center justify-center rounded-full"
          >
            <X aria-hidden size={20} />
          </button>
        </div>
        <nav aria-label="Información">
          <ul>
            {INFO_ITEMS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={closeSheet}
                  aria-current={isActiveRoute(pathname, href) ? "page" : undefined}
                  className="flex min-h-11 items-center text-lg"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}
