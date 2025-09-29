export type Sex = "M" | "F" | "U";

export interface NameParts {
  given?: string;
  surname?: string;
  display?: string;
}

export interface Event {
  type: "BIRT" | "DEAT" | string;
  date?: string;  // Accepts ISO-like or GEDCOM-like strings; unchanged if unknown
  place?: string;
  placeRef?: string; // Preserve original XML reference/ID (e.g., "place00161")
}

export interface Person {
  id: string;
  name?: string; // Typically "Given Surname" - kept for backward compatibility
  nameParts?: NameParts; // Structured name parts
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