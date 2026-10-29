import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BookingForm, BookingInput, Draft } from './booking-form/booking-form';
import { BookingList } from './booking-list/booking-list';
import { forService, serviceStats, tablesInUse } from './core/availability';
import { BookingStore } from './core/booking.store';
import { Clock } from './core/clock.service';
import { SERVICES, SLOT, TABLES } from './core/config';
import { I18n } from './core/i18n.service';
import { Booking, ServiceId, Status } from './core/models';
import { Lang } from './core/texts';
import { addDays, formatTime, isValidDateKey } from './core/time';
import { Timeline } from './timeline/timeline';

interface Toast {
  text: string;
  undo?: () => void;
}

@Component({
  selector: 'app-root',
  imports: [Timeline, BookingList, BookingForm],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(BookingStore);
  protected readonly clock = inject(Clock);

  protected readonly date = signal(this.clock.today());
  /** Lunch until 5 pm, dinner after. */
  protected readonly service = signal<ServiceId>(this.clock.minutes() >= 17 * 60 ? 'dinner' : 'lunch');
  /** On phones only one of the two is shown at a time. */
  protected readonly view = signal<'timeline' | 'list'>('timeline');
  protected readonly draft = signal<Draft | null>(null);
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected readonly services: ServiceId[] = ['lunch', 'dinner'];
  protected readonly langs: Lang[] = ['en', 'es'];
  protected readonly tableCount = TABLES.length;

  protected readonly isToday = computed(() => this.date() === this.clock.today());
  protected readonly bookings = computed(() => forService(this.store.bookings(), this.date(), this.service()));
  protected readonly stats = computed(() => serviceStats(this.store.bookings(), this.date(), this.service()));

  /** Only meaningful while the current service is running today. */
  protected readonly freeNow = computed(() => {
    const { open, close } = SERVICES[this.service()];
    const now = this.clock.minutes();
    if (!this.isToday() || now < open || now >= close) return null;
    return TABLES.length - tablesInUse(this.store.bookings(), this.date(), now);
  });

  protected readonly peakText = computed(() => {
    const peak = this.stats().peak;
    if (!peak) return this.i18n.t('stats.none');
    return this.i18n.t('stats.peakValue', { time: formatTime(peak.minute), n: peak.tables, total: TABLES.length });
  });

  protected serviceLabel(s: ServiceId): string {
    return this.i18n.t(`service.${s}`);
  }

  protected shiftDay(days: number): void {
    this.date.update(d => addDays(d, days));
  }

  protected goToday(): void {
    this.date.set(this.clock.today());
  }

  protected pickDate(value: string): void {
    if (isValidDateKey(value)) this.date.set(value);
  }

  protected newBooking(): void {
    const { open, lastBooking } = SERVICES[this.service()];
    // Today, suggest the next free quarter hour; other days, the start of the service.
    let start = open;
    if (this.isToday()) {
      const next = Math.ceil(this.clock.minutes() / SLOT) * SLOT;
      if (next > open && next <= lastBooking) start = next;
    }
    this.draft.set({ date: this.date(), start });
  }

  protected createAt(slot: { tableId: string; start: number }): void {
    this.draft.set({ date: this.date(), ...slot });
  }

  protected edit(booking: Booking): void {
    this.draft.set({ booking, date: booking.date, start: booking.start });
  }

  protected save(input: BookingInput): void {
    const { id, ...data } = input;
    if (id) this.store.update(id, data);
    else this.store.add(data);
    this.draft.set(null);
    // Follow the booking if it moved to another day or service.
    this.date.set(data.date);
    this.service.set(data.start < 18 * 60 ? 'lunch' : 'dinner');
    this.showToast({ text: this.i18n.t('toast.saved', { name: data.name }) });
  }

  protected cancel(booking: Booking): void {
    const previous: Status | undefined = this.store.cancel(booking.id);
    this.draft.set(null);
    this.showToast({
      text: this.i18n.t('toast.cancelled', { name: booking.name }),
      undo: previous ? () => this.store.update(booking.id, { status: previous }) : undefined,
    });
  }

  protected runUndo(): void {
    this.toast()?.undo?.();
    this.toast.set(null);
  }

  protected setLang(lang: Lang): void {
    this.i18n.lang.set(lang);
  }

  protected resetDemo(): void {
    if (confirm(this.i18n.t('app.resetConfirm'))) {
      this.store.resetDemo();
      this.goToday();
    }
  }

  private showToast(toast: Toast): void {
    clearTimeout(this.toastTimer);
    this.toast.set(toast);
    this.toastTimer = setTimeout(() => this.toast.set(null), 6000);
  }
}
