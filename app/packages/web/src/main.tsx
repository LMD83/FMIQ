import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { msalInstance, authEnabled } from './authConfig';
import { LanguageProvider } from './i18n';
import { ThemeProvider } from './components/theme-provider';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import { App } from './App';
import { registerServiceWorker } from './sw-register';
import './index.css';
import './theme.css';

const root = createRoot(document.getElementById('root') as HTMLElement);
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster />
          </TooltipProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

async function boot(): Promise<void> {
  if (authEnabled) {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) msalInstance.setActiveAccount(accounts[0]);
    else await msalInstance.loginRedirect({ scopes: [] });
    root.render(
      <StrictMode>
        <MsalProvider instance={msalInstance}><Providers><App /></Providers></MsalProvider>
      </StrictMode>,
    );
  } else {
    // Dev mode: API runs with DEV_NO_AUTH, no login required.
    root.render(<StrictMode><Providers><App /></Providers></StrictMode>);
  }
  registerServiceWorker();
}

void boot();
