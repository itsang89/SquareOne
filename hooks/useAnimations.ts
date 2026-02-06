import { useEffect, useState } from 'react';
import { Transition, Variants } from 'framer-motion';

/**
 * Hook to detect if user prefers reduced motion
 * Returns true if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
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
