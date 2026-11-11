import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface XLoginButtonProps {
    onClick: () => void;
    disabled?: boolean;
    className?: string;
}

export default function XLoginButton({ onClick, disabled, className }: XLoginButtonProps) {
    const { t } = useTranslation();

    return (
        <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
                'flex items-center justify-center gap-2 bg-black text-white hover:bg-neutral-800 hover:text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:text-black border-neutral-800 dark:border-neutral-200 shadow-sm transition-all',
                className
            )}
            onClick={onClick}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="font-medium">{t('auth.loginWithX', 'X로 계속하기')}</span>
        </Button>
    );
}

