export interface Person {
  id: number
  name: string
  role: string
  city: string
  salary: number
  status: 'active' | 'away'
}

export const ROLES = ['Engineer', 'Designer', 'Product', 'Data'] as const

const FIRST_NAMES = [
  'Alva', 'Noah', 'Maja', 'Elias', 'Vera', 'Hugo', 'Stella', 'Liam', 'Ines', 'Oscar',
  'Selma', 'Adam', 'Ebba', 'Ludvig', 'Signe', 'Arvid', 'Tuva', 'Melker', 'Lykke', 'Sixten',
]

const LAST_NAMES = [
  'Lindqvist', 'Berg', 'Ekström', 'Sandberg', 'Holm', 'Nilsson', 'Åberg', 'Forsberg', 'Dahl', 'Lundgren',
  'Wikström', 'Sjöberg', 'Hedlund', 'Norén', 'Blomqvist', 'Isaksson', 'Öberg', 'Vikander', 'Falk', 'Moberg',
]

const CITIES = [
  'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Lund', 'Umeå',
  'Örebro', 'Linköping', 'Västerås', 'Helsingborg', 'Norrköping', 'Jönköping',
]

/**
 * Deterministic fake dataset — up to 400 unique names (20 × 20 combinations).
 * The e2e tests import this same generator to compute expected filter counts.
 */
export function generatePeople(count: number): Person[] {
  return Array.from({ length: count }, (_, i) => {
    // Cheap integer hash so the columns don't visibly correlate.
    const h = (i * 2654435761) >>> 16
    return {
      id: i + 1,
      name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]}`,
      role: ROLES[h % ROLES.length],
      city: CITIES[(h >> 2) % CITIES.length],
      salary: 32000 + ((h >> 4) % 460) * 100,
      status: h % 3 === 0 ? 'away' : 'active',
    }
  })
}

/** Pretend network call so TanStack Query has something to cache. */
export async function fetchPeople(count: number): Promise<Person[]> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  return generatePeople(count)
}
