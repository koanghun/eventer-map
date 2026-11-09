import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useInfiniteQuery, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO, isValid, type Locale } from 'date-fns';
import { enUS, ja, ko, zhCN } from 'date-fns/locale';
import { Award, Loader2, MessageSquare, ThumbsUp, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../store/useToastStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
    listEventThreads,
    getListEventThreadsQueryKey,
    useCreateEventThread,
    useDeleteEventThread,
    useRecommendEventThread,
    useUnrecommendEventThread,
} from '../../api/generated/threads/threads';
import type { EventThread, EventThreadListResponse } from '../../api/generated/model';

// 백엔드(service.MaxThreadContentLength) 및 OpenAPI maxLength 와 동일
const MAX_CONTENT_LENGTH = 1000;
const PAGE_SIZE = 20;
// 상위 랭크 + 최소 추천 수를 만족하면 BEST 배지 표시
const BEST_RANK_LIMIT = 3;
const BEST_MIN_RECOMMENDS = 3;

type ThreadPages = InfiniteData<EventThreadListResponse, string | undefined>;

const dateLocales: Record<string, Locale> = { ko, ja, en: enUS, zh: zhCN };

/** 무한 쿼리 캐시 내 특정 스레드를 갱신하는 헬퍼 */
function updateThreadInPages(
    data: ThreadPages | undefined,
    threadId: string,
    updater: (t: EventThread) => EventThread | null,
): ThreadPages | undefined {
    if (!data) return data;
    return {
        ...data,
        pages: data.pages.map((page) => ({
            ...page,
            threads: page.threads.flatMap((t) => {
                if (t.id !== threadId) return [t];
                const next = updater(t);
                return next ? [next] : [];
            }),
        })),
    };
}

interface EventThreadSectionProps {
    eventId: string;
}

