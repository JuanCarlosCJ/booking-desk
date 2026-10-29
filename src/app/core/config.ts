import { Area, Service, ServiceId, Table } from './models';

export const TABLES: Table[] = [
  { id: 't1', name: '1', seats: 2, area: 'dining' },
  { id: 't2', name: '2', seats: 2, area: 'dining' },
  { id: 't3', name: '3', seats: 4, area: 'dining' },
  { id: 't4', name: '4', seats: 4, area: 'dining' },
  { id: 't5', name: '5', seats: 4, area: 'dining' },
  { id: 't6', name: '6', seats: 6, area: 'dining' },
  { id: 't7', name: '7', seats: 2, area: 'terrace' },
  { id: 't8', name: '8', seats: 2, area: 'terrace' },
  { id: 't9', name: '9', seats: 4, area: 'terrace' },
  { id: 't10', name: '10', seats: 4, area: 'terrace' },
  { id: 't11', name: '11', seats: 8, area: 'private' },
  { id: 't12', name: '12', seats: 10, area: 'private' },
];

export const AREAS: Area[] = ['dining', 'terrace', 'private'];

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

export const SERVICES: Record<ServiceId, Service> = {
  lunch: { id: 'lunch', open: h(13), lastBooking: h(15, 30), close: h(17, 30) },
  dinner: { id: 'dinner', open: h(20), lastBooking: h(23), close: h(25) },
};

export const SLOT = 15;
export const DURATIONS = [60, 75, 90, 105, 120, 150, 180];

/** Bigger groups stay longer. */
export function defaultDuration(partySize: number): number {
  if (partySize <= 2) return 90;
  if (partySize <= 4) return 105;
  if (partySize <= 6) return 120;
  return 150;
}

export const tableById = (id: string) => TABLES.find(t => t.id === id);
