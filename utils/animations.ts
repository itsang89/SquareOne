import { Variants, Transition } from 'framer-motion';

// Spring configurations
export const springs = {
  bouncy: {
    type: 'spring' as const,
    bounce: 0.5,
    duration: 0.6,
  },
  gentle: {
    type: 'spring' as const,
    bounce: 0.2,
    duration: 0.4,
  },
  elastic: {
    type: 'spring' as const,
    bounce: 0.6,
    duration: 0.8,
  },
  snappy: {
    type: 'spring' as const,
    bounce: 0.3,
    duration: 0.3,
  },
} satisfies Record<string, Transition>;

// Fade animations
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// Slide animations
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0 },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0 },
};

// Scale animations
export const bounceIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: springs.bouncy,
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const elasticBounce: Variants = {
  hidden: { scale: 0 },
  visible: { 
    scale: 1,
    transition: springs.elastic,
  },
};

// Button press effect
export const pressEffect = {
  scale: 0.95,
  transition: springs.snappy,
};

// Shake animation (for errors)
export const shakeX: Variants = {
  shake: {
    x: [-10, 10, -10, 10, -5, 5, 0],
    transition: {
      type: 'keyframes',
      duration: 0.5,
    },
  },
};

// Stagger children animation
export const staggerChildren = (delayChildren = 0, staggerChildren = 0.05): Variants => ({
  visible: {
    transition: {
      delayChildren,
      staggerChildren,
    },
  },
});

// Container for staggered items
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// Individual staggered item
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: springs.bouncy,
  },
};

// Modal animations
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: springs.bouncy,
  },
  exit: { 
    opacity: 0, 
    scale: 0.8, 
    y: 20,
    transition: { duration: 0.2 },
  },
};

// Number counting animation
export const numberChange: Variants = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

// Success celebration
export const successScale: Variants = {
  hidden: { scale: 0 },
  visible: { 
    scale: [0, 1.2, 1],
    transition: {
      type: 'keyframes',
      duration: 0.5,
      times: [0, 0.6, 1],
    },
  },
};

// Rotate animation
export const rotate180: Variants = {
  initial: { rotate: 0 },
  animate: { rotate: 180, transition: springs.bouncy },
};

// Pulse animation
export const pulse: Variants = {
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      type: 'tween',
      ease: 'easeInOut',
      duration: 0.6,
      repeat: Infinity,
      repeatType: 'reverse' as const,
    },
  },
};

// Theme icon animations
export const moonRotate: Variants = {
  active: { 
    rotate: [0, -10, 10, -5, 5, 0],
    transition: {
      type: 'keyframes',
      duration: 0.6,
      ease: 'easeInOut',
    },
  },
  inactive: { rotate: 0 },
};

export const sunRotateScale: Variants = {
  active: { 
    rotate: [0, 90],
    scale: [1, 1.2, 1],
    transition: {
      type: 'keyframes',
      duration: 0.6,
      times: [0, 0.5, 1],
      ease: 'easeInOut',
    },
  },
  inactive: { rotate: 0, scale: 1 },
};

export const monitorPulse: Variants = {
  active: { 
    scale: [1, 1.1, 1],
    transition: {
      type: 'keyframes',
      duration: 0.6,
      ease: 'easeInOut',
    },
  },
  inactive: { scale: 1 },
};

// Loading spinner
export const spinner = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear' as const,
    },
  },
};

// Hover and tap animations
export const hoverScale = {
  scale: 1.02,
  transition: springs.snappy,
};

export const tapScale = {
  scale: 0.98,
  transition: springs.snappy,
};

// Height animation for expanding sections
export const expandCollapse: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { 
    height: 'auto', 
    opacity: 1,
    transition: springs.gentle,
  },
};
