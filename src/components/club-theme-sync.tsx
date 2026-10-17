"use client";

import { useLayoutEffect } from "react";
import { applyClubTheme, savedClubId } from "@/lib/club-theme-dom";
import { getBrowserStorage, readFanChoiceRaw } from "@/lib/fan-storage";

/**
 * Re-applies the saved club's `data-club` after hydration. The boot script already did it before
 * the first paint; this covers the dev Strict Mode remount. A no-op in production.
 */
export function ClubThemeSync() {
  useLayoutEffect(() => {
    const clubId = savedClubId(readFanChoiceRaw(getBrowserStorage()));
    if (clubId !== null) applyClubTheme(document.documentElement, clubId);
  }, []);
  return null;
}
