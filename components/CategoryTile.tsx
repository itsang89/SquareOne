import React from 'react';
import { ArrowLeftRight, HandCoins, Tag } from 'lucide-react';
import type { Category, EntryKind } from '../types';
import { categoryStyle, TILE, NEUTRAL_TILE } from '../utils/categoryStyle';

const SIZE = {
  sm: { box: 'w-8 h-8', icon: 16, text: 'text-sm' },
  md: { box: 'w-10 h-10', icon: 20, text: 'text-base' },
  lg: { box: 'w-12 h-12', icon: 26, text: 'text-xl' },
};

interface Props {
  category?: Pick<Category, 'name' | 'icon' | 'color'>;
  /** Transfers and settlements have no category: they get a fixed tile. */
  kind?: EntryKind;
  size?: keyof typeof SIZE;
  className?: string;
}

/** The one place a category (or entry kind) becomes a colored square with a black border. */
export const CategoryTile: React.FC<Props> = ({ category, kind, size = 'md', className = '' }) => {
  const s = SIZE[size];
  let content: React.ReactNode;
  let color: string;
  if (kind === 'transfer') {
    content = <ArrowLeftRight size={s.icon} strokeWidth={2.5} />;
    color = TILE.sky;
  } else if (kind === 'settlement') {
    content = <HandCoins size={s.icon} strokeWidth={2.5} />;
    color = TILE.mint;
  } else {
    const st = categoryStyle(category);
    color = category ? st.color : NEUTRAL_TILE;
    content = st.Icon ? <st.Icon size={s.icon} strokeWidth={2.5} />
      : st.emoji ? <span className="leading-none">{st.emoji}</span>
      : category ? <span className={`font-black ${s.text}`}>{st.letter}</span>
      : <Tag size={s.icon} strokeWidth={2.5} />;
  }
  return (
    <span
      className={`${s.box} shrink-0 border-2 border-black grid place-items-center text-black ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {content}
    </span>
  );
};
