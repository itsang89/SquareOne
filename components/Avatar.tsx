import React, { useState } from 'react';
import { AvatarSize } from '../types/components';

interface AvatarProps {
  src: string;
  alt: string;
  size?: AvatarSize;
  className?: string;
}

const SIZES: Record<AvatarSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`relative ${SIZES[size]} rounded-full border-2 border-black overflow-hidden bg-gray-200 dark:bg-zinc-800 ${className}`}
    >
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
