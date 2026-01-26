import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NeoColorVariant, AvatarSize, BaseNeoProps } from '../types/components';
import { LoadingSpinner } from './LoadingSpinner';

export { NeoButton } from './NeoButton';

export const NeoCard: React.FC<BaseNeoProps & { color?: string }> = ({ 
  children, 
  className = '',
  color = 'bg-white dark:bg-zinc-900' 
}) => {
  return (
    <div className={`border-2 border-black shadow-neo p-4 ${color} ${className}`}>
      {children}
    </div>
  );
};

export const BackButton: React.FC<{ to?: string }> = ({ to }) => {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => to ? navigate(to) : navigate(-1)}
      className="w-10 h-10 bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 active:shadow-neo-pressed active:translate-x-[1px] active:translate-y-[1px] transition-all"
      aria-label="Go back"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
  );
};

export const Avatar: React.FC<{ src: string; alt: string; size?: AvatarSize, className?: string }> = ({ 
  src, 
  alt, 
  size = 'md', 
  className='' 
}) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const [hasError, setHasError] = React.useState(false);

  return (
    <div className={`relative ${sizes[size]} rounded-full border-2 border-black overflow-hidden bg-gray-200 dark:bg-zinc-800 ${className}`}>
      {hasError ? (
        <div className="w-full h-full flex items-center justify-center bg-neo-blue dark:bg-neo-blue font-bold text-xs dark:text-black">
          {alt.charAt(0).toUpperCase()}
        </div>
      ) : (
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full object-cover" 
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
};

export { NeoInput } from './NeoInput';
export { NeoModal } from './NeoModal';
