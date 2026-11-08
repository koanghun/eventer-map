import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastStore {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType) => void;
    removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
    toasts: [],
    addToast: (message, type = 'info') => {
        // 이미 동일한 메시지와 타입의 토스트가 떠 있으면 중복 생성을 방지
        if (get().toasts.some((t) => t.message === message && t.type === type)) {
            return;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
            toasts: [...state.toasts, { id, message, type }],
        }));
        // Auto-dismiss after 4 seconds
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id),
            }));
        }, 4000);
    },
    removeToast: (id) =>
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        })),
}));

// Convenience functions for use outside of React components (e.g., axios interceptors)
export const toast = {
    success: (message: string) => useToastStore.getState().addToast(message, 'success'),
    error: (message: string) => useToastStore.getState().addToast(message, 'error'),
    info: (message: string) => useToastStore.getState().addToast(message, 'info'),
    apiError: (error: any, fallbackMessage: string) => {
        // 전역 Axios 인터셉터에서 이미 토스트를 표시한 경우 중복 호출 방지
        if (error?._toastShown) return;
        const serverMessage = error?.response?.data?.error;
        useToastStore.getState().addToast(serverMessage || fallbackMessage, 'error');
    },
};
