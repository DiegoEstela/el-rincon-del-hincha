import { NavLinks } from "./nav-links";

/** Mobile navigation: a solid floating bar (no transparency). Hidden from 1024px up. */
export function BottomNav() {
  return (
    <div
      data-testid="bottom-nav"
      className="bg-raised border-line-strong fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border shadow-[0_12px_32px_-8px_rgb(0_0_0/0.7)] lg:hidden"
    >
      <NavLinks variant="bottom" />
    </div>
  );
}