export default function EventThreadSection({ eventId }: EventThreadSectionProps) {
    const { t, i18n } = useTranslation();
    const { isAuthenticated } = useAuth();

    const threadsQueryKey = useMemo(
            () => getListEventThreadsQueryKey(eventId, { limit: PAGE_SIZE }),
            [eventId],
        );

    const threadsQuery = useInfiniteQuery({
        queryKey: threadsQueryKey,
        queryFn: ({ pageParam, signal }) =>
            listEventThreads(eventId, { limit: PAGE_SIZE, cursor: pageParam }, undefined, signal),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: EventThreadListResponse) => lastPage.nextCursor ?? undefined,
        enabled: !!eventId,
    });

    // 페이지 경계에서 순위가 바뀌어 중복 수신되는 경우를 대비해 id 기준 중복 제거
    const threads = useMemo(() => {
        const seen = new Set<string>();
        const result: EventThread[] = [];
        for (const page of threadsQuery.data?.pages ?? []) {
            for (const thread of page.threads) {
                if (seen.has(thread.id)) continue;
                seen.add(thread.id);
                result.push(thread);
            }
        }
        return result;
    }, [threadsQuery.data]);

    const dateLocale = dateLocales[(i18n.language || 'ko').split('-')[0]] ?? ko;

    return (
        <section className="border-t border-border/50 pt-5" aria-labelledby="event-thread-title">
            <h3 id="event-thread-title" className="font-bold text-foreground mb-1 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                {t('eventDetail.thread.title', '스레드')}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
                {t('eventDetail.thread.description', '추천을 많이 받은 스레드가 위에 표시됩니다.')}
            </p>

            <ThreadComposer
                eventId={eventId}
                isAuthenticated={isAuthenticated}
                threadsQueryKey={threadsQueryKey}
            />

            <div className="mt-4 space-y-3">
                {threadsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('eventDetail.thread.loading', '스레드를 불러오는 중...')}
                    </div>
                ) : threadsQuery.isError ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                        {t('eventDetail.thread.loadFailed', '스레드를 불러오지 못했습니다.')}
                        <Button type="button" variant="outline" size="sm" onClick={() => threadsQuery.refetch()}>
                            {t('eventDetail.thread.retry', '다시 시도')}
                        </Button>
                    </div>
                ) : threads.length === 0 ? (
                    <div className="bg-muted/20 border border-dashed border-border/80 rounded-xl py-8 px-4 text-center text-sm text-muted-foreground">
                        {t('eventDetail.thread.empty', '아직 스레드가 없습니다. 첫 번째 정보를 공유해 보세요!')}
                    </div>
                ) : (
                    <>
                        <ul className="space-y-3">
                            {threads.map((thread, idx) => (
                                <ThreadItem
                                    key={thread.id}
                                    thread={thread}
                                    isBest={idx < BEST_RANK_LIMIT && thread.recommendCount >= BEST_MIN_RECOMMENDS}
                                    isAuthenticated={isAuthenticated}
                                    threadsQueryKey={threadsQueryKey}
                                    dateLocale={dateLocale}
                                />
                            ))}
                        </ul>
                        {threadsQuery.hasNextPage && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full"
                                disabled={threadsQuery.isFetchingNextPage}
                                onClick={() => threadsQuery.fetchNextPage()}
                            >
                                {threadsQuery.isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('eventDetail.thread.loadMore', '더 보기')}
                            </Button>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

interface ThreadComposerProps {
    eventId: string;
    isAuthenticated: boolean;
    threadsQueryKey: QueryKey;
}

function ThreadComposer({ eventId, isAuthenticated, threadsQueryKey }: ThreadComposerProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [content, setContent] = useState('');

    const createMutation = useCreateEventThread({
        mutation: {
            onSuccess: (created) => {
                setContent('');
                // 작성 직후 본인 글을 바로 확인할 수 있도록 첫 페이지 상단에 삽입 (정렬은 다음 조회 시 서버 기준으로 재반영)
                queryClient.setQueryData<ThreadPages>(threadsQueryKey, (old) => {
                    if (!old || old.pages.length === 0) return old;
                    const [first, ...rest] = old.pages;
                    return { ...old, pages: [{ ...first, threads: [created, ...first.threads] }, ...rest] };
                });
                toast.success(t('eventDetail.thread.created', '스레드가 등록되었습니다.'));
            },
            onError: (err) => {
                toast.apiError(err, t('eventDetail.thread.createFailed', '스레드 등록에 실패했습니다.'));
            },
        },
    });

    if (!isAuthenticated) {
        return (
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {t('eventDetail.thread.loginToWrite', '로그인 후 스레드를 작성할 수 있습니다.')}
            </div>
        );
    }

    const trimmedLength = content.trim().length;
    const length = content.length;
    const isOverLimit = length > MAX_CONTENT_LENGTH;
    const canSubmit = trimmedLength > 0 && !isOverLimit && !createMutation.isPending;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        createMutation.mutate({ eventId, data: { content: content.trim() } });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t(
                    'eventDetail.thread.placeholder',
                    '이벤트에 대한 추가 정보나 의견을 자유롭게 남겨주세요. (예: 굿즈 판매 시간, 입장 팁, 후기)',
                )}
                aria-label={t('eventDetail.thread.placeholder', '스레드 내용')}
                maxLength={MAX_CONTENT_LENGTH}
                rows={3}
                className="resize-none"
                disabled={createMutation.isPending}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e);
                }}
            />
            <div className="flex items-center justify-between">
                <span className={cn('text-xs', isOverLimit ? 'text-destructive' : 'text-muted-foreground')}>
                    {length} / {MAX_CONTENT_LENGTH}
                </span>
                <Button type="submit" size="sm" disabled={!canSubmit}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('eventDetail.thread.submit', '등록')}
                </Button>
            </div>
        </form>
    );
}

interface ThreadItemProps {
    thread: EventThread;
    isBest: boolean;
    isAuthenticated: boolean;
    threadsQueryKey: QueryKey;
    dateLocale: Locale;
}

interface RecommendContext {
    previous?: ThreadPages;
}

