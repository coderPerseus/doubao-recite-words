import { describe, expect, it } from "vitest";
import { matchAppShortcut, shortcutKeys } from "./shortcuts";

function shortcutEvent(code: string, overrides: Partial<Parameters<typeof matchAppShortcut>[0]> = {}) {
  return {
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    code,
    ...overrides,
  };
}

describe("app shortcuts", () => {
  it("matches pronunciation by physical key code on macOS Option+P", () => {
    expect(matchAppShortcut(shortcutEvent("KeyP"))).toBe("speak");
  });

  it("maps every configurable global shortcut", () => {
    expect(matchAppShortcut(shortcutEvent("Enter"))).toBe("skip");
    expect(matchAppShortcut(shortcutEvent("KeyN"))).toBe("new-session");
    expect(matchAppShortcut(shortcutEvent("KeyL"))).toBe("library");
    expect(matchAppShortcut(shortcutEvent("KeyH"))).toBe("history");
    expect(matchAppShortcut(shortcutEvent("KeyU"))).toBe("import");
    expect(matchAppShortcut(shortcutEvent("KeyB"))).toBe("sidebar");
    expect(matchAppShortcut(shortcutEvent("Comma"))).toBe("settings");
    expect(Object.keys(shortcutKeys)).toHaveLength(8);
  });

  it("does not steal shortcuts with extra modifiers", () => {
    expect(matchAppShortcut(shortcutEvent("KeyP", { altKey: false }))).toBeNull();
    expect(matchAppShortcut(shortcutEvent("KeyP", { metaKey: true }))).toBeNull();
    expect(matchAppShortcut(shortcutEvent("KeyP", { ctrlKey: true }))).toBeNull();
    expect(matchAppShortcut(shortcutEvent("KeyP", { shiftKey: true }))).toBeNull();
  });
});
