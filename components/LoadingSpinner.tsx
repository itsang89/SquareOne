import React from 'react';
import { motion } from 'framer-motion';
import { spinner } from '../utils/animations';

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg', className?: string }> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-[3px]',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <motion.div 
        className={`${sizes[size]} border-black border-t-transparent rounded-none bg-neo-yellow shadow-neo-sm`}
        animate={spinner.animate}
      />
    </div>
  );
};

export const FullPageLoading: React.FC = () => (
  <motion.div 
    className="fixed inset-0 bg-neo-bg flex flex-col items-center justify-center gap-4 z-[100]"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <LoadingSpinner size="lg" />
    <motion.span 
      className="font-bold uppercase tracking-widest text-xl"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      Loading...
    </motion.span>
  </motion.div>
);
