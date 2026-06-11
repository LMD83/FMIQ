import { PublicClientApplication, type Configuration } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined;

/** When no client id is configured we run in dev mode (API uses DEV_NO_AUTH). */
export const authEnabled = Boolean(clientId && clientId.length > 0);
export const apiScope =
  (import.meta.env.VITE_ENTRA_API_SCOPE as string | undefined) ?? 'api://fmiq-api/access_as_user';

const msalConfig: Configuration = {
  auth: {
    clientId: clientId ?? '00000000-0000-0000-0000-000000000000',
    authority:
      (import.meta.env.VITE_ENTRA_AUTHORITY as string | undefined) ??
      'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
};

export const msalInstance = new PublicClientApplication(msalConfig);
