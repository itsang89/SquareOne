import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import { useAnimations } from '../hooks/useAnimations';
import { springs } from '../utils/animations';

interface DeleteConfirmButtonProps {
  /** Fired once when the user confirms (second click). */
  onConfirm: () => void;
  /** Auto-disarm timeout in ms. Default 3000. */
  timeoutMs?: number;
  /** Compact (icon-sized chip) vs expanded (matches button row). Default 'compact'. */
  size?: 'compact' | 'expanded';
  /** Optional icon size override; defaults to 14 (compact) or 16 (expanded). */
  iconSize?: number;
  /** Accessible label for the trash button. */
  ariaLabel?: string;
  /** Optional callback fired whenever the button transitions armed ↔ idle. */
  onArmedChange?: (armed: boolean) => void;
}

/**
 * Two-step delete with a depleting-bar countdown.
 *
 * Idle:        white chip with trash icon.
 * Armed:       red chip labeled "Confirm Delete" with a thin white time bar shrinking left → right.
 * On confirm:  the bar is full-width white; we expand to a hit-target that simply calls onConfirm and stays armed
 *              until the parent removes the row (handled outside this component).
 *
 * Click while armed = confirm. Click while armed again before timeout = also confirm (idempotent — used as backup).
 */
export const DeleteConfirmButton: React.FC<DeleteConfirmButtonProps> = ({
  onConfirm,
  timeoutMs = 3000,
  size = 'compact',
  iconSize,
  ariaLabel = 'Delete',
  onArmedChange,
}) => {
  const { getTransition } = useAnimations();
  const [armed, setArmed] = useState(false);
  const [progress, setProgress] = useState(0); // 0 → 1 over timeoutMs
  const timeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const onArmedChangeRef = useRef(onArmedChange);
  onArmedChangeRef.current = onArmedChange;

  const cancelTimers = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const setArmedAndNotify = (next: boolean) => {
    setArmed(next);
    onArmedChangeRef.current?.(next);
  };

  useEffect(() => () => {
    cancelTimers();
    if (armed) onArmedChangeRef.current?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disarm = () => {
    cancelTimers();
    setProgress(0);
    setArmedAndNotify(false);
  };

  const arm = () => {
    setArmedAndNotify(true);
    setProgress(0);
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / timeoutMs, 1);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        disarm();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleClick = () => {
    if (armed) {
      cancelTimers();
      onConfirm();
    } else {
      arm();
    }
  };

  const sizing =
    size === 'compact'
      ? 'px-2 py-1.5 text-[10px] gap-1.5'
      : 'px-3 py-2 text-xs gap-2';
  const ic = iconSize ?? (size === 'compact' ? 14 : 16);

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-label={armed ? 'Confirm delete' : ariaLabel}
      aria-pressed={armed}
      className={`relative overflow-hidden rounded-md border-2 border-black font-bold uppercase tracking-wide whitespace-nowrap inline-flex items-center justify-center transition-colors ${sizing} ${
        armed
          ? 'bg-neo-red text-white shadow-neo-sm'
          : 'bg-white dark:bg-zinc-800 text-black dark:text-zinc-100 hover:bg-neo-red/20'
      }`}
      whileHover={armed ? {} : { scale: 1.05 }}
      whileTap={{ scale: 0.94, x: 1, y: 1 }}
      transition={getTransition(springs.snappy)}
    >
      {/* Depleting timer bar — only visible while armed. Right → left (visual stack look). */}
      {armed && (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 right-0 bg-white/30"
          initial={false}
          animate={{ width: `${(1 - progress) * 100}%` }}
          transition={{ duration: 0, ease: 'linear' }}
        />
      )}

      <span className="relative inline-flex items-center justify-center gap-1.5">
        {armed ? (
          <>
            <X size={ic} strokeWidth={2.5} />
            <span>Confirm Delete</span>
          </>
        ) : (
          <Trash2 size={ic} strokeWidth={2} />
        )}
      </span>
    </motion.button>
  );
};
