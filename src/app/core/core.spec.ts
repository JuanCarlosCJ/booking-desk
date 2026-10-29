import { clashesWith, freeTables, holdsTable, serviceStats, tablesInUse } from './availability';
import { defaultDuration, SERVICES, TABLES } from './config';
import { generateDemo } from './demo-data';
import { Booking } from './models';
import { addDays, dateKey, formatTime, isValidDateKey, overlaps, serviceOf, slotsFor } from './time';

const DAY = '2026-10-30';
let n = 0;
const booking = (over: Partial<Booking> = {}): Booking => ({
  id: `b${++n}`,
  date: DAY,
  start: 21 * 60,
  duration: 90,
  tableId: 't3',
  name: 'Test',
  phone: '',
  partySize: 4,
  notes: '',
  status: 'confirmed',
  ...over,
});

describe('time helpers', () => {
  it('formats times, wrapping past midnight', () => {
    expect(formatTime(21 * 60 + 5)).toBe('21:05');
    expect(formatTime(25 * 60)).toBe('01:00');
  });

  it('works with local date keys', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-02-28')).toBe(true);
  });

  it('treats back-to-back bookings as not overlapping', () => {
    expect(overlaps(1200, 90, 1290, 60)).toBe(false);
    expect(overlaps(1200, 90, 1289, 60)).toBe(true);
  });

  it('sorts times into services and builds 15-minute slots', () => {
    expect(serviceOf(14 * 60)).toBe('lunch');
    expect(serviceOf(21 * 60)).toBe('dinner');
    const slots = slotsFor(SERVICES.lunch);
    expect(slots[0]).toBe(13 * 60);
    expect(slots.at(-1)).toBe(15 * 60 + 30);
    expect(slots[1] - slots[0]).toBe(15);
  });

  it('gives bigger groups more time', () => {
    expect(defaultDuration(2)).toBeLessThan(defaultDuration(8));
  });
});

describe('availability', () => {
  const existing = booking({ name: 'García', start: 20 * 60 + 30, duration: 90 });

  it('finds clashes at the same table and day only', () => {
    const slot = { date: DAY, start: 21 * 60, duration: 90, tableId: 't3' };
    expect(clashesWith(slot, [existing]).map(b => b.name)).toEqual(['García']);
    expect(clashesWith({ ...slot, tableId: 't4' }, [existing])).toEqual([]);
    expect(clashesWith({ ...slot, date: '2026-10-31' }, [existing])).toEqual([]);
  });

  it("doesn't clash with itself or with cancelled bookings", () => {
    const slot = { date: DAY, start: 21 * 60, duration: 90, tableId: 't3' };
    expect(clashesWith({ ...slot, excludeId: existing.id }, [existing])).toEqual([]);
    expect(clashesWith(slot, [{ ...existing, status: 'cancelled' }])).toEqual([]);
    expect(clashesWith(slot, [{ ...existing, status: 'noshow' }])).toEqual([]);
    expect(holdsTable({ ...existing, status: 'seated' })).toBe(true);
  });

  it('suggests free tables that fit, smallest first', () => {
    const free = freeTables(TABLES, [existing], { date: DAY, start: 21 * 60, duration: 90, partySize: 4 });
    expect(free.every(t => t.seats >= 4)).toBe(true);
    expect(free.map(t => t.id)).not.toContain('t3');
    expect(free[0].seats).toBe(4);
    expect(freeTables(TABLES, [], { date: DAY, start: 1260, duration: 90, partySize: 11 })).toEqual([]);
  });

  it('counts tables in use and the busiest moment', () => {
    const list = [
      booking({ tableId: 't1', start: 20 * 60, partySize: 2 }),
      booking({ tableId: 't2', start: 20 * 60 + 30, partySize: 2 }),
      booking({ tableId: 't3', start: 22 * 60, partySize: 4 }),
      booking({ tableId: 't4', start: 20 * 60, partySize: 4, status: 'cancelled' }),
    ];
    expect(tablesInUse(list, DAY, 21 * 60)).toBe(2);
    const stats = serviceStats(list, DAY, 'dinner');
    expect(stats.bookings).toBe(3);
    expect(stats.guests).toBe(8);
    expect(stats.peak).toEqual({ minute: 20 * 60 + 30, tables: 2 });
  });
});

describe('demo data', () => {
  const demo = generateDemo(DAY, 21 * 60, 'en');

  it('is the same every time for the same day', () => {
    expect(generateDemo(DAY, 21 * 60, 'en')).toEqual(demo);
  });

  it('gives the same bookings at any time of day (only statuses change)', () => {
    const morning = generateDemo(DAY, 9 * 60, 'en');
    const strip = (list: Booking[]) => list.map(({ status: _s, ...rest }) => rest);
    expect(strip(morning)).toEqual(strip(demo));
  });

  it('never double-books a table', () => {
    for (const b of demo.filter(holdsTable)) {
      expect(clashesWith({ ...b, excludeId: b.id }, demo)).toEqual([]);
    }
  });

  it('fits every group at its table and inside service hours', () => {
    for (const b of demo) {
      const table = TABLES.find(t => t.id === b.tableId)!;
      expect(b.partySize).toBeLessThanOrEqual(table.seats);
      const service = SERVICES[serviceOf(b.start)];
      expect(b.start).toBeGreaterThanOrEqual(service.open);
      expect(b.start).toBeLessThanOrEqual(service.lastBooking);
    }
  });

  it('marks the past as finished and the future as confirmed', () => {
    const past = demo.filter(b => b.date < DAY);
    const future = demo.filter(b => b.date > DAY);
    expect(past.every(b => b.status === 'done' || b.status === 'noshow')).toBe(true);
    expect(future.every(b => b.status === 'confirmed' || b.status === 'cancelled')).toBe(true);
    expect(demo.some(b => b.date === DAY)).toBe(true);
  });
});
