import React from 'react';

interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const NeoInput: React.FC<NeoInputProps> = ({
  label,
  error,
  fullWidth = true,
  className = '',
  ...props
}) => {
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <div className={`${widthClass} mb-4`}>
      {label && (
        <label className="block font-black uppercase text-sm mb-1 tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`
          ${widthClass}
          border-2 border-black p-3 
          font-bold placeholder:text-gray-400 dark:placeholder:text-zinc-500
          focus:outline-none focus:ring-0 focus:shadow-neo-sm
          transition-all
          ${error ? 'bg-neo-red/10 border-neo-red' : 'bg-white dark:bg-zinc-900'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="block mt-1 text-neo-red text-xs font-black uppercase tracking-tight">
          {error}
        </span>
      )}
    </div>
  );
};

export const NeoTextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string, error?: string }> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full mb-4">
      {label && (
        <label className="block font-black uppercase text-sm mb-1 tracking-wider">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full
          border-2 border-black p-3 
          font-bold placeholder:text-gray-400 dark:placeholder:text-zinc-500
          focus:outline-none focus:ring-0 focus:shadow-neo-sm
          transition-all min-h-[100px]
          ${error ? 'bg-neo-red/10 border-neo-red' : 'bg-white dark:bg-zinc-900'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="block mt-1 text-neo-red text-xs font-black uppercase tracking-tight">
          {error}
        </span>
      )}
    </div>
  );
};
