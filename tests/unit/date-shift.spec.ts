import { expect, test } from '@playwright/test';
import { computeDelta, isDateLike, shiftDates } from '../../src/mocks/date-shift';

const RECORDED = '2026-10-20T10:00:00.000Z';
const NOW = Date.parse('2026-11-07T15:30:00.000Z');
const DELTA = NOW - Date.parse(RECORDED);

test.describe('date-shift', () => {
  test('exact mode keeps the relation with "now" (on-air stays on-air)', () => {
    const body = {
      contents: [{ pid: 'EPI123456', startTime: Date.parse('2026-10-20T09:30:00Z'), endTime: Date.parse('2026-10-20T10:30:00Z') }],
    };
    const out = shiftDates(body, { recordedAt: RECORDED, now: NOW });
    const c = out.contents[0]!;
    expect(c.startTime).toBeLessThan(NOW);
    expect(c.endTime).toBeGreaterThan(NOW);
    expect(c.endTime - c.startTime).toBe(3_600_000);
    expect(c.pid).toBe('EPI123456');
  });

  test('epoch seconds, ISO with offset, fractional ISO and date-only keep their format', () => {
    const body = {
      broadcastStart: 1760954400, // s
      availableUntil: '2026-10-22T23:59:59+02:00',
      created: '2026-10-19T08:00:00.123Z',
      airingDate: '2026-10-20',
    };
    const out = shiftDates(body, { recordedAt: RECORDED, now: NOW });
    expect(out.broadcastStart).toBe(1760954400 + Math.round(DELTA / 1000));
    expect(out.availableUntil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+02:00$/);
    expect(Date.parse(out.availableUntil) - Date.parse(body.availableUntil)).toBe(DELTA);
    expect(out.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(out.airingDate).toBe('2026-11-07');
  });

  test('ids, durations, counters and numbers under non-date keys are untouched', () => {
    const body = { channelNumber: 12, duration: 5400, id: 1760954400, programId: 1760954400123, count: 3, photo: 1760954400, total: 1760954400 };
    expect(shiftDates(body, { recordedAt: RECORDED, now: NOW })).toEqual(body);
  });

  test('ISO dates embedded in URLs/texts are shifted', () => {
    const out = shiftDates({ link: 'https://x/epg?from=2026-10-20T00:00:00Z&to=2026-10-21T00:00:00Z' }, { recordedAt: RECORDED, now: NOW });
    expect(out.link).not.toContain('2026-10-20T00');
    expect(out.link).toContain(`from=${new Date(Date.parse('2026-10-20T00:00:00Z') + DELTA).toISOString().slice(0, 19)}Z`);
  });

  test('days mode keeps time of day', () => {
    const out = shiftDates({ startTime: '2026-10-20T20:15:00Z' }, { recordedAt: RECORDED, now: NOW, mode: 'days' });
    expect(out.startTime.endsWith('T20:15:00Z')).toBe(true);
    expect(computeDelta({ recordedAt: RECORDED, now: NOW, mode: 'days' }) % 86_400_000).toBe(0);
  });

  test('none mode and ignoreKeys', () => {
    const body = { startTime: '2026-10-20T20:15:00Z', releaseDate: '2019-05-01' };
    expect(shiftDates(body, { recordedAt: RECORDED, now: NOW, mode: 'none' })).toEqual(body);
    expect(shiftDates(body, { recordedAt: RECORDED, now: NOW, ignoreKeys: ['releaseDate'] }).releaseDate).toBe('2019-05-01');
  });

  test('isDateLike recognises query date values only', () => {
    expect(isDateLike('2026-10-20')).toBe(true);
    expect(isDateLike('2026-10-20T10:00:00Z')).toBe(true);
    expect(isDateLike('1760954400000')).toBe(true);
    expect(isDateLike('1')).toBe(false);
    expect(isDateLike('MOV44943332')).toBe(false);
  });
});
