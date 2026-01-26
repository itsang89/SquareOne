import React from 'react';

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
      <div className={`${sizes[size]} border-black border-t-transparent rounded-none animate-spin bg-neo-yellow shadow-neo-sm`}></div>
    </div>
  );
};

export const FullPageLoading: React.FC = () => (
  <div className="fixed inset-0 bg-neo-bg flex flex-col items-center justify-center gap-4 z-[100]">
    <LoadingSpinner size="lg" />
    <span className="font-bold uppercase tracking-widest text-xl">Loading...</span>
  </div>
);
