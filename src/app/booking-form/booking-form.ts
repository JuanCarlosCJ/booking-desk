import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { clashesWith, freeTables } from '../core/availability';
import { BookingStore } from '../core/booking.store';
import { defaultDuration, DURATIONS, tableById, TABLES } from '../core/config';
import { I18n } from '../core/i18n.service';
import { Booking, Status, Table } from '../core/models';
import { allSlots, formatTime, isValidDateKey } from '../core/time';

/** What the form opens with: an existing booking, or a date/time (and maybe a table) for a new one. */
export interface Draft {
  booking?: Booking;
  date: string;
  start: number;
  tableId?: string;
}

export type BookingInput = Omit<Booking, 'id'> & { id?: string };

@Component({
  selector: 'app-booking-form',
  imports: [ReactiveFormsModule],
  templateUrl: './booking-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingForm implements OnInit, AfterViewInit {
  readonly draft = input.required<Draft>();
  readonly save = output<BookingInput>();
  readonly cancelBooking = output<Booking>();
  readonly close = output<void>();

  protected readonly i18n = inject(I18n);
  private readonly store = inject(BookingStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  protected readonly formatTime = formatTime;
  protected readonly slots = allSlots();
  protected readonly durations = DURATIONS;
  protected readonly tables = TABLES;
  protected readonly statuses: Status[] = ['confirmed', 'seated', 'done', 'noshow', 'cancelled'];

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    phone: ['', Validators.maxLength(30)],
    partySize: [2, [Validators.required, Validators.min(1), Validators.max(30)]],
    date: ['', [Validators.required, c => (isValidDateKey(c.value) ? null : { date: true })]],
    start: [0, Validators.required],
    duration: [90, Validators.required],
    tableId: ['', Validators.required],
    notes: ['', Validators.maxLength(300)],
    status: ['confirmed' as Status],
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  protected get isEdit(): boolean {
    return !!this.draft().booking;
  }

  /** Other bookings that would overlap at the chosen table. */
  protected readonly clashes = computed(() => {
    const v = this.value();
    if (!v.tableId || !isValidDateKey(v.date)) return [];
    return clashesWith({ ...v, excludeId: this.draft().booking?.id }, this.store.bookings());
  });

  protected readonly table = computed(() => tableById(this.value().tableId));
  protected readonly tooSmall = computed(() => {
    const t = this.table();
    return !!t && this.value().partySize > t.seats;
  });

  private readonly free = computed(() => {
    const v = this.value();
    if (!isValidDateKey(v.date) || !(v.partySize > 0)) return [];
    return freeTables(TABLES, this.store.bookings(), { ...v, excludeId: this.draft().booking?.id });
  });

  /** Other free tables that fit, to switch to with one click. */
  protected readonly suggestions = computed(() => this.free().filter(t => t.id !== this.value().tableId).slice(0, 6));

  private readonly busyIds = computed(() => {
    const v = this.value();
    if (!isValidDateKey(v.date)) return new Set<string>();
    const exclude = this.draft().booking?.id;
    return new Set(
      TABLES.filter(t => clashesWith({ ...v, tableId: t.id, excludeId: exclude }, this.store.bookings()).length).map(
        t => t.id,
      ),
    );
  });

  ngOnInit(): void {
    const d = this.draft();
    if (d.booking) {
      const { id: _id, ...rest } = d.booking;
      this.form.setValue(rest);
    } else {
      const partySize = 2;
      const duration = defaultDuration(partySize);
      const tableId =
        d.tableId ??
        freeTables(TABLES, this.store.bookings(), { date: d.date, start: d.start, duration, partySize })[0]?.id ??
        '';
      this.form.patchValue({ date: d.date, start: d.start, partySize, duration, tableId });
    }

    // Bigger groups stay longer, unless staff already chose a duration by hand.
    this.form.controls.partySize.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(size => {
      const duration = this.form.controls.duration;
      if (!duration.dirty && size > 0) duration.setValue(defaultDuration(size));
    });
  }

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
    this.nameInput().nativeElement.focus();
  }

  protected tableOption(t: Table): string {
    const text = this.i18n.t('form.tableOption', {
      name: this.i18n.t('table.name', { n: t.name }),
      seats: t.seats,
      area: this.i18n.t(`area.${t.area}`),
    });
    return this.busyIds().has(t.id) ? `${text} (${this.i18n.t('form.busy')})` : text;
  }

  protected tableName(t: Table | undefined): string {
    return this.i18n.t('table.name', { n: t?.name ?? '?' });
  }

  protected statusLabel(s: Status): string {
    return this.i18n.t(`status.${s}`);
  }

  protected pickTable(t: Table): void {
    this.form.controls.tableId.setValue(t.id);
  }

  protected showError(name: 'name' | 'partySize' | 'date'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit(): void {
    if (this.form.invalid || this.clashes().length) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({ ...v, name: v.name.trim(), phone: v.phone.trim(), notes: v.notes.trim(), id: this.draft().booking?.id });
  }

  /** Esc closes the dialog through our own output, so the parent stays in charge. */
  protected onCancelEvent(event: Event): void {
    event.preventDefault();
    this.close.emit();
  }
}
