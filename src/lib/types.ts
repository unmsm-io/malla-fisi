export type Category = "EEGG" | "ESPECIFICO" | "ESPECIALIDAD";

export interface Course {
  code: string;
  name: string;
  ht: number;
  hp: number;
  hl: number;
  th: number;
  cred: number;
  category: Category;
  prereqs: string[];
  defaultCycle: number;
}

export interface Career {
  label: string;
  slug: string;
  specifics: Course[];
  specialty: Course[];
}

export interface CoursesData {
  careers: Record<string, Career>;
}

export type Placement = Record<string, number>;
