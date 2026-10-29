import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { dateKey, minutesOf } from './time';

/** The current time, refreshed every 30 seconds for the "now" line. */
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly now = signal(new Date());
  readonly today = computed(() => dateKey(this.now()));
  readonly minutes = computed(() => minutesOf(this.now()));

  constructor() {
    const id = setInterval(() => this.now.set(new Date()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
