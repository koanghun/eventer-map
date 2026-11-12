import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/config';
import { ArtistInfoCard, FollowingArtistsInfoCard } from './EntityInfoCard';

jest.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true }),
}));

const mockFollowingArtists = [
    { id: 'artist-1', officialName: 'YOASOBI', rating: 4.8 },
    { id: 'artist-2', officialName: 'Perfume', rating: 4.9 },
];

jest.mock('../../api/generated/user/user', () => ({
    getGetUsersMeFollowingArtistsQueryKey: () => ['/users/me/following-artists'],
    useGetUsersMeFollowingArtists: () => ({
        data: mockFollowingArtists,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
    }),
}));

const mockUnfollowMutate = jest.fn();

jest.mock('../../api/generated/artists/artists', () => ({
    getGetArtistsArtistIdFollowersQueryKey: (id: string) => [`/artists/${id}/followers`],
    useGetArtistsArtistIdFollowers: () => ({ data: [] }),
    usePostArtistsArtistIdFollow: () => ({ isPending: false, mutate: jest.fn() }),
    useDeleteArtistsArtistIdFollow: () => ({ isPending: false, mutate: mockUnfollowMutate }),
}));

jest.mock('../../api/generated/events/events', () => ({
    getGetEventsQueryKey: () => ['/events'],
}));

describe('EntityInfoCard collapse behavior for single vs multiple artists', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await i18n.changeLanguage('ko');
    });

    const renderWithProviders = (ui: React.ReactElement) => {
        const queryClient = new QueryClient();
        return render(
            <QueryClientProvider client={queryClient}>
                <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
            </QueryClientProvider>
        );
    };

    it('renders FollowingArtistsInfoCard collapsed/hidden by default and expands on click', () => {
        const onSelectArtist = jest.fn();
        renderWithProviders(
            <FollowingArtistsInfoCard resetKey="following" onSelectArtist={onSelectArtist} />
        );

        const toggleBtn = screen.getByRole('button', { name: /출연자 정보/ });
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('YOASOBI')).not.toBeInTheDocument();
        expect(screen.queryByText('Perfume')).not.toBeInTheDocument();

        fireEvent.click(toggleBtn);

        expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('YOASOBI')).toBeInTheDocument();
        expect(screen.getByText('Perfume')).toBeInTheDocument();

        fireEvent.click(screen.getByText('YOASOBI'));
        expect(onSelectArtist).toHaveBeenCalledWith({ id: 'artist-1', name: 'YOASOBI' });
    });

    it('renders single ArtistInfoCard expanded by default', () => {
        renderWithProviders(
            <ArtistInfoCard
                artistId="artist-1"
                artist={{ id: 'artist-1', officialName: 'YOASOBI', status: 'APPROVED' } as any}
                isLoading={false}
                isError={false}
            />
        );

        const toggleBtn = screen.getByRole('button', { name: /출연자 정보/ });
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('YOASOBI')).toBeInTheDocument();

        fireEvent.click(toggleBtn);
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('YOASOBI')).not.toBeInTheDocument();
    });
});

