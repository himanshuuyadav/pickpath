import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Layout, RobotView, ServerMessage } from '@warehouse/shared';
import './style.css';

function App() {
  const [connected, setConnected] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [robots, setRobots] = useState<RobotView[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const url = import.meta.env.VITE_WS_URL ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3001/ws`;
    const socket = new WebSocket(url);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data) as ServerMessage;
      if (message.type === 'snapshot') { setLayout(message.layout); setRobots(message.robots); }
      if (message.type === 'tick') setRobots(message.robots);
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
    robots.forEach((robot) => { context.fillStyle = robot.state === 'FAILED' ? '#D64545' : '#F5A524'; context.fillRect(robot.x * cell + 4, robot.y * cell + 4, cell - 8, cell - 8); });
  }, [layout, robots]);
  return <main className="app"><header><strong>Warehouse</strong><span><i className={connected ? 'status online' : 'status'} />{connected ? 'Connected' : 'Connecting'}</span></header><section><canvas ref={canvas} width="704" height="440" aria-label="Warehouse floor plan" /><aside><p className="eyebrow">Live fleet</p><b>{robots.length}</b><small>robots online</small><button onClick={() => fetch('/api/sim/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ running: true }) })}>Start simulation</button></aside></section></main>;
}
createRoot(document.getElementById('root')!).render(<App />);
