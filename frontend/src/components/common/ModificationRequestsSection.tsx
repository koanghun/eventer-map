import { useEffect, useState, type FormEvent } from 'react';
import { Check, FileEdit, Plus, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../store/useToastStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
    getListModificationRequestsQueryKey,
    useApplyModificationRequest,
    useCreateModificationRequest,
    useDeleteModificationRequest,
    useListModificationRequests,
    useVoteModificationRequestTrust,
} from '../../api/generated/modification-requests/modification-requests';
import { getGetEventsEventIdQueryKey, getGetEventsQueryKey } from '../../api/generated/events/events';
import { getGetArtistsArtistIdQueryKey, getGetArtistsQueryKey } from '../../api/generated/artists/artists';
import { getGetVenuesVenueIdQueryKey } from '../../api/generated/venues/venues';
import type { ModificationEntityType, ModificationRequest } from '../../api/generated/model';

interface ModificationRequestsSectionProps {
    entityType: ModificationEntityType;
    entityId: string;
    initialValues?: {
        title?: string;
        officialName?: string;
        hiragana?: string;
        disambiguation?: string;
        address?: string;
        capacity?: number;
    };
}

export function ModificationRequestsSection({
    entityType,
    entityId,
    initialValues,
}: ModificationRequestsSectionProps) {
    const { t } = useTranslation();
    const { isAuthenticated, user } = useAuth();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);

    const [title, setTitle] = useState(initialValues?.title ?? '');
    const [officialName, setOfficialName] = useState(initialValues?.officialName ?? '');
    const [hiragana, setHiragana] = useState(initialValues?.hiragana ?? '');
    const [disambiguation, setDisambiguation] = useState(initialValues?.disambiguation ?? '');
    const [address, setAddress] = useState(initialValues?.address ?? '');
    const [capacity, setCapacity] = useState(initialValues?.capacity ? String(initialValues.capacity) : '');
    const [reason, setReason] = useState('');

    useEffect(() => {
        setTitle(initialValues?.title ?? '');
        setOfficialName(initialValues?.officialName ?? '');
        setHiragana(initialValues?.hiragana ?? '');
        setDisambiguation(initialValues?.disambiguation ?? '');
        setAddress(initialValues?.address ?? '');
        setCapacity(initialValues?.capacity ? String(initialValues.capacity) : '');
        setReason('');
        setShowForm(false);
    }, [
        entityId,
        initialValues?.title,
        initialValues?.officialName,
        initialValues?.hiragana,
        initialValues?.disambiguation,
        initialValues?.address,
        initialValues?.capacity,
    ]);

    const { data, isLoading } = useListModificationRequests({
        entityType,
        entityId,
        status: 'PENDING',
    });

    const invalidateAll = () => {
        queryClient.invalidateQueries({
            queryKey: getListModificationRequestsQueryKey({ entityType, entityId, status: 'PENDING' }),
        });
        if (entityType === 'EVENT') {
            queryClient.invalidateQueries({ queryKey: getGetEventsEventIdQueryKey(entityId) });
            queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        } else if (entityType === 'ARTIST') {
            queryClient.invalidateQueries({ queryKey: getGetArtistsArtistIdQueryKey(entityId) });
            queryClient.invalidateQueries({ queryKey: getGetArtistsQueryKey() });
        } else {
            queryClient.invalidateQueries({ queryKey: getGetVenuesVenueIdQueryKey(entityId) });
            queryClient.invalidateQueries({ queryKey: ['/venues'] });
        }
    };

    const onError = (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg || t('modRequest.actionFailed', '요청 처리에 실패했습니다.'));
    };

    const createMutation = useCreateModificationRequest({
        mutation: {
            onSuccess: () => {
                invalidateAll();
                setShowForm(false);
                setReason('');
                toast.success(t('modRequest.created', '수정 요청이 등록되었습니다.'));
            },
            onError,
        },
    });

    const voteMutation = useVoteModificationRequestTrust({
        mutation: { onSuccess: invalidateAll, onError },
    });

    const deleteMutation = useDeleteModificationRequest({
        mutation: {
            onSuccess: () => {
                invalidateAll();
                toast.success(t('modRequest.deleted', '수정 요청이 삭제되었습니다.'));
            },
            onError,
        },
    });

    const applyMutation = useApplyModificationRequest({
        mutation: {
            onSuccess: () => {
                invalidateAll();
                toast.success(t('modRequest.applied', '수정 요청이 반영되었습니다.'));
            },
            onError,
        },
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!isAuthenticated) {
            toast.info(t('common.loginRequired', '로그인이 필요합니다.'));
            return;
        }
        const proposedData: Record<string, unknown> = {};
        if (entityType === 'EVENT') {
            if (title.trim() && title.trim() !== (initialValues?.title ?? '')) {
                proposedData.title = title.trim();
            }
        } else if (entityType === 'ARTIST') {
            if (officialName.trim() && officialName.trim() !== (initialValues?.officialName ?? '')) {
                proposedData.officialName = officialName.trim();
            }
            if (hiragana.trim() !== (initialValues?.hiragana ?? '')) {
                proposedData.hiragana = hiragana.trim();
            }
            if (disambiguation.trim() !== (initialValues?.disambiguation ?? '')) {
                proposedData.disambiguation = disambiguation.trim();
            }
        } else {
            if (officialName.trim() && officialName.trim() !== (initialValues?.officialName ?? '')) {
                proposedData.officialName = officialName.trim();
            }
            if (address.trim() !== (initialValues?.address ?? '')) {
                proposedData.address = address.trim();
            }
            const capNum = Number(capacity);
            if (capacity.trim() && !Number.isNaN(capNum) && capNum > 0 && capNum !== initialValues?.capacity) {
                proposedData.capacity = capNum;
            }
        }

        if (Object.keys(proposedData).length === 0) {
            toast.info(t('modRequest.noChanges', '변경된 내용이 없습니다.'));
            return;
        }

        createMutation.mutate({
            data: {
                entityType,
                entityId,
                proposedData,
                reason: reason.trim() || undefined,
            },
        });
    };

    const handleVote = (req: ModificationRequest, targetScore: 1 | -1) => {
        if (!isAuthenticated) {
            toast.info(t('common.loginRequired', '로그인이 필요합니다.'));
            return;
        }
        if (user?.id && req.authorId === user.id) {
            toast.info(t('credit.selfVoteNotAllowed', '작성자는 본인의 데이터에 투표할 수 없습니다.'));
            return;
        }
        const nextScore = req.myTrustScore === targetScore ? 0 : targetScore;
        voteMutation.mutate({ requestId: req.id, data: { score: nextScore } });
    };

    const requests = data?.requests ?? [];

    return (
        <div className="rounded-lg border border-border/70 bg-muted/10 p-2.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <FileEdit className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-foreground">
                        {t('modRequest.title', '공인 데이터 수정 요청')} ({requests.length})
                    </span>
                </div>
                {isAuthenticated && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => setShowForm((v) => !v)}
                    >
                        {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        <span>{showForm ? t('common.cancel', '취소') : t('modRequest.propose', '수정 요청')}</span>
                    </Button>
                )}
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="space-y-2 rounded-md border border-border bg-background p-2.5">
                    {entityType === 'EVENT' && (
                        <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                {t('event.title', '이벤트 제목')}
                            </label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" />
                        </div>
                    )}
                    {entityType === 'ARTIST' && (
                        <>
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                    {t('artist.officialName', '공식 이름')}
                                </label>
                                <Input value={officialName} onChange={(e) => setOfficialName(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                        {t('artist.hiragana', '히라가나')}
                                    </label>
                                    <Input value={hiragana} onChange={(e) => setHiragana(e.target.value)} className="h-8 text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                        {t('artist.disambiguation', '식별 설명')}
                                    </label>
                                    <Input value={disambiguation} onChange={(e) => setDisambiguation(e.target.value)} className="h-8 text-xs" />
                                </div>
                            </div>
                        </>
                    )}
                    {entityType === 'VENUE' && (
                        <>
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                    {t('venue.officialName', '공연장 이름')}
                                </label>
                                <Input value={officialName} onChange={(e) => setOfficialName(e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                        {t('venue.address', '주소')}
                                    </label>
                                    <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-8 text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                        {t('venue.capacity', '수용 인원')}
                                    </label>
                                    <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="h-8 text-xs" />
                                </div>
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            {t('modRequest.reason', '수정 사유')}
                        </label>
                        <Input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={t('modRequest.reasonPlaceholder', '변경이 필요한 이유를 입력하세요')}
                            className="h-8 text-xs"
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" size="sm" className="h-7 text-xs" disabled={createMutation.isPending}>
                            {t('modRequest.submit', '요청 등록')}
                        </Button>
                    </div>
                </form>
            )}

            {isLoading ? (
                <p className="text-[11px] text-muted-foreground">{t('common.loading', '불러오는 중...')}</p>
            ) : requests.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                    {t('modRequest.empty', '진행 중인 수정 요청이 없습니다.')}
                </p>
            ) : (
                <div className="space-y-2">
                    {requests.map((req) => {
                        const isMine = Boolean(user?.id && req.authorId === user.id);
                        const isAdmin = user?.role === 'ADMIN';
                        return (
                            <div key={req.id} className="rounded-md border border-border/70 bg-background p-2 space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 space-y-0.5">
                                        <div className="text-[11px] text-muted-foreground">
                                            {req.authorDisplayName || t('common.anonymous', '익명')}
                                        </div>
                                        {req.reason && (
                                            <p className="text-xs text-foreground">{req.reason}</p>
                                        )}
                                        <div className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-1 rounded space-y-0.5">
                                            {Object.entries(req.proposedData ?? {}).map(([k, v]) => (
                                                <div key={k} className="truncate">
                                                    <span className="font-medium text-foreground/80">{k}:</span>{' '}
                                                    <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isAdmin && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-6 px-1.5 text-[11px] gap-0.5"
                                                disabled={applyMutation.isPending}
                                                onClick={() => applyMutation.mutate({ requestId: req.id })}
                                                title={t('modRequest.applyNow', '관리자 즉시 반영')}
                                            >
                                                <Check className="w-3 h-3" />
                                            </Button>
                                        )}
                                        {(isMine || isAdmin) && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 px-1.5 text-destructive hover:text-destructive"
                                                disabled={deleteMutation.isPending}
                                                onClick={() => deleteMutation.mutate({ requestId: req.id })}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                                    <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-muted-foreground">{t('modRequest.trustScore', '신뢰 점수')}:</span>
                                        <span
                                            className={cn(
                                                'font-bold tabular-nums',
                                                req.trustScore > 0
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : req.trustScore < 0
                                                      ? 'text-destructive'
                                                      : 'text-muted-foreground'
                                            )}
                                        >
                                            {req.trustScore > 0 ? `+${req.trustScore}` : req.trustScore}
                                        </span>
                                        <span className="text-muted-foreground">({req.trustCount})</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={req.myTrustScore === 1 ? 'default' : 'outline'}
                                            disabled={voteMutation.isPending || isMine}
                                            onClick={() => handleVote(req, 1)}
                                            className="h-6 px-2 text-[11px] gap-1"
                                        >
                                            <ThumbsUp className="w-3 h-3" />
                                            <span>+1</span>
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={req.myTrustScore === -1 ? 'destructive' : 'outline'}
                                            disabled={voteMutation.isPending || isMine}
                                            onClick={() => handleVote(req, -1)}
                                            className="h-6 px-2 text-[11px] gap-1"
                                        >
                                            <ThumbsDown className="w-3 h-3" />
                                            <span>-1</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
