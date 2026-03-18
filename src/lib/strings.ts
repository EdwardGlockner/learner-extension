export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function titleFromLines(input: string): string[] {
  return input
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function sentenceCase(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}
