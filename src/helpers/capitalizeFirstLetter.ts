// Widened to accept the nullable `string | null` shape every caller's
// generated `name` field actually has (e.g. Worker.name), while preserving
// the original's exact throw-on-null/undefined runtime behavior via the
// non-null assertion below, rather than adding a new fallback.
function capitalizeName(name: string | null | undefined): string {
  return name!
    .toLowerCase()
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export default capitalizeName;
