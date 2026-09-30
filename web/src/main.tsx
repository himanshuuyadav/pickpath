import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const url = import.meta.env.VITE_WS_URL ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3001/ws`;
    const socket = new WebSocket(url);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    return () => socket.close();
  }, []);
  return <main><span className={connected ? 'status online' : 'status'} />Warehouse connection: {connected ? 'connected' : 'connecting…'}</main>;
}
createRoot(document.getElementById('root')!).render(<App />);
