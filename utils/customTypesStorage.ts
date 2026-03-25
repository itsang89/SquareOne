/** Guest-only persistence for custom transaction type labels */
export const CUSTOM_TYPES_STORAGE_KEY = 'squareone_custom_types';

export function readCustomTypesFromLocal(): string[] {
  try {
    const stored = localStorage.getItem(CUSTOM_TYPES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCustomTypesToLocal(types: string[]): void {
  localStorage.setItem(CUSTOM_TYPES_STORAGE_KEY, JSON.stringify(types));
}
