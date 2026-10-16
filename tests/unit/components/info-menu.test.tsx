// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfoMenu } from "@/components/layout/info-menu";

vi.mock("next/navigation", () => ({ usePathname: () => "/acerca" }));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});
afterEach(cleanup);

const button = () => screen.getByRole("button", { name: "Más información" });

describe("InfoMenu", () => {
  it("exposes the button state", () => {
    render(<InfoMenu />);
    expect(button()).toHaveAttribute("aria-expanded", "false");
    expect(button()).toHaveAttribute("aria-controls", "info-sheet");
    expect(button()).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("opens the dialog on click", () => {
    render(<InfoMenu />);
    fireEvent.click(button());
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(button()).toHaveAttribute("aria-expanded", "true");
  });

  it("returns focus to the button when the dialog closes", () => {
    render(<InfoMenu />);
    fireEvent.click(button());
    fireEvent(document.getElementById("info-sheet")!, new Event("close"));
    expect(button()).toHaveAttribute("aria-expanded", "false");
    expect(button()).toHaveFocus();
  });

  it("lists Acerca and Privacidad, marking the current one", () => {
    render(<InfoMenu />);
    const acerca = screen.getByRole("link", { name: "Acerca", hidden: true });
    expect(acerca).toHaveAttribute("href", "/acerca");
    expect(acerca).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Privacidad", hidden: true })).toHaveAttribute(
      "href",
      "/privacidad",
    );
  });

  it("closes the dialog when a link is clicked", () => {
    render(<InfoMenu />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole("link", { name: "Privacidad", hidden: true }));
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("closes from the Cerrar button", () => {
    render(<InfoMenu />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole("button", { name: "Cerrar", hidden: true }));
    expect(button()).toHaveAttribute("aria-expanded", "false");
  });
});
