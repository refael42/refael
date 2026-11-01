import type { UiIconSheet } from '../render/sprites';

let sheet: UiIconSheet | null = null;

export function setIconSheet(s: UiIconSheet): void {
  sheet = s;
}

export function getIconSheet(): UiIconSheet | null {
  return sheet;
}
