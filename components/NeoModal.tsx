import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { NeoButton } from './NeoButton';
import { modalBackdrop, modalContent, springs } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';

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
  const { getVariants, getTransition } = useAnimations();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            variants={getVariants(modalBackdrop)}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
          
          {/* Modal Content */}
          <motion.div 
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 border-4 border-black shadow-neo"
            variants={getVariants(modalContent)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-4 border-black bg-neo-yellow dark:text-black">
              <h3 className="font-black uppercase text-xl tracking-tighter">{title}</h3>
              <motion.button 
                onClick={onClose}
                className="p-1 border-2 border-transparent"
                whileHover={{ 
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  borderColor: '#000',
                }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={24} />
              </motion.button>
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
