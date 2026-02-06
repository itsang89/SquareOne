import React from 'react';
import { motion } from 'framer-motion';
import { NeoColorVariant } from '../types/components';
import { LoadingSpinner } from './LoadingSpinner';
import { springs } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';

interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeoColorVariant;
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const NeoButton: React.FC<NeoButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  fullWidth = false,
  isLoading = false,
  disabled,
  ...props 
}) => {
  const { getTransition } = useAnimations();
  
  const baseStyle = "border-2 border-black font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-neo-green hover:bg-[#aeea00] shadow-neo text-black",
    secondary: "bg-neo-yellow hover:bg-yellow-400 shadow-neo text-black",
    accent: "bg-neo-purple hover:bg-purple-300 shadow-neo text-black",
    neutral: "bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 shadow-neo text-black dark:text-zinc-100",
    ghost: "bg-transparent border-none shadow-none hover:bg-black/5 dark:hover:bg-white/5 dark:text-zinc-100"
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <motion.button 
      className={`${baseStyle} ${variants[variant]} ${widthClass} py-3 px-6 ${className}`}
      disabled={disabled || isLoading}
      whileHover={disabled || isLoading ? {} : { 
        scale: 1.02,
        transition: getTransition(springs.snappy),
      }}
      whileTap={disabled || isLoading ? {} : { 
        scale: 0.98,
        x: 2,
        y: 2,
        boxShadow: '2px 2px 0px 0px rgba(0,0,0,1)',
        transition: getTransition(springs.snappy),
      }}
      {...props}
    >
      {isLoading ? <LoadingSpinner size="sm" /> : children}
    </motion.button>
  );
};
