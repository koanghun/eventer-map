import { useEffect, useState, type FormEvent } from 'react';
import { Check, ChevronDown, ChevronUp, FileEdit, Plus, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../store/useToastStore';
import { cn, formatLocalizedTime } from '../../lib/utils';
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
import { getGetUsersMeFollowingArtistsEventsQueryKey } from '../../api/generated/user/user';
import type { ModificationEntityType, ModificationRequest } from '../../api/generated/model';

interface ModificationRequestsSectionProps {
    entityType: ModificationEntityType;
    entityId: string;
    initialValues?: {
        title?: string;
        officialName?: string;
        hiragana?: string;
        disambiguation?: string;
        gender?: string;
        address?: string;
        capacity?: number;
    };
    onProposeEdit?: () => void;
}

interface FieldDisplayEntry {
    key: string;
    label: string;
    value: string;
}

function formatProposedTimeValue(val: unknown, language: string): string {
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return '-';
        if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
        return formatLocalizedTime(trimmed, language) ?? trimmed;
    }
    return String(val);
}

function formatProposedEntries(
    entityType: ModificationEntityType,
    proposedData: Record<string, unknown> | undefined,
    t: TFunction,
    language: string
): FieldDisplayEntry[] {
    if (!proposedData) return [];

    const entries: FieldDisplayEntry[] = [];
    const entriesSeen = new Set<string>();

    if (entityType === 'VENUE' && ('latitude' in proposedData || 'longitude' in proposedData)) {
        entriesSeen.add('latitude');
        entriesSeen.add('longitude');
        entries.push({
            key: 'coordinates',
            label: t('venueForm.fields.coordinates', '좌표 (위도 / 경도)'),
            value: `${proposedData.latitude ?? '-'}, ${proposedData.longitude ?? '-'}`,
        });
    }

    for (const [k, v] of Object.entries(proposedData)) {
        if (entriesSeen.has(k)) continue;
        if (k === 'venueName' && 'venueId' in proposedData) continue;
        if (k === 'artistNames' && 'artistIds' in proposedData) continue;

        let label = k;
        let value = typeof v === 'object' ? JSON.stringify(v) : String(v);

        if (entityType === 'EVENT') {
            switch (k) {
                case 'title':
                    label = t('event.fields.title', '타이틀');
                    value = String(v ?? '');
                    break;
                case 'date':
                    label = t('event.fields.date', '개최일');
                    value = String(v ?? '');
                    break;
                case 'openingTime':
                    label = t('event.fields.doorsOpen', '개장 시간');
                    value = formatProposedTimeValue(v, language);
                    break;
                case 'startTime':
                    label = t('event.fields.startTime', '개연 시간');
                    value = formatProposedTimeValue(v, language);
                    break;
                case 'endTime':
                    label = t('event.fields.endTime', '종료 시간');
                    value = formatProposedTimeValue(v, language);
                    break;
                case 'venueId':
                    label = t('event.fields.venue', '회장');
                    value =
                        typeof proposedData.venueName === 'string' && proposedData.venueName.trim()
                            ? proposedData.venueName.trim()
                            : String(v ?? '');
                    break;
                case 'artistIds': {
                    label = t('event.fields.artists', '출연자');
                    if (Array.isArray(proposedData.artistNames) && proposedData.artistNames.length > 0) {
                        value = proposedData.artistNames.map(String).join(', ');
                    } else if (Array.isArray(v)) {
                        value = v.length > 0 ? v.map(String).join(', ') : '-';
                    }
                    break;
                }
                case 'relatedLinks':
                    label = t('event.fields.relatedLinks', '관련 링크');
                    value = Array.isArray(v) ? (v.length > 0 ? v.map(String).join(', ') : '-') : String(v ?? '');
                    break;
                default:
                    break;
            }
        } else if (entityType === 'ARTIST') {
            switch (k) {
                case 'officialName':
                    label = t('artist.officialName', '공식 이름');
                    value = String(v ?? '');
                    break;
                case 'hiragana':
                    label = t('artist.hiragana', '히라가나');
                    value = String(v ?? '') || '-';
                    break;
                case 'disambiguation':
                    label = t('artist.disambiguation', '식별 설명');
                    value = String(v ?? '') || '-';
                    break;
                case 'gender':
                    label = t('artistForm.fields.gender', '성별');
                    value = t(`artistForm.fields.genderOptions.${String(v)}`, String(v));
                    break;
                default:
                    break;
            }
        } else {
            switch (k) {
                case 'officialName':
                    label = t('venue.officialName', '공연장 이름');
                    value = String(v ?? '');
                    break;
                case 'address':
                    label = t('venue.address', '주소');
                    value = String(v ?? '') || '-';
                    break;
                case 'capacity':
                    label = t('venue.capacity', '수용 인원');
                    value = String(v ?? '');
                    break;
                case 'relatedLinks':
                    label = t('event.fields.relatedLinks', '관련 링크');
                    value = Array.isArray(v) ? (v.length > 0 ? v.map(String).join(', ') : '-') : String(v ?? '');
                    break;
                default:
                    break;
            }
        }

        entries.push({ key: k, label, value });
    }

    return entries;
}

