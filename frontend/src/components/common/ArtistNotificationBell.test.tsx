import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/config';
import { useEventStore } from '../../store/useEventStore';
import { ArtistNotificationBell } from './ArtistNotificationBell';
import type { GetUsersMeFollowingArtistsEvents200 } from '../../api/generated/model';

const mockNavigate = jest.fn();
let mockPathname = '/';
let mockIsAuthenticated = true;

jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname, search: '' }),
}));

jest.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

let mockFeedData: GetUsersMeFollowingArtistsEvents200 | undefined;
const mockRefetch = jest.fn();
const mockMarkReadMutate = jest.fn();
const mockCapturedMutationOptions: { current?: any } = {};

jest.mock('../../api/generated/user/user', () => ({
    getGetUsersMeFollowingArtistsEventsQueryKey: (params?: unknown) =>
        params ? ['/users/me/following-artists/events', params] : ['/users/me/following-artists/events'],
    useGetUsersMeFollowingArtistsEvents: () => ({
        data: mockFeedData,
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: mockRefetch,
    }),
    usePostUsersMeFollowingArtistsEventsRead: (options?: any) => {
        mockCapturedMutationOptions.current = options;
        return {
            isPending: false,
            mutate: (vars: any) => {
                mockMarkReadMutate(vars);
                options?.mutation?.onMutate?.(vars);
                options?.mutation?.onSettled?.();
            },
        };
    },
}));

describe('ArtistNotificationBell', () => {
    beforeAll(() => {
        if (typeof globalThis.ResizeObserver === 'undefined') {
            globalThis.ResizeObserver = class {
                observe() {}
                unobserve() {}
                disconnect() {}
            } as unknown as typeof ResizeObserver;
        }
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        mockIsAuthenticated = true;
        mockPathname = '/';
        useEventStore.setState({ selectedEvent: null, mapCenterTarget: null, mapBounds: null });
        await i18n.changeLanguage('ko');

        mockFeedData = {
            checkedAt: '2026-11-10T03:00:00.123456Z',
            fetchedAt: '2026-11-12T06:00:00.654321Z',
            unreadCount: 2,
            events: [
                {
                    id: 'event-1',
                    title: 'YOASOBI Dome Tour',
                    venueId: 'venue-1',
                    venueName: 'Tokyo Dome',
                    latitude: 35.7056,
                    longitude: 139.7519,
                    startTime: '2026-11-20T09:00:00Z',
                    endTime: '2026-11-20T12:00:00Z',
                    createdAt: '2026-11-12T05:00:00Z',
                    matchedArtistNames: ['YOASOBI'],
                    topArtistName: 'YOASOBI',
                    status: 'APPROVED',
                },
                {
                    id: 'event-2',
                    title: 'Winter Fes Day 1',
                    venueId: 'venue-2',
                    venueName: 'Makuhari Messe',
                    latitude: 35.6483,
                    longitude: 140.0347,
                    startTime: '2026-11-22T09:00:00Z',
                    endTime: '2026-11-22T12:00:00Z',
                    createdAt: '2026-11-11T10:00:00Z',
                    matchedArtistNames: ['Perfume', 'Ado'],
                    topArtistName: 'Perfume',
                    status: 'APPROVED',
                },
            ],
        };
    });

    const renderBell = () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        queryClient.setQueryData(
            ['/users/me/following-artists/events', { unreadOnly: true, limit: 30 }],
            mockFeedData
        );
        return render(
            <QueryClientProvider client={queryClient}>
                <I18nextProvider i18n={i18n}>
                    <ArtistNotificationBell />
                </I18nextProvider>
            </QueryClientProvider>
        );
    };

    it('does not render when user is unauthenticated', () => {
        mockIsAuthenticated = false;
        const { container } = renderBell();
        expect(container).toBeEmptyDOMElement();
    });

    it('shows unread count badge (and 99+ cap) and renders viewAllNew item at top when unread > 0', () => {
        mockFeedData = { ...mockFeedData!, unreadCount: 120 };
        renderBell();

        const badge = screen.getByTestId('notification-unread-badge');
        expect(badge).toHaveTextContent('99+');

        fireEvent.click(screen.getByRole('button', { name: '신규 이벤트 알림' }));

        const viewAllBtn = screen.getByRole('button', { name: /전체 신규 이벤트 확인/ });
        const firstEventBtn = screen.getByRole('button', { name: /YOASOBI Dome Tour/ });

        // '전체 신규 이벤트 확인' appears before the event list items
        expect(
            viewAllBtn.compareDocumentPosition(firstEventBtn) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(screen.getByText('Perfume, Ado')).toBeInTheDocument();
        expect(screen.getByText('Tokyo Dome')).toBeInTheDocument();
    });

    it('hides viewAllNew item and shows empty state when unread count is 0', () => {
        mockFeedData = {
            checkedAt: '2026-11-12T06:00:00Z',
            fetchedAt: '2026-11-12T06:00:00Z',
            unreadCount: 0,
            events: [],
        };
        renderBell();

        expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '신규 이벤트 알림' }));

        expect(screen.queryByRole('button', { name: /전체 신규 이벤트 확인/ })).not.toBeInTheDocument();
        expect(screen.getByText('새로운 이벤트 알림이 없습니다.')).toBeInTheDocument();
    });

    it('selects clicked event for left sidebar detail without marking all as read (방안 A)', async () => {
        mockPathname = '/auth/x/callback';
        renderBell();

        fireEvent.click(screen.getByRole('button', { name: '신규 이벤트 알림' }));
        fireEvent.click(screen.getByRole('button', { name: /YOASOBI Dome Tour/ }));

        await waitFor(() => {
            expect(useEventStore.getState().selectedEvent?.id).toBe('event-1');
        });
        expect(useEventStore.getState().selectedEvent?.venueName).toBe('Tokyo Dome');
        expect(mockMarkReadMutate).not.toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('marks read with fetchedAt snapshot and navigates map/sidebar with checkedAt on viewAllNew click', async () => {
        useEventStore.getState().selectEvent({ id: 'event-1', title: 'Old Selection' });
        renderBell();

        fireEvent.click(screen.getByRole('button', { name: '신규 이벤트 알림' }));
        fireEvent.click(screen.getByRole('button', { name: /전체 신규 이벤트 확인/ }));

        await waitFor(() => {
            expect(mockMarkReadMutate).toHaveBeenCalledWith({
                data: { readBefore: '2026-11-12T06:00:00.654321Z' },
            });
        });

        expect(useEventStore.getState().selectedEvent).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith(
            '/?followingArtists=true&newEventsSince=2026-11-10T03%3A00%3A00.123456Z',
            { replace: true }
        );
    });
});

