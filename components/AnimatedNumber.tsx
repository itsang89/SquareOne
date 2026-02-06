import { useNumberCounter } from '../hooks/useNumberCounter';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Component that animates number changes with smooth counting
 */
export function AnimatedNumber({
  value,
  duration = 800,
  decimals = 2,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedNumberProps) {
  const displayValue = useNumberCounter(value, { duration });

  // Format the number
  const formattedValue = displayValue.toFixed(decimals);

  return (
    <span className={className}>
      {prefix}{formattedValue}{suffix}
    </span>
  );
}
