'use client';

import { useEffect, useState } from 'react';
import styles from './Toast.module.css';
import { CheckIcon, XIcon, InfoIcon } from './Icons';

export interface ToastMessage {
    id: number;
    message: string;
    type?: 'success' | 'error' | 'info';
}

interface ToastProps {
    toasts: ToastMessage[];
    removeToast: (id: number) => void;
}

export default function Toast({ toasts, removeToast }: ToastProps) {
    return (
        <div className={styles.toastContainer}>
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(onRemove, 200);
        }, 2500);

        return () => clearTimeout(timer);
    }, [onRemove]);

    const typeClass = toast.type === 'error'
        ? styles.toastError
        : toast.type === 'info'
            ? styles.toastInfo
            : styles.toastSuccess;

    const Icon = toast.type === 'error'
        ? XIcon
        : toast.type === 'info'
            ? InfoIcon
            : CheckIcon;

    return (
        <div
            className={`${styles.toast} ${typeClass} ${isExiting ? styles.toastExit : ''}`}
            onClick={onRemove}
        >
            <span className={styles.toastIcon}>
                <Icon size={20} />
            </span>
            <span className={styles.toastMessage}>{toast.message}</span>
        </div>
    );
}

// Hook for using toast
let toastId = 0;

export function useToast() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message, type }]);
    };

    const removeToast = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return { toasts, addToast, removeToast };
}
