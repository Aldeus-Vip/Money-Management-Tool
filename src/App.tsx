import { CircuitBackground } from './components/CircuitBackground';
import { Shell } from './components/Shell';
import { Dashboard } from './pages/Dashboard';
import { fmtDate, periodOf } from './lib/period';

// モックは日付を固定 (2026/11/03) して表示を安定させる
const TODAY = new Date(2026, 10, 3);
const PERIOD = periodOf(2026, 9);

export function App() {
  return (
    <>
      <CircuitBackground />
      <Shell periodYear={PERIOD.start.getFullYear()} periodLabel={`${fmtDate(PERIOD.start)} – ${fmtDate(PERIOD.end)}`}>
        <Dashboard period={PERIOD} today={TODAY} />
      </Shell>
    </>
  );
}
