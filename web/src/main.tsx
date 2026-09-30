import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Layout, Metrics, RobotView, ServerMessage, SimConfig, SimEvent } from '@warehouse/shared';
import './style.css';

const emptyMetrics: Metrics = { ordersDispatched: 0, ordersRejected: 0, throughputPerHour: 0, latencyAvgMs: 0, latencyP95Ms: 0, robotUtilization: 0, backlog: 0, robotsActive: 0, maxWaitTicks: 0 };
const emptyConfig: SimConfig = { robots: 12, orderRate: 0.5, running: false };

function App() {
  const [connected, setConnected] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [robots, setRobots] = useState<RobotView[]>([]);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [config, setConfig] = useState(emptyConfig);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [race, setRace] = useState<{ requests: number; accepted: number; rejected: number; oversold: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:3001`;

  useEffect(() => {
    const url = import.meta.env.VITE_WS_URL ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3001/ws`;
    const socket = new WebSocket(url);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data) as ServerMessage;
      if (message.type === 'snapshot') { setLayout(message.layout); setRobots(message.robots); setMetrics(message.metrics); setConfig(message.config); setEvents(message.events); }
      if (message.type === 'tick') setRobots(message.robots);
      if (message.type === 'metrics') setMetrics(message.metrics);
      if (message.type === 'event') setEvents((current) => [...current.slice(-11), message.event]);
    };
    return () => socket.close();
  }, []);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context || !layout || !canvas.current) return;
    const cell = 22;
    context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, canvas.current.width, canvas.current.height);
    layout.cells.forEach((row, y) => row.forEach((kind, x) => {
      if (kind === 'shelf') { context.fillStyle = '#3B4CCA'; context.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4); }
      else { context.strokeStyle = '#D9DEE6'; context.strokeRect(x * cell, y * cell, cell, cell); }
    }));
    const selected = robots.find((robot) => robot.id === selectedId);
    if (selected?.path.length) { context.setLineDash([3, 4]); context.strokeStyle = '#3B4CCA'; context.beginPath(); context.moveTo((selected.x + .5) * cell, (selected.y + .5) * cell); selected.path.forEach(([x, y]) => context.lineTo((x + .5) * cell, (y + .5) * cell)); context.stroke(); context.setLineDash([]); }
    robots.forEach((robot) => { context.fillStyle = robot.state === 'FAILED' ? '#D64545' : '#F5A524'; context.fillRect(robot.x * cell + 4, robot.y * cell + 4, cell - 8, cell - 8); if (robot.id === selectedId) { context.strokeStyle = '#141B2D'; context.lineWidth = 2; context.strokeRect(robot.x * cell + 2, robot.y * cell + 2, cell - 4, cell - 4); context.lineWidth = 1; } });
  }, [layout, robots, selectedId]);

  async function configure(input: Partial<SimConfig>) {
    const response = await fetch(`${api}/api/sim/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (response.ok) setConfig(await response.json() as SimConfig);
  }
  async function reset() { await fetch(`${api}/api/sim/reset`, { method: 'POST' }); setRace(null); }
  async function failRobot() { const busy = robots.find((robot) => robot.state !== 'IDLE' && robot.state !== 'FAILED'); if (busy) await fetch(`${api}/api/sim/robots/${busy.id}/kill`, { method: 'POST' }); }
  async function runRace() { const response = await fetch(`${api}/api/demo/stock-race`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: 1000 }) }); if (response.ok) setRace(await response.json()); }
  const selected = robots.find((robot) => robot.id === selectedId);

  return <main className="app">
    <header><div><p className="eyebrow">Fulfillment control</p><h1>Warehouse</h1></div><span className="connection"><i className={connected ? 'status online' : 'status'} />{connected ? 'Connected' : 'Connecting'}</span></header>
    <section className="workspace"><div className="floor"><canvas ref={canvas} width="704" height="440" aria-label="Warehouse floor plan" onClick={(event) => { if (!canvas.current) return; const rect = canvas.current.getBoundingClientRect(); const x = Math.floor((event.clientX - rect.left) / (rect.width / 32)); const y = Math.floor((event.clientY - rect.top) / (rect.height / 20)); setSelectedId(robots.find((robot) => robot.x === x && robot.y === y)?.id ?? null); }} /></div>
      <aside><div className="panel-heading"><div><p className="eyebrow">Live fleet</p><strong>{config.running ? 'Running' : 'Paused'}</strong></div><span className="fleet-count">{robots.length}</span></div>
        <div className="metrics">{[['Dispatched', metrics.ordersDispatched], ['Throughput/h', Math.round(metrics.throughputPerHour)], ['Avg latency', `${Math.round(metrics.latencyAvgMs)} ms`], ['P95 latency', `${Math.round(metrics.latencyP95Ms)} ms`], ['Utilization', `${Math.round(metrics.robotUtilization * 100)}%`], ['Backlog', metrics.backlog]].map(([label, value]) => <div className="metric" key={String(label)}><b>{value}</b><small>{label}</small></div>)}</div>
        <div className="controls"><label>Robots <output>{config.robots}</output><input type="range" min="1" max="32" value={config.robots} onChange={(event) => configure({ robots: Number(event.target.value) })} /></label><label>Orders / second <output>{config.orderRate}</output><input type="range" min="0" max="3" step="0.1" value={config.orderRate} onChange={(event) => configure({ orderRate: Number(event.target.value) })} /></label><div className="actions"><button onClick={() => configure({ running: !config.running })}>{config.running ? 'Pause' : 'Start'}</button><button className="secondary" onClick={reset}>Reset</button><button className="secondary" onClick={failRobot}>Fail robot</button></div><button className="race" onClick={runRace}>Run stock race</button></div>
        {race && <div className="race-result"><b>Stock race</b><span>{race.requests.toLocaleString()} requests</span><span>{race.accepted} accepted · {race.rejected} rejected · {race.oversold} oversold</span></div>}
        {selected && <div className="selection"><p className="eyebrow">Selected robot</p><strong>Robot {selected.id}</strong><span>{selected.state} {selected.taskId ? `· Task ${selected.taskId}` : ''}</span></div>}
        <div className="activity"><p className="eyebrow">Activity</p>{events.length ? events.slice().reverse().map((event, index) => <span key={`${event.ts}-${index}`}>{event.text}</span>) : <span>No activity yet</span>}</div>
      </aside>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
