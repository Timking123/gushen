import React, { useState, useEffect, useCallback } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 300);
  }, [toast.id, onClose]);

  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(handleClose, toast.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleClose]);

  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`toast toast-${toast.type} ${isExiting ? 'exiting' : ''}`}>
      <div className="toast-icon">{icons[toast.type]}</div>
      <div className="toast-content">
        <div className="toast-title">{toast.title}</div>
        {toast.message && <div className="toast-message">{toast.message}</div>}
      </div>
      {toast.action && (
        <button className="toast-action" onClick={toast.action.onClick}>
          {toast.action.label}
        </button>
      )}
      <button className="toast-close" onClick={handleClose}>
        ×
      </button>
    </div>
  );
};

// Toast Container
interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};

// Toast Hook
let toastId = 0;
let addToastFn: ((toast: Omit<ToastMessage, 'id'>) => void) | null = null;

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${++toastId}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 暴露给全局使用
  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  return { toasts, addToast, removeToast };
};

// 全局 toast 函数
export const toast = {
  success: (title: string, message?: string) => {
    addToastFn?.({ type: 'success', title, message });
  },
  error: (title: string, message?: string) => {
    addToastFn?.({ type: 'error', title, message });
  },
  warning: (title: string, message?: string) => {
    addToastFn?.({ type: 'warning', title, message });
  },
  info: (title: string, message?: string) => {
    addToastFn?.({ type: 'info', title, message });
  },
};

export default Toast;
