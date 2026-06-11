import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Lightweight bilingual (EN/GA) scaffold. Irish public-sector UIs must support Gaeilge
 * (Official Languages Act 2003); `lang="ga"` is set on <html> for screen-reader
 * pronunciation. Strings fall back to EN, then to the key. Replace with react-i18next
 * once the string set grows (EP-FE).
 */

export type Lang = 'en' | 'ga';

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    'nav.dashboards': 'Dashboards',
    'nav.floorMap': 'Live floor map',
    'dash.title': 'Role dashboards',
    'dash.sub': 'One screen, one question — live across the estate.',
    'dash.openWorkOrders': 'Open work orders',
    'dash.ppmDue': 'PPM due',
    'dash.certsExpiring': 'Certs expiring (90d)',
    'dash.activeExcursions': 'Active excursions',
    'dash.committed': 'Committed spend',
    'dash.statutoryPpm': 'Statutory PPM on-time',
    'role.director': 'Director — what needs money & attention?',
    'role.fm': 'Facilities — what’s wrong, blocked or due?',
    'role.conservation': 'Conservation — are my zones safe?',
    'role.finance': 'Finance — what needs sign-off?',
    'status.ready': 'Ready to start',
    'status.blocked': 'Blocked',
    'lang.toggle': 'Gaeilge',
  },
  ga: {
    'nav.dashboards': 'Deais',
    'nav.floorMap': 'Léarscáil urláir bheo',
    'dash.title': 'Deaisbhoird róil',
    'dash.sub': 'Scáileán amháin, ceist amháin — beo ar fud an eastáit.',
    'dash.openWorkOrders': 'Orduithe oibre oscailte',
    'dash.ppmDue': 'PPM dlite',
    'dash.certsExpiring': 'Teastais ag dul in éag (90l)',
    'dash.activeExcursions': 'Eisréimní gníomhacha',
    'dash.committed': 'Caiteachas gealltanais',
    'dash.statutoryPpm': 'PPM reachtúil in am',
    'role.director': 'Stiúrthóir — cad a theastaíonn airgead & aird?',
    'role.fm': 'Áiseanna — cad atá cearr, bactha nó dlite?',
    'role.conservation': 'Caomhnú — an bhfuil mo chriosanna sábháilte?',
    'role.finance': 'Airgeadas — cad a theastaíonn síniú?',
    'status.ready': 'Réidh le tosú',
    'status.blocked': 'Bactha',
    'lang.toggle': 'English',
  },
};

interface I18n {
  lang: Lang;
  t: (key: string) => string;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<I18n>({ lang: 'en', t: (k) => k, setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('fmiq.lang') as Lang) || 'en');
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem('fmiq.lang', l);
    setLangState(l);
  }, []);
  const t = useCallback((key: string) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key, [lang]);
  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}

export const useT = (): I18n => useContext(Ctx);
