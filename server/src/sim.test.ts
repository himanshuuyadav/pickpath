import { describe, expect, it } from 'vitest';
import { resetSim, simConfig, simMetrics, views } from './sim.js';

describe('simulation reset', () => {
  it('clears metrics and restores the configured parking fleet', () => {
    simConfig({ robots: 2 });
    simMetrics().ordersDispatched = 4;
    simMetrics().maxWaitTicks = 12;

    resetSim();

    expect(views().map((robot) => [robot.id, robot.x, robot.y])).toEqual([[1, 0, 19], [2, 1, 19]]);
    expect(simMetrics()).toMatchObject({ ordersDispatched: 0, maxWaitTicks: 0, robotsActive: 2 });
    simConfig({ robots: 12 });
    resetSim();
  });
});