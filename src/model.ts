export type Sex = "M" | "F" | "U";

export interface Place {
  id: string;
  name: string;
  lat?: string;
  long?: string;
}

export interface Source {
  id: string;
  title?: string;
  author?: string;
  publication?: string;
}

export interface SourceCitation {
  sourceId: string;
  page?: string;
  data?: string;
}

export interface Event {
  type: "BIRT" | "DEAT" | string;
  date?: string;  // Accepts ISO-like or GEDCOM-like strings; unchanged if unknown
  place?: string;  // Can be a reference ID (e.g., "place00055") or plain text
  placeId?: string;  // Reference to a Place entity
  sources?: SourceCitation[];
}

export interface Person {
  id: string;
  name?: string; // Typically "Given Surname"
  sex?: Sex;
  events?: Event[];
  famc?: string[]; // Child in families
  fams?: string[]; // Spouse in families
  sources?: SourceCitation[];
}

export interface Family {
  id: string;
  husb?: string;
  wife?: string;
  chil?: string[];
  sources?: SourceCitation[];
}