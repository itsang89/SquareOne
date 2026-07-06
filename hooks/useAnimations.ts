import { useSyncExternalStore } from 'react';
import { Transition, Variants } from 'framer-motion';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Hook to detect if user prefers reduced motion
 * Returns true if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, readReducedMotion, () => false);
}

/**
 * Hook that returns animation variants or instant transitions based on reduced motion preference
 */
export function useAnimations() {
  const prefersReducedMotion = useReducedMotion();

  // Instant transition for reduced motion
  const instantTransition: Transition = {
    duration: 0,
  };

  // Helper to modify variants for reduced motion
  const getVariants = (variants: Variants): Variants => {
    if (!prefersReducedMotion) return variants;

    // Convert all animations to instant transitions
    const reducedVariants: Variants = {};
    Object.keys(variants).forEach((key) => {
      const value = variants[key];
      if (typeof value === 'object') {
        reducedVariants[key] = {
          ...value,
          transition: instantTransition,
        };
      } else {
        reducedVariants[key] = value;
      }
    });
    return reducedVariants;
  };

  // Helper to get transition with reduced motion support
  const getTransition = (transition?: Transition): Transition => {
    return prefersReducedMotion ? instantTransition : (transition || {});
  };

  return {
    prefersReducedMotion,
    getVariants,
    getTransition,
    instantTransition,
  };
}
