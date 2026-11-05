import type { Event, Family, Person, Picture, Place, Source, SourceCitation } from "../model";

const INDI_STRUCTURAL = new Set([
  "NAME",
  "SEX",
  "FAMC",
  "FAMS",
  "NOTE",
  "OBJE",
  "SOUR",
  "RIN",
  "CHAN",
  "REFN",
  "ALIA",
  "ASSO",
  "SUBM",
  "ANCI",
  "DESI",
  "RESN",
  "NCHI",
  "NMR",
  "_UID",
]);

const FAM_STRUCTURAL = new Set([
  "HUSB",
  "WIFE",
  "CHIL",
  "NOTE",
  "OBJE",
  "SOUR",
  "RIN",
  "CHAN",
  "REFN",
  "_UID",
]);

type TextField = {
  get: () => string | undefined;
  set: (value: string) => void;
};

const decodeDataUrl = (value: string): Uint8Array | undefined => {
  const marker = "base64,";
  const idx = value.startsWith("data:") ? value.indexOf(marker) : -1;
  if (idx < 0) return undefined;
  const binary = atob(value.slice(idx + marker.length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const extensionFor = (file: string | undefined): string => {
  const match = file?.match(/\.([a-z0-9]{2,5})(?:$|\?)/i);
  return match?.[1]?.toLowerCase() || "bin";
};

/**
 * Read a GEDCOM into the internal model.
 * Keeps every individual and family event, notes, source records, and pictures.
 */
export function gedToModel(ged: string): {
  persons: Person[];
  families: Family[];
  places: Place[];
  sources: Source[];
} {
  const lines = ged.replace(/\r\n/g, "\n").split("\n");
  const persons: Person[] = [];
  const families: Family[] = [];
  const sources: Source[] = [];
  const pictures: Picture[] = [];

  let record: "INDI" | "FAM" | "SOUR" | "OBJE" | undefined;
  let person: Person | undefined;
  let family: Family | undefined;
  let source: Source | undefined;
  let picture: Picture | undefined;
  let event: Event | undefined;
  let text: TextField | undefined;
  let placeName: string | undefined;
  let lat: string | undefined;
  let long: string | undefined;
  let inMap = false;

  const rememberPlace = () => {
    if (!event || !placeName) return;
    if (lat || long) {
      event.placeId = `place-${placesKey(placeName, lat, long)}`;
    }
  };

  const flush = () => {
    rememberPlace();
    if (record === "INDI" && person) persons.push(person);
    if (record === "FAM" && family) families.push(family);
    if (record === "SOUR" && source) sources.push(source);
    if (record === "OBJE" && picture) pictures.push(picture);
    record = undefined;
    person = undefined;
    family = undefined;
    source = undefined;
    picture = undefined;
    event = undefined;
    text = undefined;
    placeName = undefined;
    lat = undefined;
    long = undefined;
    inMap = false;
  };

  const setText = (field: TextField) => {
    text = field;
  };

  for (const raw of lines) {
    const line = raw.replace(/^\uFEFF/, "");
    if (!line.trim()) continue;
    const levelMatch = /^(\d+)\s+(.*)$/.exec(line.trim());
    if (!levelMatch) continue;
    const level = Number(levelMatch[1]);
    const rest = levelMatch[2];

    if (level === 0) {
      flush();
      const recordMatch = /^@([^@]+)@\s+(INDI|FAM|SOUR|OBJE)/.exec(rest);
      if (!recordMatch) continue;
      const id = recordMatch[1];
      record = recordMatch[2] as typeof record;
      if (record === "INDI") person = { id, events: [], pictures: [] };
      else if (record === "FAM") family = { id, chil: [], events: [] };
      else if (record === "SOUR") source = { id };
      else picture = { id };
      continue;
    }

    if (level === 2 && /^(CONC|CONT)\b/.test(rest)) {
      const piece = rest.replace(/^(CONC|CONT)\s?/, "");
      if (!text) continue;
      const prev = text.get() ?? "";
      text.set(rest.startsWith("CONC") ? prev + piece : `${prev}${prev ? "\n" : ""}${piece}`);
      continue;
    }

    if (record === "INDI" && person) {
      if (level === 1) {
        event = undefined;
        inMap = false;
        const tagMatch = /^([A-Z0-9_]+)(?:\s+(.*))?$/.exec(rest);
        if (!tagMatch) continue;
        const tag = tagMatch[1];
        const value = tagMatch[2];
        if (tag === "NAME") {
          const surnameMatch = value ? /\/([^/]*)\//.exec(value) : undefined;
          const surname = surnameMatch?.[1]?.trim();
          const given = value?.replace(/\/[^/]*\//, "").trim();
          person.given = given || undefined;
          person.surname = surname || undefined;
          person.name = [given, surname].filter(Boolean).join(" ") || value;
          setText({
            get: () => person!.name,
            set: (next) => {
              person!.name = next;
            },
          });
          continue;
        }
        if (tag === "SEX" && value && /^[MFU]$/.test(value)) {
          person.sex = value as Person["sex"];
          continue;
        }
        if (tag === "FAMC" && value) {
          const id = value.replace(/@/g, "");
          person.famc = [...(person.famc ?? []), id];
          continue;
        }
        if (tag === "FAMS" && value) {
          const id = value.replace(/@/g, "");
          person.fams = [...(person.fams ?? []), id];
          continue;
        }
        if (tag === "NOTE") {
          person.note = value ?? "";
          setText({
            get: () => person!.note,
            set: (next) => {
              person!.note = next;
            },
          });
          continue;
        }
        if (tag === "OBJE") {
          const linked = value?.match(/^@([^@]+)@$/)?.[1];
          const pic: Picture = { id: linked || `${person.id}-pic${person.pictures!.length + 1}` };
          person.pictures!.push(pic);
          picture = pic;
          continue;
        }
        if (INDI_STRUCTURAL.has(tag)) {
          picture = undefined;
          continue;
        }
        picture = undefined;
        event = { type: tag, typeName: value };
        person.events!.push(event);
        if (value) {
          setText({
            get: () => event!.typeName,
            set: (next) => {
              event!.typeName = next;
            },
          });
        }
      } else if (level === 2 && rest.startsWith("GIVN ") && person) {
        person.given = rest.slice(5);
        person.name = [person.given, person.surname].filter(Boolean).join(" ");
      } else if (level === 2 && rest.startsWith("SURN ")) {
        person.surname = rest.slice(5);
        person.name = [person.given, person.surname].filter(Boolean).join(" ");
      } else if (event && level >= 2) {
        applyEventLine(event, level, rest, () => {
          inMap = true;
        }, (field) => {
          text = field;
        }, (name) => {
          placeName = name;
        }, (value, which) => {
          if (which === "lat") event!.lat = value;
          else event!.long = value;
          if (which === "lat") lat = value;
          else long = value;
        });
      } else if (picture && level === 2) {
        applyPictureLine(picture, rest, (field) => {
          text = field;
        });
      }
      continue;
    }

    if (record === "FAM" && family) {
      if (level === 1) {
        event = undefined;
        const tagMatch = /^([A-Z0-9_]+)(?:\s+(.*))?$/.exec(rest);
        if (!tagMatch) continue;
        const tag = tagMatch[1];
        const value = tagMatch[2];
        if (tag === "HUSB" && value) {
          family.husb = value.replace(/@/g, "");
          continue;
        }
        if (tag === "WIFE" && value) {
          family.wife = value.replace(/@/g, "");
          continue;
        }
        if (tag === "CHIL" && value) {
          family.chil!.push(value.replace(/@/g, ""));
          continue;
        }
        if (tag === "NOTE") {
          family.note = value ?? "";
          setText({
            get: () => family!.note,
            set: (next) => {
              family!.note = next;
            },
          });
          continue;
        }
        if (FAM_STRUCTURAL.has(tag)) continue;
        event = { type: tag, typeName: value };
        family.events!.push(event);
      } else if (event) {
        applyEventLine(event, level, rest, () => {
          inMap = true;
        }, (field) => {
          text = field;
        }, (name) => {
          placeName = name;
        }, (value, which) => {
          if (which === "lat") lat = value;
          else long = value;
        });
      }
      continue;
    }

    if (record === "SOUR" && source && level === 1) {
      const tagMatch = /^([A-Z0-9_]+)(?:\s+(.*))?$/.exec(rest);
      if (!tagMatch) continue;
      const value = tagMatch[2] ?? "";
      if (tagMatch[1] === "TITL") {
        source.title = value;
        setText({ get: () => source!.title, set: (next) => { source!.title = next; } });
      } else if (tagMatch[1] === "AUTH") {
        source.author = value;
        setText({ get: () => source!.author, set: (next) => { source!.author = next; } });
      } else if (tagMatch[1] === "PUBL" || tagMatch[1] === "TEXT") {
        source.publication = value;
        setText({ get: () => source!.publication, set: (next) => { source!.publication = next; } });
      }
      continue;
    }

    if (record === "OBJE" && picture && level === 1) {
      applyPictureLine(picture, rest, (field) => {
        text = field;
      });
    }
  }
  flush();

  const placeMap = new Map<string, Place>();
  const takePlaces = (events: Event[] | undefined) => {
    events?.forEach((item) => {
      if (!item.place && !item.lat && !item.long) return;
      const name = item.place || "Place";
      const id = `place-${placesKey(name, item.lat, item.long)}`;
      item.placeId = id;
      if (!placeMap.has(id)) {
        placeMap.set(id, { id, name, lat: item.lat, long: item.long });
      }
    });
  };
  const loosePictures = new Map(pictures.map((item) => [item.id, item]));
  persons.forEach((item) => {
    takePlaces(item.events);
    item.pictures = (item.pictures ?? []).map((pic) => {
      const full = loosePictures.get(pic.id);
      const merged = full ? { ...full, ...pic, file: pic.file || full.file, bytes: pic.bytes || full.bytes, title: pic.title || full.title } : pic;
      if (merged.bytes && !merged.file?.startsWith("media/")) {
        merged.file = `media/${merged.id}.${extensionFor(merged.file)}`;
      }
      return merged;
    });
  });
  families.forEach((item) => takePlaces(item.events));

  return { persons, families, places: [...placeMap.values()], sources };
}

const placesKey = (name: string, lat?: string, long?: string) =>
  `${name}|${lat ?? ""}|${long ?? ""}`.replace(/\s+/g, "-");

const applyEventLine = (
  event: Event,
  level: number,
  rest: string,
  onMap: () => void,
  onText: (field: TextField) => void,
  onPlace: (name: string) => void,
  onCoord: (value: string, which: "lat" | "long") => void
) => {
  if (level !== 2 && level !== 4) {
    if (level === 3 && rest === "MAP") onMap();
    return;
  }
  const tagMatch = /^([A-Z0-9_]+)(?:\s+(.*))?$/.exec(rest);
  if (!tagMatch) return;
  const tag = tagMatch[1];
  const value = tagMatch[2] ?? "";
  if (level === 2 && tag === "DATE") {
    event.date = value;
    onText({ get: () => event.date, set: (next) => { event.date = next; } });
  } else if (level === 2 && tag === "PLAC") {
    event.place = value;
    onPlace(value);
    onText({ get: () => event.place, set: (next) => { event.place = next; } });
  } else if (level === 2 && tag === "TYPE") {
    event.typeName = value;
    onText({ get: () => event.typeName, set: (next) => { event.typeName = next; } });
  } else if (level === 2 && tag === "NOTE") {
    event.note = value;
    onText({ get: () => event.note, set: (next) => { event.note = next; } });
  } else if (level === 4 && tag === "LATI") {
    onCoord(value, "lat");
  } else if (level === 4 && tag === "LONG") {
    onCoord(value, "long");
  }
};

const applyPictureLine = (
  picture: Picture,
  rest: string,
  onText: (field: TextField) => void
) => {
  const tagMatch = /^([A-Z0-9_]+)(?:\s+(.*))?$/.exec(rest);
  if (!tagMatch) return;
  const value = tagMatch[2] ?? "";
  if (tagMatch[1] === "FILE") {
    const bytes = decodeDataUrl(value);
    if (bytes) {
      picture.bytes = bytes;
      picture.file = `media/${picture.id}.bin`;
    } else {
      picture.file = value;
    }
    onText({ get: () => picture.file, set: (next) => { picture.file = next; } });
  } else if (tagMatch[1] === "TITL") {
    picture.title = value;
    onText({ get: () => picture.title, set: (next) => { picture.title = next; } });
  } else if (tagMatch[1] === "FORM" && picture.file?.endsWith(".bin")) {
    picture.file = `media/${picture.id}.${value.toLowerCase()}`;
  }
};

export const collectPictureFiles = (persons: Person[]): Array<{ path: string; data: Uint8Array }> =>
  persons.flatMap((person) =>
    (person.pictures ?? []).flatMap((picture) =>
      picture.bytes && picture.file ? [{ path: picture.file, data: picture.bytes }] : []
    )
  );
