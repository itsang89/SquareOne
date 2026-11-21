import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  action?: { label: string; onClick: () => void }; // toasts with an action keep their full life across navigation
  duration?: number; // ms, default 5000
}

interface ToastContextType {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  shorten: (ms: number) => void; // cut every plain toast's remaining life to at most ms, once
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Per-toast expiry: id -> { timer, expiresAt }.
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; expiresAt: number; fixed?: boolean }>());

  const remove = useCallback((id: string) => {
    clearTimeout(timers.current.get(id)?.timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback((id: string, ms: number, fixed?: boolean) => {
    clearTimeout(timers.current.get(id)?.timer);
    timers.current.set(id, { timer: setTimeout(() => remove(id), ms), expiresAt: Date.now() + ms, fixed });
  }, [remove]);

  const show = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    schedule(id, toast.duration ?? 5000, !!toast.action);
  }, [schedule]);

  const shorten = useCallback((ms: number) => {
    for (const [id, { expiresAt, fixed }] of timers.current) {
      if (!fixed && expiresAt - Date.now() > ms) schedule(id, ms);
    }
  }, [schedule]);

  const success = useCallback((title: string, description?: string) => {
    show({ title, description, type: 'success' });
  }, [show]);

  const error = useCallback((title: string, description?: string) => {
    show({ title, description, type: 'error' });
  }, [show]);

  return (
    <ToastContext.Provider value={{ toasts, show, shorten, success, error, remove }}>
      {children}
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
