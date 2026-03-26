import React, { useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { modalBackdrop, modalContent } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';

// Selectors for all elements that can receive keyboard focus.
const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface NeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const NeoModal: React.FC<NeoModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => {
  const { getVariants } = useAnimations();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Stable unique ID used to link the dialog to its title via aria-labelledby.
  const titleId = useId();
  // Track the element that had focus before the modal opened so we can restore it.
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save the currently focused element so focus can be restored on close.
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Move focus into the dialog.
    const dialog = dialogRef.current;
    if (dialog) {
      const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE);
      firstFocusable?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes the dialog.
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Tab traps focus inside the dialog.
      if (e.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if we're at the first element, wrap to the last.
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if we're at the last element, wrap to the first.
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the element that triggered the modal.
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          {/* Backdrop — hidden from assistive technology */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            variants={getVariants(modalBackdrop)}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 border-4 border-black shadow-neo"
            variants={getVariants(modalContent)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-4 border-black bg-neo-yellow dark:text-black">
              <h3 id={titleId} className="font-black uppercase text-xl tracking-tighter">
                {title}
              </h3>
              <motion.button
                onClick={onClose}
                aria-label="Close dialog"
                className="p-1 border-2 border-transparent"
                whileHover={{
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  borderColor: '#000',
                }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={24} aria-hidden="true" />
              </motion.button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh] dark:text-zinc-100">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-4 border-t-4 border-black bg-gray-50 dark:bg-zinc-800 flex justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
