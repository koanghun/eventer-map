import Axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { toast } from '../store/useToastStore';

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8080',
  withCredentials: true, // Send HttpOnly cookies (refreshToken)
});

// In-memory storage for access token
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Request interceptor to add the bearer token
AXIOS_INSTANCE.interceptors.request.use(
  (config) => {
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
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
    const status = error.response?.status;
    const message = error.response?.data?.error;

    if (status === 401) {
      setAccessToken(null);
    } else if (status === 403) {
      toast.error(message || 'Access Denied.');
    } else if (status === 404) {
      // Silently ignore 404s — handled by individual components
    } else if (status && status >= 500) {
      toast.error('A server error occurred. Please try again later.');
    } else if (!error.response && error.message !== 'Query was cancelled') {
      toast.error('Please check your network connection.');
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
