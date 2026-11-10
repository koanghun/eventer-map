import Axios, { AxiosError, AxiosRequestConfig } from 'axios';
import i18n from '../i18n/config';
import { toast } from '../store/useToastStore';
import { getLocalizedApiError } from './apiError';

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8080',
  withCredentials: true, // Send HttpOnly cookies (refreshToken)
});

// In-memory storage for access token
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Request interceptor to add the bearer token and current language
AXIOS_INSTANCE.interceptors.request.use(
  (config) => {
      if (config.headers) {
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        if (i18n.language) {
          config.headers['Accept-Language'] = i18n.language;
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
);

// Response interceptor to handle errors globally
AXIOS_INSTANCE.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<{ error?: string }>) => {
    // Ignore requests cancelled via AbortSignal (TanStack Query v5) or CancelToken
    if (
      Axios.isCancel(error) ||
      error.code === 'ERR_CANCELED' ||
      error.name === 'CanceledError' ||
      error.name === 'AbortError' ||
      error.config?.signal?.aborted
    ) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const message = error.response?.data?.error;
    const requestUrl = error.config?.url || '';
    const requestMethod = (error.config?.method || 'get').toLowerCase();
    const isVenueSearchRequest = requestMethod === 'get' && requestUrl.includes('/venues/search');
    const isArtistSearchRequest = requestMethod === 'get' && requestUrl === '/artists';

    if (status === 401) {
      setAccessToken(null);
    } else if (status === 403) {
      toast.error(getLocalizedApiError(error) || message || i18n.t('errors.accessDenied', '접근 권한이 없습니다.'));
      (error as any)._toastShown = true;
    } else if (status === 404) {
      // Silently ignore 404s — handled by individual components
    } else if (status && status >= 500) {
      if (isVenueSearchRequest) {
        toast.error(i18n.t('errors.venueSearchServerError', '회장 검색 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
      } else if (isArtistSearchRequest) {
        toast.error(i18n.t('errors.artistSearchServerError', '출연자 검색 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
      } else {
        toast.error(i18n.t('errors.serverError', '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
      }
      (error as any)._toastShown = true;
    } else if (!error.response) {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';

      if (isOffline) {
        toast.error(i18n.t('errors.networkError', '네트워크 연결을 확인해주세요.'));
      } else if (isTimeout) {
        toast.error(i18n.t('errors.timeoutError', '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'));
      } else if (isVenueSearchRequest) {
        toast.error(i18n.t('errors.venueSearchConnectionError', '회장 검색 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'));
      } else if (isArtistSearchRequest) {
        toast.error(i18n.t('errors.artistSearchConnectionError', '출연자 검색 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'));
      } else {
        toast.error(i18n.t('errors.serverUnavailable', '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'));
      }
      (error as any)._toastShown = true;
    }

    return Promise.reject(error);
  }
);

// Custom mutator for Orval
export const customInstance = <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};
