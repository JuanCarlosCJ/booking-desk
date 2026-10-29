import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { holdsTable } from '../core/availability';
import { Clock } from '../core/clock.service';
import { AREAS, SERVICES, SLOT, TABLES } from '../core/config';
import { I18n } from '../core/i18n.service';
import { Area, Booking, ServiceId, Table } from '../core/models';
import { formatTime } from '../core/time';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Timeline {
  readonly date = input.required<string>();
  readonly service = input.required<ServiceId>();
  /** Bookings for this date and service. */
  readonly bookings = input.required<Booking[]>();

  readonly open = output<Booking>();
  readonly create = output<{ tableId: string; start: number }>();

  protected readonly i18n = inject(I18n);
  private readonly clock = inject(Clock);
  protected readonly formatTime = formatTime;

  protected readonly range = computed(() => SERVICES[this.service()]);
  protected readonly span = computed(() => this.range().close - this.range().open);

  protected readonly hours = computed(() => {
    const out: number[] = [];
    for (let m = this.range().open; m < this.range().close; m += 60) out.push(m);
    return out;
  });

  protected readonly groups = AREAS.map(area => ({ area, tables: TABLES.filter(t => t.area === area) }));

  protected readonly byTable = computed(() => {
    const map = new Map<string, Booking[]>();
    for (const b of this.bookings()) {
      if (!holdsTable(b)) continue;
      map.set(b.tableId, [...(map.get(b.tableId) ?? []), b]);
    }
    return map;
  });

  /** Position of the red "now" line, or null when it's not on screen. */
  protected readonly nowPct = computed(() => {
    if (this.date() !== this.clock.today()) return null;
    const m = this.clock.minutes();
    const { open, close } = this.range();
    return m >= open && m <= close ? this.pct(m) : null;
  });

  protected pct(minute: number): number {
    return ((minute - this.range().open) / this.span()) * 100;
  }

  protected width(b: Booking): number {
    const end = Math.min(b.start + b.duration, this.range().close);
    return ((end - b.start) / this.span()) * 100;
  }

  protected areaLabel(area: Area): string {
    return this.i18n.t(`area.${area}`);
  }

  protected tableLabel(t: Table): string {
    return this.i18n.t('table.name', { n: t.name });
  }

  protected blockLabel(b: Booking, t: Table): string {
    return `${this.tableLabel(t)}, ${formatTime(b.start)}–${formatTime(b.start + b.duration)}, ${b.name}, ${this.i18n.guests(b.partySize)}, ${this.i18n.t(`status.${b.status}`)}`;
  }

  /** Clicking empty space on a row starts a booking at that table and time. */
  protected onTrackClick(event: MouseEvent, table: Table): void {
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const { open, lastBooking } = this.range();
    const raw = open + ratio * this.span();
    const start = Math.min(lastBooking, Math.max(open, Math.floor(raw / SLOT) * SLOT));
    this.create.emit({ tableId: table.id, start });
  }
}
