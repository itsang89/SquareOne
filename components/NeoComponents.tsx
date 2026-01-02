import React from 'react';
import { useNavigate } from 'react-router-dom';

interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'ghost';
  fullWidth?: boolean;
}

export const NeoButton: React.FC<NeoButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  fullWidth = false,
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
      {...props}
    >
      {children}
    </button>
  );
};

export const NeoCard: React.FC<{ children: React.ReactNode; className?: string; color?: string }> = ({ 
  children, 
  className = '',
  color = 'bg-white' 
}) => {
  return (
    <div className={`border-2 border-black shadow-neo p-4 ${color} ${className}`}>
      {children}
    </div>
  );
};

export const BackButton: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => navigate(-1)}
      className="w-10 h-10 bg-white border-2 border-black shadow-neo-sm flex items-center justify-center hover:bg-gray-100 active:shadow-neo-pressed active:translate-x-[1px] active:translate-y-[1px] transition-all"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
  );
};

export const Avatar: React.FC<{ src: string; alt: string; size?: 'sm' | 'md' | 'lg' | 'xl', className?: string }> = ({ src, alt, size = 'md', className='' }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  return (
    <div className={`relative ${sizes[size]} rounded-full border-2 border-black overflow-hidden bg-gray-200 ${className}`}>
      <img src={src} alt={alt} className="w-full h-full object-cover" />
    </div>
  );
};