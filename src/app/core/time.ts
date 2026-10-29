import { SERVICES, SLOT } from './config';
import { Service, ServiceId } from './models';

const pad = (n: number) => String(n).padStart(2, '0');

/** 1290 → "21:30". Times past midnight wrap: 1500 → "01:00". */
export function formatTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Local date as "YYYY-MM-DD" (not UTC, so it doesn't jump a day at night). */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

export function isValidDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(parseDateKey(key)) === key;
}

/** Minutes since midnight for a Date. */
export const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

/** Half-open intervals: a booking ending at 21:00 doesn't clash with one starting at 21:00. */
export function overlaps(aStart: number, aLength: number, bStart: number, bLength: number): boolean {
  return aStart < bStart + bLength && bStart < aStart + aLength;
}

export function serviceOf(start: number): ServiceId {
  return start < 18 * 60 ? 'lunch' : 'dinner';
}

/** Start times staff can pick for a service, every 15 minutes. */
export function slotsFor(service: Service): number[] {
  const out: number[] = [];
  for (let t = service.open; t <= service.lastBooking; t += SLOT) out.push(t);
  return out;
}

export const allSlots = () => [...slotsFor(SERVICES.lunch), ...slotsFor(SERVICES.dinner)];
