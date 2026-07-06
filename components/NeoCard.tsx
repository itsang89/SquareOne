import React from 'react';
import { BaseNeoProps } from '../types/components';

interface NeoCardProps extends BaseNeoProps {
  color?: string;
}

export const NeoCard: React.FC<NeoCardProps> = ({
  children,
  className = '',
  color = 'bg-white dark:bg-zinc-900',
}) => (
  <div className={`border-2 border-black shadow-neo p-4 ${color} ${className}`}>
    {children}
  </div>
);
