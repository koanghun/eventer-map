import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validate external URLs to allow only http/https protocols and block XSS schemes (e.g. javascript:, data:).
 */
export function getSafeExternalUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

const LOCALE_MAP: Record<string, string> = {
  ko: 'ko-KR',
  ja: 'ja-JP',
  en: 'en-US',
  zh: 'zh-CN',
};

export function getLocaleTag(lang?: string): string {
  const prefix = lang?.toLowerCase().split('-')[0];
  return (prefix && LOCALE_MAP[prefix]) || 'ja-JP';
}

export function isValidEventTime(iso?: string | null): iso is string {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getSeconds() !== 59;
}

export function getEventDateObj(
  event?: { date?: string; startTime?: string; openingTime?: string; endTime?: string } | null
): Date | null {
  if (!event) return null;
  if (event.date && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
    const parsed = new Date(`${event.date}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const iso = event.startTime || event.openingTime || event.endTime;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatLocalizedDate(
  event: { date?: string; startTime?: string; openingTime?: string; endTime?: string } | null | undefined,
  lang?: string,
  includeYear = true
): string | null {
  const dateObj = getEventDateObj(event);
  if (!dateObj) return null;
  return dateObj.toLocaleDateString(
    getLocaleTag(lang),
    includeYear
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric' }
  );
}

export function formatLocalizedDateTime(
  iso?: string | null,
  lang?: string,
  includeYear = false
): string | null {
  if (!isValidEventTime(iso)) return null;
  return new Date(iso).toLocaleString(getLocaleTag(lang), {
    ...(includeYear ? { year: 'numeric' } : {}),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatLocalizedTime(iso?: string | null, lang?: string): string | null {
  if (!isValidEventTime(iso)) return null;
  return new Date(iso).toLocaleTimeString(getLocaleTag(lang), {
    hour: '2-digit',
    minute: '2-digit',
  });
}
