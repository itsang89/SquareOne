import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { shakeX, fadeInDown, springs } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';

interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const NeoInput: React.FC<NeoInputProps> = ({
  label,
  error,
  fullWidth = true,
  className = '',
  ...props
}) => {
  const widthClass = fullWidth ? 'w-full' : '';
  const controls = useAnimation();
  const { getVariants, getTransition } = useAnimations();
  const previousError = useRef(error);
  
  // Trigger shake animation when error appears
  useEffect(() => {
    if (error && error !== previousError.current) {
      controls.start('shake');
    }
    previousError.current = error;
  }, [error, controls]);
  
  return (
    <div className={`${widthClass} mb-4`}>
      {label && (
        <label className="block font-black uppercase text-sm mb-1 tracking-wider dark:text-white">
          {label}
        </label>
      )}
      <motion.input
        className={`
          ${widthClass}
          border-2 border-black p-3 
          font-bold placeholder:text-gray-400 dark:placeholder:text-zinc-500
          focus:outline-none focus:ring-0
          ${error ? 'bg-neo-red/10 border-neo-red' : 'bg-white dark:bg-zinc-900 dark:text-zinc-100'}
          ${className}
        `}
        variants={getVariants(shakeX)}
        animate={controls}
        whileFocus={{
          boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
          scale: 1.01,
          transition: getTransition(springs.snappy),
        }}
        {...props}
      />
      {error && (
        <motion.span 
          className="block mt-1 text-neo-red text-xs font-black uppercase tracking-tight"
          variants={getVariants(fadeInDown)}
          initial="hidden"
          animate="visible"
          transition={getTransition(springs.gentle)}
        >
          {error}
        </motion.span>
      )}
    </div>
  );
};

export const NeoTextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string, error?: string }> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  const controls = useAnimation();
  const { getVariants, getTransition } = useAnimations();
  const previousError = useRef(error);
  
  useEffect(() => {
    if (error && error !== previousError.current) {
      controls.start('shake');
    }
    previousError.current = error;
  }, [error, controls]);
  
  return (
    <div className="w-full mb-4">
      {label && (
        <label className="block font-black uppercase text-sm mb-1 tracking-wider dark:text-white">
          {label}
        </label>
      )}
      <motion.textarea
        className={`
          w-full
          border-2 border-black p-3 
          font-bold placeholder:text-gray-400 dark:placeholder:text-zinc-500
          focus:outline-none focus:ring-0 min-h-[100px]
          ${error ? 'bg-neo-red/10 border-neo-red' : 'bg-white dark:bg-zinc-900 dark:text-zinc-100'}
          ${className}
        `}
        variants={getVariants(shakeX)}
        animate={controls}
        whileFocus={{
          boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
          scale: 1.01,
          transition: getTransition(springs.snappy),
        }}
        {...props}
      />
      {error && (
        <motion.span 
          className="block mt-1 text-neo-red text-xs font-black uppercase tracking-tight"
          variants={getVariants(fadeInDown)}
          initial="hidden"
          animate="visible"
          transition={getTransition(springs.gentle)}
        >
          {error}
        </motion.span>
      )}
    </div>
  );
};
