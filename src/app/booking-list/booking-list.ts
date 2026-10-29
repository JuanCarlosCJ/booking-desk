import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { holdsTable } from '../core/availability';
import { tableById } from '../core/config';
import { I18n } from '../core/i18n.service';
import { Booking, Status } from '../core/models';
import { formatTime } from '../core/time';

@Component({
  selector: 'app-booking-list',
  templateUrl: './booking-list.html',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingList {
  readonly bookings = input.required<Booking[]>();
  readonly open = output<Booking>();

  protected readonly i18n = inject(I18n);
  protected readonly formatTime = formatTime;
  protected readonly query = signal('');
  protected readonly showInactive = signal(false);

  protected readonly matching = computed(() => {
    const q = this.query().trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return this.bookings()
      .filter(
        b => !q || b.name.toLowerCase().includes(q) || (digits.length > 2 && b.phone.replace(/\D/g, '').includes(digits)),
      )
      .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
  });

  protected readonly active = computed(() => this.matching().filter(holdsTable));
  protected readonly inactive = computed(() => this.matching().filter(b => !holdsTable(b)));

  protected tableName(id: string): string {
    return this.i18n.t('table.short', { n: tableById(id)?.name ?? '?' });
  }

  protected statusLabel(status: Status): string {
    return this.i18n.t(`status.${status}`);
  }
}
