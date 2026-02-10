const { test, expect } = require('@playwright/test');
const path = require('path');
const ClockManager = require(path.resolve(__dirname, '../src/weather/ClockManager.js'));

function makeRafHarness(nowRef) {
  const state = { id: 0, cb: null };
  const raf = (cb) => { state.cb = cb; state.id += 1; return state.id; };
  const caf = () => { state.cb = null; };
  const step = (ms) => { nowRef.now += ms; if (typeof state.cb === 'function') state.cb(nowRef.now); };
  return { raf, caf, step };
}

test.describe('ClockManager', () => {
  test('rate math advances simulation time correctly', async () => {
    const nowRef = { now: 0 };
    const { raf, caf, step } = makeRafHarness(nowRef);
    const cm = new ClockManager({ mode: 'simulation', now: () => nowRef.now, raf, caf });
    cm.setTime(0);

    const ticks = [];
    cm.on('tick', (e) => ticks.push(e));
    cm.start();

    step(100);
    step(100);
    step(100);
    expect(ticks[ticks.length - 1].time).toBe(300);

    let lastRate;
    cm.on('rate', (e) => { lastRate = e.rate; });
    cm.setRate(2);
    expect(lastRate).toBe(2);

    step(100);
    expect(ticks[ticks.length - 1].time).toBe(500);

    cm.stop();
  });

  test('mode switching anchors simulation to current realtime', async () => {
    const nowRef = { now: 1000 };
    const { raf, caf, step } = makeRafHarness(nowRef);
    const cm = new ClockManager({ mode: 'realtime', now: () => nowRef.now, raf, caf });

    let modeEvents = [];
    cm.on('mode', (e) => modeEvents.push(e));
    const ticks = [];
    cm.on('tick', (e) => ticks.push(e));
    cm.start();

    step(50);
    expect(ticks[ticks.length - 1].time).toBe(1050);

    cm.setMode('simulation');
    expect(modeEvents[modeEvents.length - 1].mode).toBe('simulation');

    step(100);
    const t = ticks[ticks.length - 1].time;
    expect(t).toBeGreaterThanOrEqual(1150);
    expect(t).toBeLessThanOrEqual(1151);

    cm.stop();
  });

  test('tick cadence reduces when page is hidden', async () => {
    const nowRef = { now: 0 };
    let hidden = true;
    const { raf, caf, step } = makeRafHarness(nowRef);
    const cm = new ClockManager({ mode: 'simulation', now: () => nowRef.now, raf, caf, visibilityProvider: () => hidden, hiddenInterval: 500 });

    const ticks = [];
    cm.on('tick', (e) => ticks.push(e));
    cm.start();

    step(100);
    step(100);
    step(100);
    step(100);
    step(100);
    expect(ticks.length).toBe(1);

    hidden = false;
    step(100);
    step(100);
    expect(ticks.length).toBe(3);

    cm.stop();
  });

  test('timeSet updates simulation time explicitly', async () => {
    const nowRef = { now: 0 };
    const { raf, caf, step } = makeRafHarness(nowRef);
    const cm = new ClockManager({ mode: 'simulation', now: () => nowRef.now, raf, caf });

    let timeSetEvent;
    cm.on('timeSet', (e) => { timeSetEvent = e; });
    cm.setTime(10_000);
    expect(timeSetEvent.time).toBe(10_000);

    const ticks = [];
    cm.on('tick', (e) => ticks.push(e));
    cm.start();
    step(1000);
    expect(ticks[0].time).toBe(11_000);
    cm.stop();
  });
});
