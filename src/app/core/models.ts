export type Status = 'confirmed' | 'seated' | 'done' | 'cancelled' | 'noshow';
export type Area = 'dining' | 'terrace' | 'private';
export type ServiceId = 'lunch' | 'dinner';

export interface Table {
  id: string;
  /** What staff call it: "1", "2"... */
  name: string;
  seats: number;
  area: Area;
}

export interface Booking {
  id: string;
  /** Local date, "YYYY-MM-DD". */
  date: string;
  /** Minutes from midnight. Can pass 1440 for late dinners. */
  start: number;
  /** Minutes. */
  duration: number;
  tableId: string;
  name: string;
  phone: string;
  partySize: number;
  notes: string;
  status: Status;
}

export interface Service {
  id: ServiceId;
  open: number;
  /** Last time a booking can start. */
  lastBooking: number;
  /** When the timeline ends. */
  close: number;
}
