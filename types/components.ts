import { LucideIcon } from 'lucide-react';

export type NeoColorVariant = 'primary' | 'secondary' | 'accent' | 'neutral' | 'ghost';
export type IconComponent = LucideIcon;
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface BaseNeoProps {
  className?: string;
  children?: React.ReactNode;
}
