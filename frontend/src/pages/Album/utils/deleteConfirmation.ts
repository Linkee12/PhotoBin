/** What must be typed to delete an album whose title is empty. */
export const DELETE_FALLBACK_PHRASE = "I want to delete this album";

/** The album title, or the fallback phrase when there is none. */
export function requiredPhrase(title: string): string {
  return title.trim() || DELETE_FALLBACK_PHRASE;
}

/** True when `input` (trimmed) is exactly the required phrase; case matters. */
export function confirmsDeletion(input: string, title: string): boolean {
  return input.trim() === requiredPhrase(title);
}
