import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  const { toasts, remove, shorten } = useToast();
  const { pathname } = useLocation();

  // Toasts from the previous screen get a short life after navigation (long enough to read "Saved").
  useEffect(() => { shorten(1500); }, [pathname, shorten]);

  return (
    <div className="fixed bottom-32 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-3 sm:w-full sm:max-w-[320px]" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`border-2 border-black shadow-neo-sm p-4 ${ToastColor(toast.type)} flex gap-3 items-start animate-in slide-in-from-bottom duration-300`}
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
          {toast.action && (
            <button
              onClick={() => { toast.action!.onClick(); remove(toast.id); }}
              className="self-center border-2 border-black bg-white px-2 py-1 text-xs font-black uppercase shadow-neo-sm active:shadow-neo-pressed"
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={() => remove(toast.id)}
            aria-label="Dismiss"
            className="hover:bg-black/10 p-2 -mr-2 -mt-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
