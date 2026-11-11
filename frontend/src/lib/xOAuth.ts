export type XOAuthMode = 'login' | 'link' | 'reauth';

export interface XOAuthResult {
    code: string;
    state: string;
}

export interface PendingXOAuth {
    mode: XOAuthMode;
    state: string;
    startedAt: number;
}

export interface XOAuthBroadcastMessage {
    type: 'x-oauth-callback' | 'x-oauth-ack';
    state: string;
    code?: string;
    error?: string;
    errorDescription?: string;
}

export const X_OAUTH_CHANNEL = 'eventer-map-x-oauth';
const X_OAUTH_PENDING_KEY = 'eventer_x_oauth_pending';
const PENDING_TTL_MS = 10 * 60 * 1000;
const ALLOWED_X_AUTHORIZE_HOSTS = new Set(['x.com', 'twitter.com']);

export class XOAuthCancelledError extends Error {
    constructor(message = 'X OAuth was cancelled') {
        super(message);
        this.name = 'XOAuthCancelledError';
    }
}

export class XOAuthRedirectStartedError extends Error {
    constructor() {
        super('Redirecting to X authorization page');
        this.name = 'XOAuthRedirectStartedError';
    }
}

export function isAllowedXAuthorizeUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        return parsed.protocol === 'https:' && ALLOWED_X_AUTHORIZE_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
}

function validateAndExtractState(authorizeUrl: string): string {
    if (!isAllowedXAuthorizeUrl(authorizeUrl)) {
        throw new Error('Invalid X authorization URL');
    }
    const parsed = new URL(authorizeUrl);
    const state = parsed.searchParams.get('state');
    if (!state) {
        throw new Error('Missing state parameter in X authorization URL');
    }
    return state;
}

export function savePendingXOAuth(pending: PendingXOAuth): void {
    try {
        sessionStorage.setItem(X_OAUTH_PENDING_KEY, JSON.stringify(pending));
    } catch {
        // Ignore storage errors if blocked; callback will prompt user cleanly.
    }
}

export function peekPendingXOAuth(): PendingXOAuth | null {
    try {
        const raw = sessionStorage.getItem(X_OAUTH_PENDING_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PendingXOAuth;
        if (
            !parsed ||
            !parsed.state ||
            !parsed.mode ||
            typeof parsed.startedAt !== 'number' ||
            Date.now() - parsed.startedAt > PENDING_TTL_MS
        ) {
            sessionStorage.removeItem(X_OAUTH_PENDING_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function consumePendingXOAuth(): PendingXOAuth | null {
    const pending = peekPendingXOAuth();
    try {
        sessionStorage.removeItem(X_OAUTH_PENDING_KEY);
    } catch {
        // Ignore
    }
    return pending;
}

/**
 * Initiates X OAuth 2.0 flow using a popup + BroadcastChannel (resistant to COOP),
 * falling back to full-page redirect if popups are blocked or BroadcastChannel is unavailable.
 */
export async function startXOAuthFlow(
    mode: XOAuthMode,
    fetchAuthorizeUrl: () => Promise<string>
): Promise<XOAuthResult> {
    if (typeof window === 'undefined') {
        throw new Error('X OAuth requires a browser environment');
    }

    const supportsBroadcast = typeof BroadcastChannel !== 'undefined';
    let popup: Window | null = null;

    // Open blank popup synchronously inside the user gesture to avoid popup blockers.
    if (supportsBroadcast) {
        const width = 520;
        const height = 680;
        const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
        const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
        popup = window.open(
            '',
            'eventer-map-x-oauth',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
    }

    // Popup blocked or BroadcastChannel unsupported -> fall back to full-page redirect.
    if (!supportsBroadcast || !popup || popup.closed) {
        const authorizeUrl = await fetchAuthorizeUrl();
        const state = validateAndExtractState(authorizeUrl);
        savePendingXOAuth({ mode, state, startedAt: Date.now() });
        window.location.assign(authorizeUrl);
        throw new XOAuthRedirectStartedError();
    }

    let authorizeUrl: string;
    let expectedState: string;
    try {
        authorizeUrl = await fetchAuthorizeUrl();
        expectedState = validateAndExtractState(authorizeUrl);
    } catch (err) {
        try {
            if (!popup.closed) popup.close();
        } catch {
            // Ignore
        }
        throw err;
    }

    if (popup.closed) {
        throw new XOAuthCancelledError();
    }

    return new Promise<XOAuthResult>((resolve, reject) => {
        const channel = new BroadcastChannel(X_OAUTH_CHANNEL);
        let settled = false;
        let closeGraceTimer: ReturnType<typeof setTimeout> | null = null;
        let expiryTimer: ReturnType<typeof setTimeout> | null = null;
        let closedPollTimer: ReturnType<typeof setInterval> | null = null;

        const cleanup = () => {
            if (closeGraceTimer) clearTimeout(closeGraceTimer);
            if (expiryTimer) clearTimeout(expiryTimer);
            if (closedPollTimer) clearInterval(closedPollTimer);
            channel.close();
        };

        const finishResolve = (result: XOAuthResult) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(result);
        };

        const finishReject = (err: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(err);
        };

        channel.onmessage = (event: MessageEvent<XOAuthBroadcastMessage>) => {
            const msg = event.data;
            if (!msg || msg.type !== 'x-oauth-callback' || msg.state !== expectedState) {
                return;
            }

            try {
                channel.postMessage({
                    type: 'x-oauth-ack',
                    state: expectedState,
                } satisfies XOAuthBroadcastMessage);
            } catch {
                // Ignore ack errors
            }

            try {
                if (popup && !popup.closed) popup.close();
            } catch {
                // Ignore
            }

            if (msg.error) {
                if (msg.error === 'access_denied') {
                    finishReject(new XOAuthCancelledError());
                } else {
                    finishReject(new Error(msg.errorDescription || msg.error));
                }
                return;
            }

            if (!msg.code) {
                finishReject(new Error('Missing authorization code from X callback'));
                return;
            }

            finishResolve({ code: msg.code, state: msg.state });
        };

        closedPollTimer = setInterval(() => {
            if (popup && popup.closed && !settled && !closeGraceTimer) {
                // Allow brief grace window in case BroadcastChannel message arrives simultaneously.
                closeGraceTimer = setTimeout(() => {
                    finishReject(new XOAuthCancelledError());
                }, 300);
            }
        }, 350);

        expiryTimer = setTimeout(() => {
            try {
                if (popup && !popup.closed) popup.close();
            } catch {
                // Ignore
            }
            finishReject(new Error('X authentication timed out'));
        }, PENDING_TTL_MS);

        popup.location.href = authorizeUrl;
    });
}

