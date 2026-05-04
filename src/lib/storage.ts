import type { Placement } from "./types";

const KEY_PREFIX = "malla-fisi:v1";

interface SavedState {
  placement: Placement;
  specialtyOverrides: Record<string, string[]>;
}

function key(careerSlug: string): string {
  return `${KEY_PREFIX}:${careerSlug}`;
}

export function loadState(careerSlug: string): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(careerSlug));
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

export function saveState(careerSlug: string, state: SavedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(careerSlug), JSON.stringify(state));
  } catch {}
}

export function clearState(careerSlug: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(careerSlug));
  } catch {}
}
