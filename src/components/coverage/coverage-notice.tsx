import { Info } from "lucide-react";
import { CUPS_NOT_LOADED, type CoverageCopy } from "@/lib/coverage-copy";

/**
 * What the numbers on screen include and what they do not. The note shows whenever the engine says
 * the coverage is not complete. There is deliberately no "complete" state: while the cups are not
 * loaded (plan 0014, Phase 2) no screen may claim a complete history, so even a complete notice
 * only keeps the two plain lines below.
 */
export function CoverageNotice({
  copy,
  included,
  foldLines,
}: {
  copy: CoverageCopy;
  /** "Contamos: ..." */
  included: string;
  /** Folds the line per competition under a summary (a long note on a phone pushes the content). */
  foldLines?: string;
}) {
  const list = (
    <ul className="text-muted list-disc pl-5">
      {copy.lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
  return (
    <div className="grid gap-2">
      {copy.show ? (
        <div role="note" className="glass flex gap-3 rounded-2xl p-4">
          <Info aria-hidden size={20} className="text-gold mt-0.5 shrink-0" />
          <div className="grid gap-1 text-sm">
            <p className="font-medium">{copy.heading}</p>
            <p className="text-muted">{copy.lead}</p>
            {copy.lines.length === 0 ? null : foldLines === undefined ? (
              list
            ) : (
              <details>
                <summary className="text-accent focus-visible:outline-accent min-h-11 cursor-pointer py-2 underline focus-visible:outline-2">
                  {foldLines}
                </summary>
                {list}
              </details>
            )}
          </div>
        </div>
      ) : null}
      <p className="text-muted text-sm">{included}</p>
      <p className="text-muted text-sm">{CUPS_NOT_LOADED}</p>
    </div>
  );
}
