import React, { useState } from 'react';
import { eventApi } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { AlertCircle, AlertTriangle, XCircle, FileText, CheckCircle2, X } from 'lucide-react';

interface EventReportModalProps {
    eventId: number;
    eventTitle: string;
    onClose: () => void;
}

export default function EventReportModal({ eventId, eventTitle, onClose }: EventReportModalProps) {
    const { t } = useTranslation();
    const [reason, setReason] = useState<string>('spam');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const reasons = [
        { value: 'spam', icon: <AlertCircle className="w-5 h-5 text-red-500" />, label: t('eventDetail.report.reasons.spam'), description: t('eventDetail.report.reasons.spamDesc') },
        { value: 'inappropriate', icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, label: t('eventDetail.report.reasons.inappropriate'), description: t('eventDetail.report.reasons.inappropriateDesc') },
        { value: 'wrong_info', icon: <XCircle className="w-5 h-5 text-orange-500" />, label: t('eventDetail.report.reasons.wrong_info'), description: t('eventDetail.report.reasons.wrong_infoDesc') },
        { value: 'other', icon: <FileText className="w-5 h-5 text-blue-500" />, label: t('eventDetail.report.reasons.other'), description: t('eventDetail.report.reasons.otherDesc') }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            await eventApi.reportEvent(eventId, {
                reason,
                description: description.trim() || undefined
            });
            setSuccess(true);
            setTimeout(() => onClose(), 2000);
        } catch (err: any) {
            console.error('Failed to submit report:', err);
            if (err.response?.status === 400) {
                setError(t('eventDetail.report.alreadyReported'));
            } else {
                setError(t('eventDetail.report.error'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="w-full max-w-sm bg-background border border-border rounded-xl shadow-2xl p-8 text-center animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-foreground mb-2">{t('eventDetail.report.success')}</h3>
                    <p className="text-muted-foreground">{t('eventDetail.report.successMessage')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-border bg-destructive/10 text-destructive">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <h2 className="text-lg font-bold">{t('eventDetail.report.title')}</h2>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/20 rounded-full" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="p-5">
                    <div className="mb-6 p-3 bg-muted rounded-lg text-sm border border-border/50">
                        <span className="font-semibold text-foreground mr-2">{t('eventDetail.report.eventLabel')}:</span> 
                        <span className="text-muted-foreground">{eventTitle}</span>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm border border-transparent font-semibold">{t('eventDetail.report.reasonLabel')}</label>
                            <div className="grid grid-cols-1 gap-3">
                                {reasons.map((r) => (
                                    <label 
                                        key={r.value} 
                                        className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                            reason === r.value 
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                                            : 'border-border bg-card hover:border-primary/50'
                                        }`}
                                    >
                                        <div className="flex items-center h-5">
                                            <input
                                                type="radio"
                                                name="reason"
                                                value={r.value}
                                                checked={reason === r.value}
                                                onChange={(e) => setReason(e.target.value)}
                                                className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {r.icon}
                                                <span className={`font-semibold ${reason === r.value ? 'text-primary' : 'text-foreground'}`}>
                                                    {r.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{r.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="description" className="text-sm font-semibold flex justify-between">
                                {t('eventDetail.report.descriptionLabel')}
                                <span className="text-xs font-normal text-muted-foreground">{description.length}/500</span>
                            </label>
                            <textarea
                                id="description"
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-none"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('eventDetail.report.descriptionPlaceholder')}
                                maxLength={500}
                            />
                        </div>

                        {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">{error}</div>}

                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                                {t('buttons.cancel')}
                            </Button>
                            <Button type="submit" variant="destructive" className="flex-1" disabled={submitting}>
                                {submitting ? t('eventDetail.report.submitting') : t('eventDetail.report.submit')}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
