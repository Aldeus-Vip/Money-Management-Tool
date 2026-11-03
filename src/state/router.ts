import { useEffect, useState } from 'react';

export type Route = 'dashboard' | 'entry' | 'list' | 'wallets' | 'fixed' | 'budget' | 'pools' | 'analysis' | 'master' | 'settings';

const parse = (): { route: Route; param?: string } => {
  const [route, param] = location.hash.replace(/^#\/?/, '').split('/');
  return { route: (route || 'dashboard') as Route, param };
};

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const h = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return r;
}

export const go = (route: Route, param?: string | number) => {
  location.hash = `#/${route}${param !== undefined ? `/${param}` : ''}`;
};
