import i18n from '../i18n/config';

/**
 * Returns a localized message for an API error that carries a `code`
 * (e.g. `USER_EXISTS`). Returns undefined when no translation exists.
 */
export function getLocalizedApiError(error: any): string | undefined {
  const code = error?.response?.data?.code;
  if (!code) return undefined;
  const key = `errors.api.${code}`;
  return i18n.exists(key) ? i18n.t(key) : undefined;
}
