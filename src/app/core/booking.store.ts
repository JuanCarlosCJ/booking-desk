import { effect, inject, Injectable, signal } from '@angular/core';
import { Clock } from './clock.service';
import { generateDemo } from './demo-data';
import { I18n } from './i18n.service';
import { Booking, Status } from './models';

const STORAGE_KEY = 'booking-desk:v1';

interface Saved {
  /** The day the demo data was generated for. */
  seededOn: string;
  /** Once someone edits, we stop refreshing the demo data on new days. */
  edited: boolean;
  bookings: Booking[];
}

function isBooking(b: unknown): b is Booking {
  const x = b as Booking;
  return (
    !!x &&
    typeof x.id === 'string' &&
    typeof x.date === 'string' &&
    typeof x.start === 'number' &&
    typeof x.duration === 'number' &&
    typeof x.tableId === 'string' &&
    typeof x.name === 'string' &&
    typeof x.partySize === 'number'
  );
}

/** All bookings, kept in a signal and saved to localStorage on every change. */
@Injectable({ providedIn: 'root' })
export class BookingStore {
  private readonly clock = inject(Clock);
  private readonly i18n = inject(I18n);
  private edited = false;
  private seededOn = '';

  private readonly _bookings = signal<Booking[]>(this.load());
  readonly bookings = this._bookings.asReadonly();

  constructor() {
    effect(() => {
      const saved: Saved = { seededOn: this.seededOn, edited: this.edited, bookings: this._bookings() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      } catch {
        // storage full or blocked: the demo still works for this visit
      }
    });
  }

  add(booking: Omit<Booking, 'id'>): Booking {
    const created = { ...booking, id: crypto.randomUUID() };
    this.change(list => [...list, created]);
    return created;
  }

  update(id: string, patch: Partial<Omit<Booking, 'id'>>): void {
    this.change(list => list.map(b => (b.id === id ? { ...b, ...patch } : b)));
  }

  /** Returns the old status, so the cancel can be undone. */
  cancel(id: string): Status | undefined {
    const old = this._bookings().find(b => b.id === id)?.status;
    this.update(id, { status: 'cancelled' });
    return old;
  }

  resetDemo(): void {
    this.edited = false;
    this._bookings.set(this.seed());
  }

  private change(fn: (list: Booking[]) => Booking[]): void {
    this.edited = true;
    this._bookings.update(fn);
  }

  private seed(): Booking[] {
    this.seededOn = this.clock.today();
    return generateDemo(this.seededOn, this.clock.minutes(), this.i18n.lang());
  }

  private load(): Booking[] {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null;
      if (saved && Array.isArray(saved.bookings) && saved.bookings.every(isBooking)) {
        // Untouched demo data from another day: refresh it so "today" always has bookings.
        if (saved.edited || saved.seededOn === this.clock.today()) {
          this.edited = saved.edited;
          this.seededOn = saved.seededOn;
          return saved.bookings;
        }
      }
    } catch {
      // broken or blocked storage: start fresh
    }
    return this.seed();
  }
}
