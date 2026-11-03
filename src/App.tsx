import { CircuitBackground } from './components/CircuitBackground';
import { Shell } from './components/Shell';
import { AppProvider, useApp } from './state/AppContext';
import { useRoute } from './state/router';
import { Budget } from './pages/Budget';
import { Connect } from './pages/Connect';
import { Dashboard } from './pages/Dashboard';
import { Entry } from './pages/Entry';
import { Master } from './pages/Master';
import { Phase2 } from './pages/Phase2';
import { Pin } from './pages/Pin';
import { Settings } from './pages/Settings';
import { Transactions } from './pages/Transactions';

function Screen() {
  const { phase, toasts } = useApp();
  const { route, param } = useRoute();

  let body;
  if (phase === 'connect') body = <Connect />;
  else if (phase === 'setPin') body = <Pin mode="setup" />;
  else if (phase === 'locked') body = <Pin mode="unlock" />;
  else {
    const page = (() => {
      switch (route) {
        case 'entry': return <Entry key={param ?? 'new'} id={param ? Number(param) : undefined} />;
        case 'list': return <Transactions />;
        case 'budget': return <Budget />;
        case 'master': return <Master />;
        case 'settings': return <Settings />;
        case 'wallets': case 'fixed': case 'pools': case 'analysis': return <Phase2 route={route} />;
        default: return <Dashboard />;
      }
    })();
    body = <Shell route={route}>{page}</Shell>;
  }

  return (
    <>
      {body}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <p key={t.id} className={`toast ${t.tone}`}>{t.text}</p>)}
      </div>
    </>
  );
}

export function App() {
  return (
    <AppProvider>
      <CircuitBackground />
      <Screen />
    </AppProvider>
  );
}
