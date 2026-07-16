// Pure, side-effect-free helpers shared by Avatar.tsx (rendering) and
// useCurrentIdentity.ts (computing the identity fields it exposes) -- kept
// dependency-free so both can import them without a UI component depending
// on a feature hook or vice versa.

const LETTER_REGEX = /\p{L}/u;

function firstLetterOf(word: string): string {
  for (const char of word) {
    if (LETTER_REGEX.test(char)) return char.toLocaleUpperCase();
  }
  return "";
}

// Unicode-safe, bounded to 1-2 characters: a single-word name yields one
// initial; a multi-word name yields the first letter of the first word and
// the first letter of the last word. Safe for empty/malformed input (never
// throws, returns "").
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "";
  if (words.length === 1) return firstLetterOf(words[0]);

  return `${firstLetterOf(words[0])}${firstLetterOf(words[words.length - 1])}`;
}

// Extracts the email local part and normalizes common separators to spaces
// BEFORE any initials computation ever sees it, so the domain can never
// leak into initials -- it's discarded here, at extraction time.
export function nameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  return localPart.replace(/[._+-]+/g, " ").trim();
}

export type AvatarDisplayMode = "image" | "initials" | "icon";

export interface AvatarDisplayInput {
  src: string | null;
  hasImageError: boolean;
  name: string;
}

export interface AvatarDisplayResult {
  mode: AvatarDisplayMode;
  initials: string;
}

// Fallback order: (1) a successfully loaded image, (2) initials, (3) a
// generic icon. Never resolves to "show a broken image."
export function resolveAvatarDisplay(
  input: AvatarDisplayInput
): AvatarDisplayResult {
  const initials = getInitials(input.name);

  if (input.src && !input.hasImageError) {
    return { mode: "image", initials };
  }

  if (initials) {
    return { mode: "initials", initials };
  }

  return { mode: "icon", initials: "" };
}