function ThreadItem({ thread, isBest, isAuthenticated, threadsQueryKey, dateLocale }: ThreadItemProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // 낙관적 업데이트: 추천 상태/카운트를 즉시 반영하고 실패 시 롤백.
    // 목록 재정렬은 사용자가 읽는 도중 항목이 튀지 않도록 다음 조회 시점에 서버 정렬로 반영합니다.
    const optimisticHandlers = (recommended: boolean) => ({
        onMutate: async (): Promise<RecommendContext> => {
            await queryClient.cancelQueries({ queryKey: threadsQueryKey });
            const previous = queryClient.getQueryData<ThreadPages>(threadsQueryKey);
            queryClient.setQueryData<ThreadPages>(threadsQueryKey, (old) =>
                updateThreadInPages(old, thread.id, (t) => ({
                    ...t,
                    isRecommended: recommended,
                    recommendCount: Math.max(0, t.recommendCount + (recommended ? 1 : -1)),
                })),
            );
            return { previous };
        },
        onError: (err: unknown, _vars: unknown, context: RecommendContext | undefined) => {
            if (context?.previous) {
                queryClient.setQueryData(threadsQueryKey, context.previous);
            }
            toast.apiError(err, t('eventDetail.thread.recommendFailed', '추천 처리에 실패했습니다.'));
        },
        onSuccess: (result: { recommended: boolean; recommendCount: number }) => {
            // 서버가 반환한 확정 값으로 보정
            queryClient.setQueryData<ThreadPages>(threadsQueryKey, (old) =>
                updateThreadInPages(old, thread.id, (t) => ({
                    ...t,
                    isRecommended: result.recommended,
                    recommendCount: result.recommendCount,
                })),
            );
        },
    });

    const recommendMutation = useRecommendEventThread<unknown, RecommendContext>({
        mutation: optimisticHandlers(true),
    });
    const unrecommendMutation = useUnrecommendEventThread<unknown, RecommendContext>({
        mutation: optimisticHandlers(false),
    });
    const isRecommendPending = recommendMutation.isPending || unrecommendMutation.isPending;

    const deleteMutation = useDeleteEventThread({
        mutation: {
            onSuccess: () => {
                queryClient.setQueryData<ThreadPages>(threadsQueryKey, (old) =>
                    updateThreadInPages(old, thread.id, () => null),
                );
                toast.success(t('eventDetail.thread.deleted', '스레드가 삭제되었습니다.'));
            },
            onError: (err) => {
                setConfirmingDelete(false);
                toast.apiError(err, t('eventDetail.thread.deleteFailed', '스레드 삭제에 실패했습니다.'));
            },
        },
    });

    const handleRecommend = () => {
        if (!isAuthenticated) {
            toast.info(t('auth.loginRequired', '로그인이 필요합니다'));
            return;
        }
        if (thread.isMine || isRecommendPending) return;
        if (thread.isRecommended) {
            unrecommendMutation.mutate({ threadId: thread.id });
        } else {
            recommendMutation.mutate({ threadId: thread.id });
        }
    };

    const createdAt = parseISO(thread.createdAt);
    const relativeTime = isValid(createdAt)
        ? formatDistanceToNow(createdAt, { addSuffix: true, locale: dateLocale })
        : '';
    const authorName = thread.author?.displayName || t('eventDetail.thread.unknownAuthor', '탈퇴한 사용자');

    return (
        <li
            className={cn(
                'rounded-xl border px-4 py-3 transition-colors',
                isBest ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card',
            )}
        >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                {isBest && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary">
                        <Award className="w-3 h-3" />
                        BEST
                    </span>
                )}
                <span className={cn('font-semibold truncate', thread.author ? 'text-foreground' : 'italic')}>
                    {authorName}
                </span>
                {thread.isMine && (
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                        {t('eventDetail.thread.mine', '내 글')}
                    </span>
                )}
                {relativeTime && (
                    <time dateTime={thread.createdAt} title={createdAt.toLocaleString()} className="shrink-0">
                        · {relativeTime}
                    </time>
                )}
            </div>

            {/* React JSX 자동 이스케이프로 렌더링 (HTML 해석 없음) */}
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{thread.content}</p>

            <div className="mt-2 flex items-center justify-between">
                <button
                    type="button"
                    onClick={handleRecommend}
                    disabled={thread.isMine || isRecommendPending}
                    aria-pressed={thread.isRecommended}
                    title={
                        thread.isMine
                            ? t('eventDetail.thread.cannotRecommendOwn', '본인 스레드는 추천할 수 없습니다')
                            : thread.isRecommended
                                ? t('eventDetail.thread.unrecommend', '추천 취소')
                                : t('eventDetail.thread.recommend', '추천')
                    }
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                        thread.isRecommended
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary',
                    )}
                >
                    <ThumbsUp className={cn('w-3.5 h-3.5', thread.isRecommended && 'fill-current')} />
                    <span>{thread.recommendCount}</span>
                </button>

                {thread.isMine &&
                    (confirmingDelete ? (
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground">
                                {t('eventDetail.thread.confirmDelete', '삭제할까요?')}
                            </span>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate({ threadId: thread.id })}
                            >
                                {deleteMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                {t('buttons.delete', '삭제')}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={deleteMutation.isPending}
                                onClick={() => setConfirmingDelete(false)}
                            >
                                {t('buttons.cancel', '취소')}
                            </Button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirmingDelete(true)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                            aria-label={t('eventDetail.thread.delete', '스레드 삭제')}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('buttons.delete', '삭제')}
                        </button>
                    ))}
            </div>
        </li>
    );
}
