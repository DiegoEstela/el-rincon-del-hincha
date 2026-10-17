"use client";

import { RivalsError } from "@/components/rivals/rivals-states";

/**
 * Catches a render error of the screen. It shows a friendly message and logs nothing: the error
 * may carry values the fan typed or saved, and the start date must never reach a log.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <RivalsError onRetry={reset} />;
}