export function ModificationRequestsSection({
    entityType,
    entityId,
    initialValues,
    onProposeEdit,
}: ModificationRequestsSectionProps) {
    const { t, i18n } = useTranslation();
    const { isAuthenticated, user } = useAuth();
    const queryClient = useQueryClient();

    // 기본적으로 접혀서 보이지 않도록 false로 초기화
    const [isExpanded, setIsExpanded] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [title, setTitle] = useState(initialValues?.title ?? '');
    const [officialName, setOfficialName] = useState(initialValues?.officialName ?? '');
    const [hiragana, setHiragana] = useState(initialValues?.hiragana ?? '');
    const [disambiguation, setDisambiguation] = useState(initialValues?.disambiguation ?? '');
    const [gender, setGender] = useState(initialValues?.gender ?? '');
    const [address, setAddress] = useState(initialValues?.address ?? '');
    const [capacity, setCapacity] = useState(initialValues?.capacity ? String(initialValues.capacity) : '');
    const [reason, setReason] = useState('');

    useEffect(() => {
        setTitle(initialValues?.title ?? '');
        setOfficialName(initialValues?.officialName ?? '');
        setHiragana(initialValues?.hiragana ?? '');
        setDisambiguation(initialValues?.disambiguation ?? '');
        setGender(initialValues?.gender ?? '');
        setAddress(initialValues?.address ?? '');
        setCapacity(initialValues?.capacity ? String(initialValues.capacity) : '');
        setReason('');
        setShowForm(false);
        setIsExpanded(false);
    }, [
        entityId,
        initialValues?.title,
        initialValues?.officialName,
        initialValues?.hiragana,
        initialValues?.disambiguation,
        initialValues?.gender,
        initialValues?.address,
        initialValues?.capacity,
    ]);

    const { data, isLoading } = useListModificationRequests(
        {
            entityType,
            entityId,
            status: 'PENDING',
        },
        {
            query: {
                enabled: Boolean(entityId),
            },
        }
    );

    const invalidateAll = () => {
        queryClient.invalidateQueries({
            queryKey: getListModificationRequestsQueryKey({ entityType, entityId, status: 'PENDING' }),
        });
        if (entityType === 'EVENT') {
            queryClient.invalidateQueries({ queryKey: getGetEventsEventIdQueryKey(entityId) });
            queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetUsersMeFollowingArtistsEventsQueryKey() });
        } else if (entityType === 'ARTIST') {
            queryClient.invalidateQueries({ queryKey: getGetArtistsArtistIdQueryKey(entityId) });
            queryClient.invalidateQueries({ queryKey: getGetArtistsQueryKey() });
        } else {
            queryClient.invalidateQueries({ queryKey: getGetVenuesVenueIdQueryKey(entityId) });
            queryClient.invalidateQueries({ queryKey: ['/venues'] });
        }
    };

    const onError = (err: unknown) => {
        toast.apiError(err, t('modRequest.actionFailed', '요청 처리에 실패했습니다.'));
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
        mutation: {
            onSuccess: (updatedReq) => {
                invalidateAll();
                if (updatedReq.status === 'APPLIED') {
                    toast.success(t('modRequest.appliedByCredit', '신용 점수가 기준에 도달하여 데이터가 수정되었습니다.'));
                } else if (updatedReq.trustCount >= 5 && updatedReq.trustScore <= -5) {
                    toast.info(t('modRequest.rejectedByCredit', '신용 점수가 낮아 수정 요청이 삭제되었습니다.'));
                }
            },
            onError,
        },
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
            if (gender && gender !== (initialValues?.gender ?? '')) {
                proposedData.gender = gender;
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

    const handleProposeClick = () => {
        if (onProposeEdit) {
            onProposeEdit();
            return;
        }
        setShowForm((v) => !v);
    };

    const requests = data?.requests ?? [];

    return (
            <div className="rounded-lg border border-border/70 bg-muted/10 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => setIsExpanded((v) => !v)}
                                aria-expanded={isExpanded}
                                className="flex items-center justify-between gap-2 flex-1 min-w-0 text-left group hover:opacity-85 transition-opacity cursor-pointer"
                                title={isExpanded ? t('entityInfo.collapse', '접기') : t('entityInfo.expand', '펼치기')}
                            >
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <FileEdit className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="text-xs font-semibold text-foreground truncate">
                                        {t('modRequest.title', '공인 데이터 수정 요청')}
                                    </span>
                                    <span
                                        className={cn(
                                            'inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums shrink-0',
                                            requests.length > 0
                                                ? 'bg-primary/15 text-primary'
                                                : 'bg-muted text-muted-foreground'
                                        )}
                                    >
                                        {requests.length}
                                    </span>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-foreground shrink-0">
                                    <span>
                                        {isExpanded
                                            ? t('entityInfo.collapse', '접기')
                                            : t('modRequest.collapsedHint', '펼치기')}
                                    </span>
                                    {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                </span>
                        </button>
                    </div>

                                    {isExpanded && (
                                        <div className="space-y-2 pt-1 border-t border-border/50 animate-in fade-in duration-150">
                                            {isAuthenticated && (
                                                <div className="flex justify-end">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2 text-xs gap-1"
                                                        onClick={handleProposeClick}
                                                    >
                                                        {!onProposeEdit && showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                                        <span>
                                                            {!onProposeEdit && showForm
                                                                ? t('common.cancel', '취소')
                                                                : t('modRequest.propose', '수정 요청')}
                                                        </span>
                                                    </Button>
                                                </div>
                                            )}

                                                        {!onProposeEdit && showForm && (
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
                                                                    <div>
                                                                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                                                            {t('artistForm.fields.gender', '성별')}
                                                                        </label>
                                                                        <div className="grid grid-cols-2 gap-1.5">
                                                                            {(['FEMALE', 'MALE'] as const).map((g) => (
                                                                                <Button
                                                                                    key={g}
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant={gender === g ? 'default' : 'outline'}
                                                                                    className="h-7 text-xs"
                                                                                    onClick={() => setGender(g)}
                                                                                >
                                                                                    {t(`artistForm.fields.genderOptions.${g}`, g)}
                                                                                </Button>
                                                                            ))}
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
                                const displayEntries = formatProposedEntries(
                                    entityType,
                                    req.proposedData,
                                    t,
                                    i18n.language
                                );

                                return (
                                    <div key={req.id} className="rounded-md border border-border/70 bg-background p-2 space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="space-y-0.5 text-xs">
                                                    {displayEntries.map((entry) => (
                                                        <div key={entry.key} className="break-words">
                                                            <span className="font-semibold text-muted-foreground">
                                                                {entry.label}:
                                                            </span>{' '}
                                                            <span className="font-medium text-foreground">
                                                                {entry.value}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {req.reason && (
                                                    <p className="text-[11px] text-muted-foreground break-words">
                                                        {req.reason}
                                                    </p>
                                                )}
                                                <div className="text-[10px] text-muted-foreground/80">
                                                    {req.authorDisplayName || t('common.anonymous', '익명')}
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
                                                    title={isMine ? t('credit.selfVoteNotAllowed', '작성자는 본인의 데이터에 투표할 수 없습니다.') : undefined}
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
                                                    title={isMine ? t('credit.selfVoteNotAllowed', '작성자는 본인의 데이터에 투표할 수 없습니다.') : undefined}
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
            )}
                                                                </div>
                                                                );
}
