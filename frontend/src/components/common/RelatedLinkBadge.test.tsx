import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
    parseRelatedLink,
    RelatedLinkBadge,
    RelatedLinkInputBadge,
} from './RelatedLinkBadge';

describe('RelatedLinkBadge and domain parsing', () => {
    it.each([
        ['https://t.pia.jp/pia/event.do?eventCd=123', 'チケットぴあ', 'bg-sky-500/10'],
        ['https://w.pia.jp/t/example/', 'チケットぴあ', 'bg-sky-500/10'],
        ['https://pia.jp/v/example', 'チケットぴあ', 'bg-sky-500/10'],
        ['https://eplus.jp/sf/detail/12345', 'e+ (イープラス)', 'bg-pink-500/10'],
        ['https://sp.eplus.jp/sf/detail/12345', 'e+ (イープラス)', 'bg-pink-500/10'],
        ['https://l-tike.com/concert/mevent/', 'ローチケ', 'bg-blue-600/10'],
        ['https://www.l-tike.com/order/', 'ローチケ', 'bg-blue-600/10'],
        ['https://tiget.net/events/12345', 'TIGET', 'bg-orange-500/10'],
        ['https://t.livepocket.jp/e/abcde', 'LivePocket', 'bg-emerald-500/10'],
        ['https://livepocket.jp/e/abcde', 'LivePocket', 'bg-emerald-500/10'],
        ['https://x.com/eventer_map/status/1', 'X', 'bg-neutral-900/10'],
        ['https://twitter.com/eventer_map', 'X', 'bg-neutral-900/10'],
    ])('recognizes %s as %s', (url, expectedLabel, expectedClass) => {
        const parsed = parseRelatedLink(url);
        expect(parsed).not.toBeNull();
        expect(parsed?.isKnownProvider).toBe(true);
        expect(parsed?.label).toBe(expectedLabel);
        expect(parsed?.badgeClassName).toContain(expectedClass);
    });

    it('treats unknown domains as general external links and strips www.', () => {
        const parsed = parseRelatedLink('https://www.example.com/events/1');
        expect(parsed).not.toBeNull();
        expect(parsed?.isKnownProvider).toBe(false);
        expect(parsed?.label).toBe('example.com');
        expect(parsed?.iconType).toBe('external');
    });

    it('rejects domain spoofing via prefix or suffix tricks', () => {
        const prefixSpoof = parseRelatedLink('https://pia.jp.evil.com/phish');
        expect(prefixSpoof?.isKnownProvider).toBe(false);
        expect(prefixSpoof?.label).toBe('pia.jp.evil.com');

        const suffixSpoof = parseRelatedLink('https://my-eplus.jp/fake');
        expect(suffixSpoof?.isKnownProvider).toBe(false);
        expect(suffixSpoof?.label).toBe('my-eplus.jp');
    });

    it('blocks unsafe protocols and invalid URLs', () => {
        expect(parseRelatedLink('javascript:alert(1)')).toBeNull();
        expect(parseRelatedLink('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(parseRelatedLink('not a url')).toBeNull();
        expect(parseRelatedLink('')).toBeNull();

        const { container } = render(<RelatedLinkBadge url="javascript:alert(1)" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders RelatedLinkBadge with safe external attributes', () => {
        render(<RelatedLinkBadge url="https://eplus.jp/sf/detail/999" />);
        const anchor = screen.getByRole('link', { name: 'e+ (イープラス)' });
        expect(anchor).toHaveAttribute('href', 'https://eplus.jp/sf/detail/999');
        expect(anchor).toHaveAttribute('target', '_blank');
        expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
        expect(anchor).toHaveClass('bg-pink-500/10');
    });

    it('renders RelatedLinkInputBadge only for known providers', () => {
        const { rerender, container } = render(
            <RelatedLinkInputBadge url="https://t.pia.jp/pia/event.do" />
        );
        expect(screen.getByText('チケットぴあ')).toBeInTheDocument();

        rerender(<RelatedLinkInputBadge url="https://example.com/event" />);
        expect(container).toBeEmptyDOMElement();
    });
});
