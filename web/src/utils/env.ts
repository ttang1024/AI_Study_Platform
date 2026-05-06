type RuntimeProcess = {
  env?: Record<string, string | undefined>;
};

const runtimeProcess = typeof process !== 'undefined' ? (process as RuntimeProcess) : undefined;
const viteEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;

export const getPublicEnv = (key: string) => runtimeProcess?.env?.[key] ?? viteEnv?.[key];

export const getApiUrl = () => getPublicEnv('NEXT_PUBLIC_API_URL') ?? getPublicEnv('VITE_API_URL') ?? '';

export const getShareBaseUrl = () => getPublicEnv('NEXT_PUBLIC_SHARE_BASE_URL')
  ?? getPublicEnv('VITE_SHARE_BASE_URL')
  ?? (typeof window !== 'undefined' ? window.location.origin : '');
