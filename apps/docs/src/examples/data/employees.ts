/**
 * The dataset behind nearly every demo. One type wide enough to cover every
 * `meta.type` the grid knows - string, number, date, boolean, select and
 * multiSelect - so a reader who has met it once reads every later demo faster.
 *
 * Generation is deterministic: the same index always produces the same row, so
 * nothing shifts between reloads, screenshots or test runs.
 */

export type EmployeeStatus = "Active" | "On leave" | "Terminated";

export type Employee = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  /** `meta.type: "select"` - one of {@link DEPARTMENTS}. */
  department: string;
  location: string;
  /** `meta.type: "number"`, formatted with {@link sek}. */
  salary: number;
  age: number;
  /** `meta.type: "date"` - ISO `YYYY-MM-DD`, which is what the date editor writes. */
  hired: string;
  /** `meta.type: "boolean"`. */
  active: boolean;
  status: EmployeeStatus;
  /** `meta.type: "multiSelect"` - a subset of {@link SKILLS}. */
  skills: Array<string>;
};

export const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Sales",
  "HR",
  "Finance",
  "Marketing",
  "Operations",
] as const;

export const LOCATIONS = ["Stockholm", "Göteborg", "Malmö", "Remote"] as const;

export const SKILLS = [
  "React",
  "TypeScript",
  ".NET",
  "SQL",
  "Figma",
  "Excel",
  "Kubernetes",
] as const;

const FIRST_NAMES = [
  "Anna", "Erik", "Maria", "Lars", "Sofia", "Johan", "Emma", "Anders",
  "Karin", "Mikael", "Lena", "Patrik", "Helena", "Martin", "Cecilia",
  "Fredrik", "Sara", "Tobias", "Åsa", "Daniel",
];

const LAST_NAMES = [
  "Lindqvist", "Johansson", "Svensson", "Eriksson", "Karlsson", "Nilsson",
  "Petersson", "Gustafsson", "Magnusson", "Olsson", "Persson", "Björk",
  "Lundström", "Holm", "Strand",
];

/** Strips the diacritics an email address cannot carry. */
const asciiFold = (value: string) =>
  value
    .toLowerCase()
    .replace(/å|ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e");

/**
 * Row `index` of the sequence - a pure function, so any slice of the data is
 * reproducible without generating what comes before it.
 */
export function makeEmployee(index: number): Employee {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(index * 3 + 7) % LAST_NAMES.length];
  const month = String(1 + (index % 12)).padStart(2, "0");
  const day = String(1 + ((index * 7) % 28)).padStart(2, "0");

  return {
    id: index + 1,
    firstName,
    lastName,
    email: `${asciiFold(firstName)}.${asciiFold(lastName)}@example.se`,
    department: DEPARTMENTS[index % DEPARTMENTS.length],
    location: LOCATIONS[(index * 3 + 1) % LOCATIONS.length],
    salary: 42_000 + ((index * 3761 + 17) % 80) * 1000,
    age: 22 + ((index * 17) % 40),
    hired: `20${18 + (index % 8)}-${month}-${day}`,
    active: index % 5 !== 3,
    status: index % 10 < 7 ? "Active" : index % 10 < 9 ? "On leave" : "Terminated",
    skills: [
      SKILLS[index % SKILLS.length],
      SKILLS[(index + 2) % SKILLS.length],
    ],
  };
}

/**
 * `count` rows, optionally starting further into the sequence - `idOffset`
 * keeps two grids on one page from sharing row ids.
 */
export function makeEmployees(count: number, idOffset = 0): Array<Employee> {
  return Array.from({ length: count }, (_, index) =>
    makeEmployee(idOffset + index),
  );
}

/**
 * The default set. Module scope, so every demo that only reads it shares one
 * array and never rebuilds the table's row model.
 */
export const EMPLOYEES: Array<Employee> = makeEmployees(200);

/** Enough rows that virtualization is the only reason the page stays fast. */
export const MANY_EMPLOYEES: Array<Employee> = makeEmployees(5_000);

export const sek = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });
