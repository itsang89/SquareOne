import React from 'react';

export const LoadingSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-gray-200 border-2 border-black animate-pulse ${className}`}></div>
  );
};

export const TransactionSkeleton: React.FC = () => (
  <div className="border-2 border-black p-4 bg-white shadow-neo-sm flex items-center gap-4 mb-4">
    <LoadingSkeleton className="w-12 h-12 rounded-full shrink-0" />
    <div className="flex-1 space-y-2">
      <LoadingSkeleton className="h-4 w-3/4" />
      <LoadingSkeleton className="h-3 w-1/2" />
    </div>
    <LoadingSkeleton className="w-16 h-6" />
  </div>
);

export const FriendSkeleton: React.FC = () => (
  <div className="border-2 border-black p-4 bg-white shadow-neo flex flex-col items-center text-center">
    <LoadingSkeleton className="w-16 h-16 rounded-full mb-3" />
    <LoadingSkeleton className="h-4 w-24 mb-2" />
    <LoadingSkeleton className="h-3 w-16" />
  </div>
);
