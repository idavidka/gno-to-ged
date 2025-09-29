export type Sex = "M" | "F" | "U";

export interface Event {
  type: "BIRT" | "DEAT" | string;
  date?: string;  // Accepts ISO-like or GEDCOM-like strings; unchanged if unknown
  place?: string;
}

export interface Person {
  id: string;
  name?: string; // Typically "Given Surname"
  sex?: Sex;
  events?: Event[];
  famc?: string[]; // Child in families
  fams?: string[]; // Spouse in families
}

export interface Family {
  id: string;
  husb?: string;
  wife?: string;
  chil?: string[];
}