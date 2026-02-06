import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useAnimations';

interface UseNumberCounterOptions {
  duration?: number; // Duration in ms
  easing?: (t: number) => number; // Easing function
}

/**
 * Hook to animate number changes from one value to another
 */
export function useNumberCounter(
  targetValue: number,
  options: UseNumberCounterOptions = {}
) {
  const { duration = 800, easing = easeOutCubic } = options;
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(targetValue);
  const animationRef = useRef<number>();
  const previousValueRef = useRef(targetValue);

  useEffect(() => {
    // If reduced motion, update instantly
    if (prefersReducedMotion) {
      setDisplayValue(targetValue);
      previousValueRef.current = targetValue;
      return;
    }

    // If value hasn't changed, don't animate
    if (previousValueRef.current === targetValue) {
      return;
    }

    const startValue = previousValueRef.current;
    const change = targetValue - startValue;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      
      const currentValue = startValue + change * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValueRef.current = targetValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, easing, prefersReducedMotion]);

  return displayValue;
}

// Easing functions
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuad(t: number): number {
  return t * (2 - t);
}
