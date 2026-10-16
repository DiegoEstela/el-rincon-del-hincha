import { NavLinks } from "./nav-links";

/** Mobile navigation. Removed from the render tree (display: none) from 1024px up. */
export function BottomNav() {
  return (
    <div
      data-testid="bottom-nav"
      className="glass fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl lg:hidden"
    >
      <NavLinks variant="bottom" />
    </div>
  );
}
