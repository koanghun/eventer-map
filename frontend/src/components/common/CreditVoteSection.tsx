import { ThumbsDown, ThumbsUp, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../store/useToastStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
    getGetEventsEventIdQueryKey,
    getGetEventsQueryKey,
    usePutEventsEventIdCredit,
} from '../../api/generated/events/events';
import {
    getGetArtistsArtistIdQueryKey,
    getGetArtistsQueryKey,
    usePutArtistsArtistIdCredit,
} from '../../api/generated/artists/artists';
import {
    getGetVenuesVenueIdQueryKey,
    usePutVenuesVenueIdCredit,
} from '../../api/generated/venues/venues';
import type { ModificationEntityType } from '../../api/generated/model';

interface CreditVoteSectionProps {
    entityType: ModificationEntityType;
    entityId: string;
    status?: string;
    authorId?: string | null;
    creditScore?: number;
    creditCount?: number;
    myCreditScore?: number;
    highCreditSince?: string | null;
    lowCreditSince?: string | null;
}

export function CreditVoteSection({
    entityType,
    entityId,
    status,
    authorId,
    creditScore = 0,
    creditCount = 0,
    myCreditScore = 0,
    highCreditSince,
    lowCreditSince,
}: CreditVoteSectionProps) {
    const { t } = useTranslation();
    const { isAuthenticated, user } = useAuth();
    const queryClient = useQueryClient();

    const invalidate = () => {
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
        toast.error(msg || t('credit.voteFailed', '신용 점수 투표에 실패했습니다.'));
    };

    const eventCreditMutation = usePutEventsEventIdCredit({
        mutation: { onSuccess: invalidate, onError },
    });
    const artistCreditMutation = usePutArtistsArtistIdCredit({
        mutation: { onSuccess: invalidate, onError },
    });
    const venueCreditMutation = usePutVenuesVenueIdCredit({
        mutation: { onSuccess: invalidate, onError },
    });

    const isPending =
        eventCreditMutation.isPending ||
        artistCreditMutation.isPending ||
        venueCreditMutation.isPending;

    const isAuthor = Boolean(user?.id && authorId && user.id === authorId);

    const handleVote = (targetScore: 1 | -1) => {
        if (!isAuthenticated) {
            toast.info(t('common.loginRequired', '로그인이 필요합니다.'));
            return;
        }
        if (isAuthor) {
            toast.info(t('credit.selfVoteNotAllowed', '작성자는 본인의 데이터에 투표할 수 없습니다.'));
            return;
        }
        const nextScore = myCreditScore === targetScore ? 0 : targetScore;
        if (entityType === 'EVENT') {
            eventCreditMutation.mutate({ eventId: entityId, data: { score: nextScore } });
        } else if (entityType === 'ARTIST') {
            artistCreditMutation.mutate({ artistId: entityId, data: { score: nextScore } });
        } else {
            venueCreditMutation.mutate({ venueId: entityId, data: { score: nextScore } });
        }
    };

    return (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-foreground">
                        {t('credit.title', '데이터 신용 점수')}
                    </span>
                    <span
                        className={cn(
                            'text-xs font-bold tabular-nums px-1.5 py-0.5 rounded',
                            creditScore > 0
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : creditScore < 0
                                  ? 'bg-destructive/15 text-destructive'
                                  : 'bg-muted text-muted-foreground'
                        )}
                    >
                        {creditScore > 0 ? `+${creditScore}` : creditScore}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                        ({t('credit.votesCount', { count: creditCount, defaultValue: '{{count}}표' })})
                    </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        type="button"
                        size="sm"
                        variant={myCreditScore === 1 ? 'default' : 'outline'}
                        disabled={isPending || isAuthor}
                        onClick={() => handleVote(1)}
                        className="h-7 px-2 text-xs gap-1"
                        title={isAuthor ? t('credit.selfVoteNotAllowed', '작성자는 본인의 데이터에 투표할 수 없습니다.') : undefined}
                    >
                        <ThumbsUp className="w-3 h-3" />
                        <span>+1</span>
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={myCreditScore === -1 ? 'destructive' : 'outline'}
                        disabled={isPending || isAuthor}
                        onClick={() => handleVote(-1)}
                        className="h-7 px-2 text-xs gap-1"
                        title={isAuthor ? t('credit.selfVoteNotAllowed', '작성자는 본인의 데이터에 투표할 수 없습니다.') : undefined}
                    >
                        <ThumbsDown className="w-3 h-3" />
                        <span>-1</span>
                    </Button>
                </div>
            </div>

            {status === 'PENDING' && highCreditSince && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('credit.promotePending', '높은 신용 점수가 24시간 유지되면 자동으로 공인 데이터로 승격됩니다.')}</span>
                </div>
            )}

            {status === 'PENDING' && lowCreditSince && (
                <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('credit.deletePending', '낮은 신용 점수가 24시간 유지되면 자동으로 삭제됩니다.')}</span>
                </div>
            )}
        </div>
    );
}
