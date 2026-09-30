import type { Layout, Point } from './layout.js';

export type RobotState = 'IDLE' | 'TO_SHELF' | 'PICKING' | 'TO_STATION' | 'DROPPING' | 'RETURNING' | 'FAILED';
export interface RobotView { id: number; x: number; y: number; state: RobotState; taskId: number | null; path: [number, number][]; }
export interface SimConfig { robots: number; orderRate: number; running: boolean; }
export interface Metrics { ordersDispatched: number; ordersRejected: number; throughputPerHour: number; latencyAvgMs: number; latencyP95Ms: number; robotUtilization: number; backlog: number; robotsActive: number; maxWaitTicks: number; }
export interface SimEvent { ts: number; kind: string; text: string; robotId?: number; orderId?: number; }
export type ServerMessage =
  | { type: 'snapshot'; layout: Layout; config: SimConfig; robots: RobotView[]; metrics: Metrics; events: SimEvent[] }
  | { type: 'tick'; t: number; robots: RobotView[] }
  | { type: 'metrics'; metrics: Metrics }
  | { type: 'event'; event: SimEvent };
