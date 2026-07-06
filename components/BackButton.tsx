import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { springs } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';

interface BackButtonProps {
  to?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ to }) => {
  const navigate = useNavigate();
  const { getTransition } = useAnimations();

  return (
    <motion.button
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="w-10 h-10 bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 text-black dark:text-zinc-100"
      aria-label="Go back"
      whileHover={{
        scale: 1.05,
        transition: getTransition(springs.snappy),
      }}
      whileTap={{
        scale: 0.95,
        x: 1,
        y: 1,
        boxShadow: '1px 1px 0px 0px rgba(0,0,0,1)',
        transition: getTransition(springs.snappy),
      }}
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        whileHover={{
          x: -2,
          transition: getTransition(springs.snappy),
        }}
      >
        <path d="m15 18-6-6 6-6" />
      </motion.svg>
    </motion.button>
  );
};
