import React from 'react';
import { NeoColorVariant } from '../types/components';
import { LoadingSpinner } from './LoadingSpinner';

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
  const baseStyle = "border-2 border-black font-bold uppercase tracking-wider transition-all active:shadow-neo-pressed active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-neo-green hover:bg-[#aeea00] shadow-neo text-black",
    secondary: "bg-neo-yellow hover:bg-yellow-400 shadow-neo text-black",
    accent: "bg-neo-purple hover:bg-purple-300 shadow-neo text-black",
    neutral: "bg-white hover:bg-gray-50 shadow-neo text-black",
    ghost: "bg-transparent border-none shadow-none hover:bg-black/5"
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${widthClass} py-3 px-6 ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <LoadingSpinner size="sm" /> : children}
    </button>
  );
};
