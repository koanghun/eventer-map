import { useTranslation } from 'react-i18next';
import { useToastStore } from '../../store/useToastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const iconMap = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
};

const colorMap = {
    success: 'bg-emerald-500/95 text-white border border-emerald-400/30',
    error: 'bg-red-500/95 text-white border border-red-400/30',
    info: 'bg-primary/95 text-primary-foreground border border-primary/30',
};

export default function ToastContainer() {
    const { t } = useTranslation();
    const toasts = useToastStore((s) => s.toasts);
    const removeToast = useToastStore((s) => s.removeToast);

    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed bottom-16 right-4 z-[9999] flex flex-col gap-2 max-w-sm"
            role="region"
            aria-live="polite"
        >
            {toasts.map((item) => {
                const Icon = iconMap[item.type];
                return (
                    <div
                        key={item.id}
                        role="status"
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm text-sm font-medium animate-in slide-in-from-right duration-300 ${colorMap[item.type]}`}
                    >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 break-words">{item.message}</span>
                        <button
                            type="button"
                            onClick={() => removeToast(item.id)}
                            className="shrink-0 p-0.5 rounded-md hover:bg-white/20 transition-colors"
                            title={t('buttons.close', '닫기')}
                            aria-label={t('buttons.close', '닫기')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
