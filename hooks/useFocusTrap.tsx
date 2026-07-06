import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface UseFocusTrapOptions {
  /** When to focus the first focusable element on open.
   *  'immediate' (default) focuses inside the same effect tick — matches behavior
   *  of dialogs that mount synchronously (e.g. NeoModal).
   *  'raf' defers focus to the next animation frame — useful when the dialog
   *  enters via AnimatePresence and its focusable children settle a frame later
   *  (e.g. GlobalSearch).
   */
  initialFocusDelay?: 'immediate' | 'raf';
}

/**
 * Trap keyboard focus inside `dialogRef` while `open` is true.
 * - Focuses the first focusable element on open (per `initialFocusDelay`).
 * - Wraps Tab / Shift+Tab around the first/last focusables.
 * - Closes on Escape.
 * - Restores focus to whatever had it before opening on close.
 */
export function useFocusTrap(
  dialogRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  { initialFocusDelay = 'immediate' }: UseFocusTrapOptions = {},
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    if (dialog) {
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
      if (initialFocusDelay === 'raf') {
        requestAnimationFrame(() => first?.focus());
      } else {
        first?.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose, dialogRef, initialFocusDelay]);
}
