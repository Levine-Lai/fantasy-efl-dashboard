import { createRoot } from 'react-dom/client';
import { FplDashboard } from '../app/fpl-dashboard';
import type { FplData } from '../lib/fpl-data';
import '../app/globals.css';
import '../app/fpl.css';

const root = createRoot(document.getElementById('root')!);
const personal = location.pathname.endsWith('fpl-personal.html');
async function load() {
  root.render(<main className="fpl-load" role="status">正在加载 FPL 官方数据快照…</main>);
  try {
    const response = await fetch(new URL('./fpl/dashboard.json', document.baseURI), { signal: AbortSignal.timeout(20000), cache: 'no-cache' });
    if (!response.ok) throw Error('数据文件暂不可用');
    const data = await response.json() as FplData;
    if (data.schemaVersion !== 1 || !data.players?.length || !data.teams?.length || !data.events?.length || !Array.isArray(data.fixtures) || !data.events.some(e => e.id === data.currentEvent) || !Number.isFinite(Date.parse(data.capturedAt))) throw Error('数据格式不完整');
    root.render(<FplDashboard data={data} personal={personal} />);
  } catch {
    root.render(<main className="fpl-load"><h1>FPL 数据暂时无法加载</h1><p role="alert">请检查网络，或等待下一次数据发布。</p><button onClick={load}>重新加载</button><a href="./index.html">返回 EFL</a></main>);
  }
}
void load();
