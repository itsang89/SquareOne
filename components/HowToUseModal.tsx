import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Receipt, 
  Handshake, 
  ChevronRight, 
  ChevronLeft,
  Plus,
  ArrowRight,
  Check
} from 'lucide-react';
import { NeoModal } from './NeoModal';
import { NeoButton } from './NeoButton';
import { slideInRight, slideInLeft, springs } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';

interface HowToUseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddFriendsVisual = () => {
  return (
    <div className="relative h-40 bg-gray-50 dark:bg-zinc-800/50 border-2 border-black flex flex-col items-center justify-center overflow-hidden p-4">
      <div className="flex gap-3 mb-2 animate-in slide-in-from-left duration-700">
        <div className="w-10 h-10 rounded-full border-2 border-black bg-neo-yellow shadow-neo-sm"></div>
        <div className="flex-1 w-24 h-4 bg-gray-200 dark:bg-zinc-700 mt-3 border border-black/10"></div>
      </div>
      <div className="flex gap-3 mb-2 animate-in slide-in-from-right duration-700 delay-300">
        <div className="w-10 h-10 rounded-full border-2 border-black bg-neo-purple shadow-neo-sm"></div>
        <div className="flex-1 w-24 h-4 bg-gray-200 dark:bg-zinc-700 mt-3 border border-black/10"></div>
      </div>
      <div className="absolute bottom-4 right-4 w-10 h-10 bg-neo-yellow border-2 border-black shadow-neo-sm flex items-center justify-center animate-bounce">
        <Plus size={20} />
      </div>
    </div>
  );
};

const SplitBillsVisual = () => {
  return (
    <div className="relative h-40 bg-gray-50 dark:bg-zinc-800/50 border-2 border-black flex items-center justify-center overflow-hidden p-4">
      <div className="relative z-10 w-24 h-16 bg-white dark:bg-zinc-900 border-2 border-black shadow-neo flex flex-col items-center justify-center animate-in zoom-in duration-500">
        <span className="text-[10px] font-black uppercase text-gray-400">Bill</span>
        <span className="font-black text-xl">$100</span>
      </div>
      
      <div className="absolute left-1/4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 animate-in slide-in-from-right duration-700 delay-500 fill-mode-forwards opacity-0" style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}>
        <div className="w-12 h-12 rounded-full border-2 border-black bg-neo-greenDark shadow-neo-sm flex items-center justify-center text-white">
          <span className="font-black text-[10px]">+$50</span>
        </div>
      </div>

      <div className="absolute right-1/4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 animate-in slide-in-from-left duration-700 delay-500 fill-mode-forwards opacity-0" style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}>
        <div className="w-12 h-12 rounded-full border-2 border-black bg-neo-red shadow-neo-sm flex items-center justify-center text-white">
          <span className="font-black text-[10px]">-$50</span>
        </div>
      </div>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-[2px] bg-black/10 -z-0"></div>
    </div>
  );
};

const SettleUpVisual = () => {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSettled(prev => !prev);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-40 bg-gray-50 dark:bg-zinc-800/50 border-2 border-black flex flex-col items-center justify-center overflow-hidden p-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-black bg-neo-blue shadow-neo flex items-center justify-center transition-all duration-500">
          <Handshake size={32} className="text-white" />
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="relative h-8 w-24 border-2 border-black bg-white dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
            <span className={`absolute transition-all duration-500 font-black ${settled ? '-translate-y-10' : 'text-neo-red'}`}>
              -$50.00
            </span>
            <span className={`absolute transition-all duration-500 font-black text-neo-greenDark ${settled ? 'translate-y-0' : 'translate-y-10'}`}>
              $0.00 <Check size={14} className="inline ml-1" />
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex gap-2">
         {[1,2,3].map(i => (
           <div key={i} className={`w-2 h-2 rounded-full border border-black ${settled ? 'bg-neo-green' : 'bg-gray-300'}`}></div>
         ))}
      </div>
    </div>
  );
};

const STEPS = [
  {
    title: "Add Friends",
    text: "Add friends to your list to start tracking shared expenses together.",
    visual: <AddFriendsVisual />,
    color: "bg-neo-purple"
  },
  {
    title: "Track & Split",
    text: "Record bills and SquareOne handles the math, showing exactly who owes what.",
    visual: <SplitBillsVisual />,
    color: "bg-neo-yellow"
  },
  {
    title: "Settle Up",
    text: "Clear your debts when you pay back. Keep your balances at SquareOne!",
    visual: <SettleUpVisual />,
    color: "bg-neo-blue"
  }
];

export const HowToUseModal: React.FC<HowToUseModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 for next, -1 for back
  const { getVariants, getTransition } = useAnimations();

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const stepData = STEPS[currentStep] || STEPS[0];
  
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -50 : 50,
      opacity: 0,
    }),
  };

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title="Feature Tour"
    >
      <div className="flex flex-col gap-6 py-2">
        <AnimatePresence mode="wait" custom={direction}>
          {stepData && (
            <motion.div
              key={currentStep}
              custom={direction}
              variants={getVariants(slideVariants)}
              initial="enter"
              animate="center"
              exit="exit"
              transition={getTransition(springs.gentle)}
              className="flex flex-col gap-6"
            >
              {/* Visual Illustration */}
              <div className="relative">
                <motion.div 
                  className={`absolute -inset-1 ${stepData.color} border-2 border-black -z-10`}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={springs.bouncy}
                />
                <div className="bg-white dark:bg-zinc-900 border-2 border-black p-1">
                  {stepData.visual}
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <motion.div 
                    className={`px-3 py-1 border-2 border-black font-black uppercase text-xs ${stepData.color}`}
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={springs.elastic}
                  >
                    Step {currentStep + 1}
                  </motion.div>
                  <h3 className="font-black uppercase text-xl tracking-tight text-black dark:text-zinc-100">
                    {stepData.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-400 font-bold leading-relaxed">
                  {stepData.text}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex gap-3">
            {currentStep > 0 && (
              <NeoButton 
                variant="neutral" 
                onClick={handleBack}
                className="flex-1"
              >
                <div className="flex items-center justify-center gap-2">
                  <ChevronLeft size={18} />
                  <span>Back</span>
                </div>
              </NeoButton>
            )}
            <NeoButton 
              variant="primary" 
              onClick={handleNext}
              className="flex-[2]"
            >
              <div className="flex items-center justify-center gap-2">
                <span>{currentStep === STEPS.length - 1 ? "Got it!" : "Next Step"}</span>
                {currentStep < STEPS.length - 1 && <ChevronRight size={18} />}
              </div>
            </NeoButton>
          </div>

          {/* Progress Indicators */}
          <div className="flex justify-center gap-2">
            {STEPS.map((step, idx) => {
              const isActive = idx === currentStep;
              const isPast = idx < currentStep;
              return (
                <motion.div 
                  key={idx}
                  className={`h-2 border-2 border-black ${
                    isActive 
                      ? step.color + " shadow-neo-sm" 
                      : isPast 
                        ? "bg-gray-400 dark:bg-zinc-600" 
                        : "bg-gray-200 dark:bg-zinc-800"
                  }`}
                  animate={{
                    width: isActive ? 64 : 48,
                    scale: isActive ? [1, 1.1, 1] : 1,
                  }}
                  transition={{
                    type: 'keyframes',
                    duration: 0.6,
                    repeat: isActive ? Infinity : 0,
                    repeatType: 'reverse'
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </NeoModal>
  );
};
