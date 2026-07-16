import { describe, expect, test } from "bun:test";
import { getInitials, nameFromEmail, resolveAvatarDisplay } from "./avatarIdentity";

describe("getInitials (Unicode-safe, bounded, malformed-input-safe)", () => {
  test("a multi-word name uses the first letter of the first and last words", () => {
    expect(getInitials("Ana María Pérez")).toBe("AP");
  });

  test("a two-word name uses both initials", () => {
    expect(getInitials("Juan Torres")).toBe("JT");
  });

  test("a one-word name uses a single initial", () => {
    expect(getInitials("Cher")).toBe("C");
  });

  test("accented Unicode letters are preserved and uppercased", () => {
    expect(getInitials("Ángel Muñoz")).toBe("ÁM");
  });

  test("an empty name returns an empty string without throwing", () => {
    expect(getInitials("")).toBe("");
  });

  test("a whitespace-only name returns an empty string", () => {
    expect(getInitials("   ")).toBe("");
  });

  test("a name with no usable letters (only punctuation/digits) returns an empty string", () => {
    expect(getInitials("123 !!!")).toBe("");
  });

  test("leading punctuation on a word does not produce a blank initial", () => {
    expect(getInitials("(Beto) Ramírez")).toBe("BR");
  });
});

describe("nameFromEmail (local-part extraction before initials)", () => {
  test("strips the domain and keeps only the local part", () => {
    expect(nameFromEmail("ana.perez@example.com")).toBe("ana perez");
  });

  test("normalizes dot/underscore/plus/hyphen separators to spaces", () => {
    expect(nameFromEmail("juan_torres+work-account@example.com")).toBe(
      "juan torres work account"
    );
  });

  test("a malformed email with no @ still returns a safe string, no domain leakage", () => {
    expect(nameFromEmail("notanemail")).toBe("notanemail");
  });

  test("initials computed from an email fallback never contain the domain", () => {
    const fallbackName = nameFromEmail("maria.lopez@enub-example.org");
    const initials = getInitials(fallbackName);
    expect(initials).toBe("ML");
    expect(fallbackName).not.toContain("enub");
    expect(fallbackName).not.toContain("org");
  });
});

describe("resolveAvatarDisplay (image -> initials -> icon fallback order)", () => {
  test("a valid, non-errored src resolves to image mode", () => {
    const result = resolveAvatarDisplay({
      src: "https://example.com/pic.jpg",
      hasImageError: false,
      name: "Ana Pérez",
    });
    expect(result.mode).toBe("image");
  });

  test("an errored image falls back to initials mode", () => {
    const result = resolveAvatarDisplay({
      src: "https://example.com/broken.jpg",
      hasImageError: true,
      name: "Ana Pérez",
    });
    expect(result.mode).toBe("initials");
    expect(result.initials).toBe("AP");
  });

  test("no src falls back to initials mode when a usable name exists", () => {
    const result = resolveAvatarDisplay({
      src: null,
      hasImageError: false,
      name: "Cher",
    });
    expect(result.mode).toBe("initials");
    expect(result.initials).toBe("C");
  });

  test("no src and no usable name falls back to the generic icon", () => {
    const result = resolveAvatarDisplay({
      src: null,
      hasImageError: false,
      name: "",
    });
    expect(result.mode).toBe("icon");
    expect(result.initials).toBe("");
  });

  test("an errored image with no usable name falls back to the generic icon, never a broken image", () => {
    const result = resolveAvatarDisplay({
      src: "https://example.com/broken.jpg",
      hasImageError: true,
      name: "   ",
    });
    expect(result.mode).toBe("icon");
  });
});
