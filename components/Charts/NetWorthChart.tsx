import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NeoCard } from '../NeoCard';
import { useReducedMotion } from '../../hooks/useAnimations';
import { compact, hkd } from './format';

export interface NWPoint {
  label: string;
  value: number;
}

interface Props {
  /** First entry is the opening value (before the period); the rest are period points. */
  points: NWPoint[];
  hasData: boolean;
  /** Show a per-point change table (year view). */
  table: boolean;
}

export const NetWorthChart: React.FC<Props> = ({ points, hasData, table }) => {
  const reduced = useReducedMotion();
  if (!hasData) {
    return (
      <NeoCard className="text-center py-10">
        <p className="font-bold">No net worth yet</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">Add an account in Wallet and log entries to track it.</p>
      </NeoCard>
    );
  }
  const shown = points.slice(1);
  const open = points[0].value;
  const close = points[points.length - 1].value;

  return (
    <div className="space-y-4">
      <NeoCard className="flex gap-3">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase text-gray-600 dark:text-zinc-400">Now</div>
          <div className="font-black text-xl">{hkd(close)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase text-gray-600 dark:text-zinc-400">Change</div>
          <div className={`font-black text-xl ${close - open >= 0 ? 'text-neo-greenDark' : 'text-neo-danger'}`}>
            {hkd(close - open, true)}
          </div>
        </div>
      </NeoCard>
      <NeoCard className="h-60 px-1 text-black dark:text-zinc-300">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={shown} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.2} />
            <XAxis dataKey="label" tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={compact} tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} width={44} domain={['auto', 'auto']} />
            <Tooltip formatter={(v) => hkd(Number(v))} contentStyle={{ border: '2px solid #000', borderRadius: 0, color: '#000' }} />
            <Area type="monotone" dataKey="value" name="Net worth" stroke="#000" strokeWidth={2} fill="#82B8FF" isAnimationActive={!reduced} />
          </AreaChart>
        </ResponsiveContainer>
      </NeoCard>
      {table && (
        <NeoCard className="p-0 divide-y-2 divide-black">
          {shown.map((p, i) => {
            const d = p.value - points[i].value;
            return (
              <div key={p.label} className="flex items-center p-3 text-sm">
                <span className="w-12 font-bold">{p.label}</span>
                <span className="flex-1 tabular-nums">{hkd(p.value)}</span>
                <span className={`font-black tabular-nums ${d >= 0 ? 'text-neo-greenDark' : 'text-neo-danger'}`}>{hkd(d, true)}</span>
              </div>
            );
          })}
        </NeoCard>
      )}
    </div>
  );
};
