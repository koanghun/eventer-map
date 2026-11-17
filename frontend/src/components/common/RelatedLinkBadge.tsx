import { ExternalLink, Ticket } from 'lucide-react';
import { cn, getSafeExternalUrl } from '../../lib/utils';

type LinkIconType = 'ticket' | 'x' | 'external';

interface LinkProviderRule {
    id: string;
    domains: string[];
    label: string;
    iconType: Exclude<LinkIconType, 'external'>;
    badgeClassName: string;
}

export interface ParsedRelatedLink {
    safeUrl: string;
    label: string;
    iconType: LinkIconType;
    badgeClassName: string;
    isKnownProvider: boolean;
}

const KNOWN_LINK_PROVIDERS: LinkProviderRule[] = [
    {
        id: 'pia',
        domains: ['pia.jp'],
        label: 'チケットぴあ',
        iconType: 'ticket',
        badgeClassName:
            'bg-sky-500/10 text-sky-700 border-sky-500/30 hover:bg-sky-500/20 dark:bg-sky-400/15 dark:text-sky-300 dark:border-sky-400/30',
    },
    {
        id: 'eplus',
        domains: ['eplus.jp'],
        label: 'e+ (イープラス)',
        iconType: 'ticket',
        badgeClassName:
            'bg-pink-500/10 text-pink-700 border-pink-500/30 hover:bg-pink-500/20 dark:bg-pink-400/15 dark:text-pink-300 dark:border-pink-400/30',
    },
    {
        id: 'lawson',
        domains: ['l-tike.com'],
        label: 'ローチケ',
        iconType: 'ticket',
        badgeClassName:
            'bg-blue-600/10 text-blue-700 border-blue-600/30 hover:bg-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-400/30',
    },
    {
        id: 'tiget',
        domains: ['tiget.net'],
        label: 'TIGET',
        iconType: 'ticket',
        badgeClassName:
            'bg-orange-500/10 text-orange-700 border-orange-500/30 hover:bg-orange-500/20 dark:bg-orange-400/15 dark:text-orange-300 dark:border-orange-400/30',
    },
    {
        id: 'livepocket',
        domains: ['livepocket.jp'],
        label: 'LivePocket',
        iconType: 'ticket',
        badgeClassName:
            'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20 dark:bg-emerald-400/15 dark:text-emerald-300 dark:border-emerald-400/30',
    },
    {
        id: 'x',
        domains: ['x.com', 'twitter.com'],
        label: 'X',
        iconType: 'x',
        badgeClassName:
            'bg-neutral-900/10 text-neutral-900 border-neutral-900/25 hover:bg-neutral-900/20 dark:bg-white/10 dark:text-neutral-100 dark:border-white/25',
    },
];

const DEFAULT_BADGE_CLASS =
    'bg-muted/60 text-foreground border-border hover:bg-muted hover:text-primary';

function matchesDomain(hostname: string, domain: string): boolean {
    return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Validate an external link URL and map known ticket/social domains to their badge styling.
 */
export function parseRelatedLink(rawUrl?: string | null): ParsedRelatedLink | null {
    const safeUrl = getSafeExternalUrl(rawUrl);
    if (!safeUrl) return null;

    let hostname = '';
    try {
        hostname = new URL(safeUrl).hostname.toLowerCase().replace(/\.+$/, '');
    } catch {
        return null;
    }

    const provider = KNOWN_LINK_PROVIDERS.find((rule) =>
        rule.domains.some((domain) => matchesDomain(hostname, domain))
    );

    if (provider) {
        return {
            safeUrl,
            label: provider.label,
            iconType: provider.iconType,
            badgeClassName: provider.badgeClassName,
            isKnownProvider: true,
        };
    }

    return {
        safeUrl,
        label: hostname.replace(/^www\./, '') || safeUrl,
        iconType: 'external',
        badgeClassName: DEFAULT_BADGE_CLASS,
        isKnownProvider: false,
    };
}

function RelatedLinkIcon({
    iconType,
    className,
}: {
    iconType: LinkIconType;
    className?: string;
}) {
    if (iconType === 'ticket') {
        return <Ticket className={cn('shrink-0', className)} aria-hidden="true" />;
    }
    if (iconType === 'x') {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className={cn('shrink-0', className)}
            >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        );
    }
    return <ExternalLink className={cn('shrink-0', className)} aria-hidden="true" />;
}

interface RelatedLinkBadgeProps {
    url: string;
    className?: string;
}

export function RelatedLinkBadge({ url, className }: RelatedLinkBadgeProps) {
    const parsed = parseRelatedLink(url);
    if (!parsed) return null;

    return (
        <a
            href={parsed.safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={parsed.safeUrl}
            className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors max-w-full',
                parsed.badgeClassName,
                className
            )}
        >
            <RelatedLinkIcon iconType={parsed.iconType} className="w-3.5 h-3.5" />
            <span className="truncate">{parsed.label}</span>
            {parsed.isKnownProvider && (
                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" aria-hidden="true" />
            )}
        </a>
    );
}

export function RelatedLinkInputBadge({ url, className }: RelatedLinkBadgeProps) {
    const parsed = parseRelatedLink(url);
    if (!parsed || !parsed.isKnownProvider) return null;

    return (
        <span
            className={cn(
                'pointer-events-none inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold leading-none whitespace-nowrap',
                parsed.badgeClassName,
                className
            )}
        >
            <RelatedLinkIcon iconType={parsed.iconType} className="w-3 h-3" />
            <span>{parsed.label}</span>
        </span>
    );
}
