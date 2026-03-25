import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { useTranslation } from 'react-i18next';

interface ManagementLayoutProps {
    title: string;
    description?: string;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    isLoading?: boolean;
    children: React.ReactNode;
    actions?: React.ReactNode;
}

export default function ManagementLayout({
    title,
    description,
    searchQuery,
    onSearchChange,
    isLoading,
    children,
    actions
}: ManagementLayoutProps) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-primary tracking-tight">{title}</h2>
                    {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative w-full md:w-64 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder={t('management.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-9 h-10 rounded-xl"
                        />
                    </div>
                    {actions}
                </div>
            </div>

            <div className="flex-1 overflow-hidden bg-card/30 rounded-xl border border-border/50 backdrop-blur-sm shadow-inner relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : null}
                <div className="h-full overflow-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
