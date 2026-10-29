import { defaultDuration, SERVICES, SLOT, TABLES } from './config';
import { Booking, Status } from './models';
import { addDays, parseDateKey } from './time';

const FIRST = [
  'Lucía', 'Marco', 'Elena', 'Javier', 'Sofía', 'Daniel', 'Carmen', 'Hugo', 'Paula', 'Álvaro', 'Laura',
  'Diego', 'Marta', 'Pablo', 'Irene', 'Sergio', 'Nuria', 'Tomás', 'Claire', 'James', 'Anna', 'Peter', 'Emma', 'Lars',
];
const LAST = [
  'García', 'Romero', 'Navarro', 'Ruiz', 'Moreno', 'Castro', 'Ortega', 'Delgado', 'Vidal', 'Serrano',
  'Molina', 'Blanco', 'Smith', 'Müller', 'Rossi', 'Dubois', 'Jensen', 'Brown',
];
const NOTES = {
  en: ['Birthday, bringing a cake', 'High chair needed', 'Nut allergy', 'Window seat if possible', 'Gluten-free', 'Anniversary', 'Wheelchair access'],
  es: ['Cumpleaños, traen tarta', 'Necesitan trona', 'Alergia a frutos secos', 'Junto a la ventana si es posible', 'Sin gluten', 'Aniversario', 'Acceso en silla de ruedas'],
};

/** Small seeded random generator, so each day always gets the same demo bookings. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/** How full the restaurant is, by weekday and service. */
function busyness(date: string, service: 'lunch' | 'dinner'): number {
  const day = parseDateKey(date).getDay(); // 0 = Sunday
  if (service === 'lunch') return day === 0 || day === 6 ? 0.75 : 0.4;
  if (day === 5 || day === 6) return 0.85;
  if (day === 1) return 0.3;
  return 0.5;
}

/**
 * Realistic bookings from 3 days ago to 2 weeks ahead, never overlapping.
 * Past bookings are finished; today's depend on the time of day.
 */
export function generateDemo(today: string, nowMinutes: number, lang: 'en' | 'es'): Booking[] {
  const out: Booking[] = [];
  for (let offset = -3; offset <= 14; offset++) {
    const date = addDays(today, offset);
    const rand = mulberry32(hash(date));
    const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];

    for (const service of Object.values(SERVICES)) {
      const busy = busyness(date, service.id);
      for (const table of TABLES) {
        let cursor = service.open;
        while (cursor <= service.lastBooking) {
          if (rand() > busy) {
            cursor += 60;
            continue;
          }
          const start = cursor + SLOT * Math.floor(rand() * 3);
          if (start > service.lastBooking) break;
          const partySize = Math.max(1, table.seats - Math.floor(rand() * Math.min(3, table.seats)));
          const duration = defaultDuration(partySize);

          // Always draw both numbers, so the time of day never changes which bookings get generated.
          const noShowRoll = rand();
          const cancelRoll = rand();
          let status: Status = 'confirmed';
          if (offset < 0) status = noShowRoll < 0.05 ? 'noshow' : 'done';
          else if (offset === 0) status = start + duration <= nowMinutes ? 'done' : start <= nowMinutes ? 'seated' : 'confirmed';
          if (status === 'confirmed' && cancelRoll < 0.04) status = 'cancelled';

          out.push({
            id: `demo-${date}-${table.id}-${start}`,
            date,
            start,
            duration,
            tableId: table.id,
            name: `${pick(FIRST)} ${pick(LAST)}`,
            phone: `6${Math.floor(rand() * 1e8).toString().padStart(8, '0').replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3')}`,
            partySize,
            notes: rand() < 0.15 ? pick(NOTES[lang]) : '',
            status,
          });
          cursor = start + duration + SLOT * Math.floor(rand() * 4);
        }
      }
    }
  }
  return out;
}
