import { useToastStore } from '../../store/useToastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const iconMap = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
};

const colorMap = {
    success: 'bg-emerald-500/90 text-white',
    error: 'bg-red-500/90 text-white',
    info: 'bg-primary/90 text-primary-foreground',
};

export default function ToastContainer() {
    const toasts = useToastStore((s) => s.toasts);
    const removeToast = useToastStore((s) => s.removeToast);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
            {toasts.map((t) => {
                const Icon = iconMap[t.type];
                return (
                    <div
                        key={t.id}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm text-sm font-medium animate-in slide-in-from-right duration-300 ${colorMap[t.type]}`}
                    >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{t.message}</span>
                        <button
                            onClick={() => removeToast(t.id)}
                            className="shrink-0 hover:opacity-70 transition-opacity"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
