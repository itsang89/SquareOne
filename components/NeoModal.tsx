import React from 'react';
import { X } from 'lucide-react';
import { NeoButton } from './NeoButton';

interface NeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const NeoModal: React.FC<NeoModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border-4 border-black shadow-neo animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-4 border-black bg-neo-yellow dark:text-black">
          <h3 className="font-black uppercase text-xl tracking-tighter">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-black/10 border-2 border-transparent hover:border-black transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] dark:text-zinc-100">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t-4 border-black bg-gray-50 dark:bg-zinc-800 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
