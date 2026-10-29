import { SERVICES, SLOT } from './config';
import { Booking, ServiceId, Table } from './models';
import { overlaps, serviceOf } from './time';

/** Cancelled bookings and no-shows don't hold a table. */
export const holdsTable = (b: Booking) => b.status !== 'cancelled' && b.status !== 'noshow';

export interface Slot {
  date: string;
  start: number;
  duration: number;
  tableId: string;
  /** The booking being edited, so it doesn't clash with itself. */
  excludeId?: string;
}

/** Bookings that would overlap this one at the same table. */
export function clashesWith(slot: Slot, bookings: readonly Booking[]): Booking[] {
  return bookings.filter(
    b =>
      b.id !== slot.excludeId &&
      b.tableId === slot.tableId &&
      b.date === slot.date &&
      holdsTable(b) &&
      overlaps(slot.start, slot.duration, b.start, b.duration),
  );
}

/**
 * Tables that are free for the whole slot and big enough for the group,
 * smallest first, so a couple doesn't end up on the table for eight.
 */
export function freeTables(
  tables: readonly Table[],
  bookings: readonly Booking[],
  query: Omit<Slot, 'tableId'> & { partySize: number },
): Table[] {
  return tables
    .filter(t => t.seats >= query.partySize)
    .filter(t => clashesWith({ ...query, tableId: t.id }, bookings).length === 0)
    .sort((a, b) => a.seats - b.seats || Number(a.name) - Number(b.name));
}

export const forService = (bookings: readonly Booking[], date: string, service: ServiceId) =>
  bookings.filter(b => b.date === date && serviceOf(b.start) === service);

/** How many tables are in use at a given minute. */
export function tablesInUse(bookings: readonly Booking[], date: string, minute: number): number {
  const busy = new Set(
    bookings
      .filter(b => b.date === date && holdsTable(b) && b.start <= minute && minute < b.start + b.duration)
      .map(b => b.tableId),
  );
  return busy.size;
}

export interface ServiceStats {
  bookings: number;
  guests: number;
  /** Busiest moment of the service. */
  peak: { minute: number; tables: number } | null;
}

export function serviceStats(bookings: readonly Booking[], date: string, service: ServiceId): ServiceStats {
  const active = forService(bookings, date, service).filter(holdsTable);
  const { open, close } = SERVICES[service];
  let peak: ServiceStats['peak'] = null;
  for (let m = open; m < close; m += SLOT) {
    const tables = tablesInUse(active, date, m);
    if (tables > 0 && (!peak || tables > peak.tables)) peak = { minute: m, tables };
  }
  return {
    bookings: active.length,
    guests: active.reduce((sum, b) => sum + b.partySize, 0),
    peak,
  };
}
