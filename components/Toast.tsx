import React from 'react';
import { useToast, ToastType } from './ToastContext';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case 'success': return <CheckCircle size={20} />;
    case 'error': return <AlertCircle size={20} />;
    case 'info': return <Info size={20} />;
  }
};

const ToastColor = (type: ToastType) => {
  switch (type) {
    case 'success': return 'bg-neo-green';
    case 'error': return 'bg-neo-red';
    case 'info': return 'bg-neo-blue';
  }
};

export const ToastContainer: React.FC = () => {
  const { toasts, remove } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-[320px]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`border-2 border-black shadow-neo-sm p-4 ${ToastColor(toast.type)} flex gap-3 items-start animate-in slide-in-from-right duration-300`}
        >
          <div className="mt-0.5">
            <ToastIcon type={toast.type} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold uppercase text-sm">{toast.title}</h4>
            {toast.description && (
              <p className="text-xs mt-1 font-medium">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => remove(toast.id)}
            className="hover:bg-black/10 p-1 -mr-2 -mt-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
