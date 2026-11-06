import { XMLBuilder } from "fast-xml-parser";
import type { Family, Person, Place, Source } from "../model";
import { GnoFormat } from "../types";

function eventToNode(
  ev: { type: string; date?: string; place?: string; placeId?: string },
  format: GnoFormat
) {
  if (format === "gramps") {
    // Gramps uses different tag names
    const tag =
      ev.type === "BIRT"
        ? "birth"
        : ev.type === "DEAT"
        ? "death"
        : ev.type.toLowerCase();
    const node: any = {};
    if (ev.date) node.dateval = { "@_val": ev.date };
    if (ev.placeId || ev.place) {
      node.place = { "@_hlink": ev.placeId || ev.place };
    }
    return { [tag]: node };
  } else {
    // GenoPro and generic format
    const tag =
      ev.type === "BIRT" ? "Birth" : ev.type === "DEAT" ? "Death" : ev.type;
    const attrs: any = {};
    if (ev.date) attrs["@_Date"] = ev.date;
    // Prefer placeId reference over plain text place
    if (ev.placeId) attrs["@_Place"] = ev.placeId;
    else if (ev.place) attrs["@_Place"] = ev.place;
    return { [tag]: attrs };
  }
}

const GEDCOM_MONTHS: Record<string, string> = {
  JAN: "Jan",
  FEB: "Feb",
  MAR: "Mar",
  APR: "Apr",
  MAY: "May",
  JUN: "Jun",
  JUL: "Jul",
  AUG: "Aug",
  SEP: "Sep",
  OCT: "Oct",
  NOV: "Nov",
  DEC: "Dec",
};

const GEDCOM_QUALIFIERS: Record<string, string> = {
  ABT: "Abt",
  ABOUT: "Abt",
  EST: "Est",
  CAL: "Cal",
  BEF: "Bef",
  BEFORE: "Bef",
  AFT: "Aft",
  AFTER: "Aft",
  BET: "Bet",
  BETWEEN: "Bet",
  AND: "and",
  FROM: "From",
  TO: "to",
};

/** GenoPro dates look like `1 Jan 1796`, not GEDCOM `01 JAN 1796`. */
const genoDate = (value?: string) =>
  value
    ?.replace(/[A-Za-z]+/g, (word) => {
      const upper = word.toUpperCase();
      return GEDCOM_MONTHS[upper] ?? GEDCOM_QUALIFIERS[upper] ?? word;
    })
    .replace(/\b0(\d)\b/g, "$1");

const eventElement = (ev: { type: string; typeName?: string; date?: string; place?: string; placeId?: string; note?: string }) => {
  const node: any = {};
  if (ev.typeName && ev.type === "EVEN") node["@_Type"] = ev.typeName;
  else if (ev.typeName && ev.type !== "OCCU") node["@_Type"] = ev.typeName;
  if (ev.date) node.Date = genoDate(ev.date);
  if (ev.placeId) node.Place = ev.placeId;
  else if (ev.place) node.Place = ev.place;
  if (ev.note) node.Comment = ev.note;
  if (ev.type === "OCCU" && ev.typeName) node.Description = ev.typeName;
  return node;
};

type Point = { x: number; y: number };

const SLOT = 120;
const GENERATION_GAP = 150;

/**
 * Spouses sit side by side over their children.
 * GenoPro's Y axis grows upward, so ancestors get the larger Y.
 * A family bar connects the two parents and, when there are several
 * children, drops down toward them.
 * In-law families are attached above the spouse they marry in, so a
 * second root does not land on top of the blood line.
 */
const layoutTree = (persons: Person[], families: Family[]) => {
  const generation = new Map<string, number>();
  const rank = (id: string, seen: Set<string>): number => {
    const known = generation.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parentIds = families
      .filter((family) => family.chil?.includes(id))
      .flatMap((family) => [family.husb, family.wife].filter((item): item is string => !!item));
    const value = parentIds.length
      ? Math.max(...parentIds.map((parentId) => rank(parentId, seen))) + 1
      : 0;
    generation.set(id, value);
    return value;
  };
  persons.forEach((person) => rank(person.id, new Set()));

  const positions = new Map<string, Point>();
  const familyPositions = new Map<string, any>();
  const placedFamily = new Set<string>();
  const asParent = (id: string) =>
    families.filter((family) => family.husb === id || family.wife === id);

  const widthOfFamily = (family: Family, seen: Set<string>): number => {
    if (seen.has(family.id)) return SLOT;
    const next = new Set(seen);
    next.add(family.id);
    const children = (family.chil ?? []).reduce(
      (sum, id) => sum + widthOfPerson(id, family.id, next),
      0
    );
    const couple = (family.husb && family.wife ? 2 : 1) * SLOT;
    return Math.max(couple, children, SLOT);
  };

  const widthOfPerson = (id: string, comingFrom: string, seen: Set<string>): number => {
    const own = asParent(id).filter((family) => family.id !== comingFrom);
    if (!own.length) return SLOT;
    return Math.max(
      SLOT,
      own.reduce((sum, family) => sum + widthOfFamily(family, seen), 0)
    );
  };

  const placePerson = (id: string, left: number, comingFrom: string) => {
    const own = asParent(id).filter((family) => family.id !== comingFrom && !placedFamily.has(family.id));
    if (!own.length) return;
    let x = left;
    for (const family of own) {
      placeFamily(family, x);
      x += widthOfFamily(family, new Set());
    }
  };

  const placeFamily = (family: Family, left: number) => {
    if (placedFamily.has(family.id)) return;
    placedFamily.add(family.id);
    const width = widthOfFamily(family, new Set());
    const childWidths = (family.chil ?? []).map((id) => widthOfPerson(id, family.id, new Set([family.id])));
    const children = childWidths.reduce((sum, value) => sum + value, 0);
    let x = left + Math.max(0, (width - children) / 2);
    const childYs: number[] = [];
    (family.chil ?? []).forEach((id, index) => {
      placePerson(id, x, family.id);
      const childY = positions.get(id)?.y;
      if (childY !== undefined) childYs.push(childY);
      x += childWidths[index] ?? SLOT;
    });
    const rowY = childYs.length ? Math.max(...childYs) : 0;
    let childX = left + Math.max(0, (width - children) / 2);
    for (let index = 0; index < (family.chil ?? []).length; index++) {
      const id = family.chil![index];
      if (!positions.has(id)) {
        positions.set(id, { x: childX + (childWidths[index] ?? SLOT) / 2, y: rowY });
      }
      childX += childWidths[index] ?? SLOT;
    }
    const mid = left + width / 2;
    const parentY = rowY + GENERATION_GAP;
    const setParent = (id: string | undefined, parentX: number) => {
      if (!id || positions.has(id)) return;
      positions.set(id, { x: parentX, y: parentY });
    };
    if (family.husb && family.wife) {
      setParent(family.husb, mid - SLOT / 2);
      setParent(family.wife, mid + SLOT / 2);
    } else {
      setParent(family.husb ?? family.wife, mid);
    }
  };

  const subtreeDepth = (family: Family, seen: Set<string>): number => {
    if (seen.has(family.id)) return 0;
    seen.add(family.id);
    const childDepth = (family.chil ?? []).flatMap((id) => asParent(id)).map((child) => subtreeDepth(child, seen));
    return 1 + (childDepth.length ? Math.max(...childDepth) : 0);
  };

  const roots = families.filter((family) => {
    const parents = [family.husb, family.wife].filter((id): id is string => !!id);
    return parents.every((id) => (generation.get(id) ?? 0) === 0);
  });
  const primary =
    roots.reduce<Family | undefined>((best, family) => {
      if (!best) return family;
      return subtreeDepth(family, new Set()) > subtreeDepth(best, new Set()) ? family : best;
    }, undefined) ?? families[0];
  if (primary) placeFamily(primary, 0);

  const attachBirthFamily = (personId: string) => {
    const birth = families.find((family) => family.chil?.includes(personId) && !placedFamily.has(family.id));
    const anchor = positions.get(personId);
    if (!birth || !anchor) return;
    placedFamily.add(birth.id);
    const rowXs = (y: number) =>
      [...positions.values()].filter((point) => point.y === y).map((point) => point.x);
    let siblingX = anchor.x + SLOT;
    for (const siblingId of birth.chil ?? []) {
      if (siblingId === personId || positions.has(siblingId)) continue;
      const taken = rowXs(anchor.y);
      while (taken.some((x) => Math.abs(x - siblingX) < SLOT)) {
        siblingX = Math.max(...taken) + SLOT;
      }
      positions.set(siblingId, { x: siblingX, y: anchor.y });
      siblingX += SLOT;
    }
    const siblingXs = (birth.chil ?? [])
      .map((id) => positions.get(id)?.x)
      .filter((x): x is number => x !== undefined);
    const mid = siblingXs.length ? (Math.min(...siblingXs) + Math.max(...siblingXs)) / 2 : anchor.x;
    const parentY = anchor.y + GENERATION_GAP;
    const coupleLeft = birth.husb && birth.wife ? mid - SLOT / 2 : mid;
    const occupied = rowXs(parentY);
    const blocked = occupied.some((x) => Math.abs(x - coupleLeft) < SLOT || (birth.wife && Math.abs(x - (coupleLeft + SLOT)) < SLOT));
    const origin = blocked && occupied.length ? Math.max(...occupied) + SLOT : coupleLeft;
    const setParent = (id: string | undefined, parentX: number) => {
      if (!id || positions.has(id)) return;
      positions.set(id, { x: parentX, y: parentY });
    };
    if (birth.husb && birth.wife) {
      setParent(birth.husb, origin);
      setParent(birth.wife, origin + SLOT);
    } else {
      setParent(birth.husb ?? birth.wife, origin);
    }
    if (birth.husb) attachBirthFamily(birth.husb);
    if (birth.wife) attachBirthFamily(birth.wife);
  };

  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...positions.keys()]) {
      const before = positions.size;
      attachBirthFamily(id);
      if (positions.size !== before) grew = true;
    }
  }

  let cursor = Math.max(0, ...[...positions.values()].map((point) => point.x)) + SLOT * 2;
  for (const family of families) {
    if (placedFamily.has(family.id)) continue;
    placeFamily(family, cursor);
    cursor = Math.max(cursor, ...[...positions.values()].map((point) => point.x)) + SLOT * 2;
  }
  persons.forEach((person) => {
    if (!positions.has(person.id)) {
      positions.set(person.id, { x: cursor, y: 0 });
      cursor += SLOT;
    }
  });

  const spouseOf = new Map<string, string>();
  for (const family of families) {
    if (family.husb && family.wife) {
      spouseOf.set(family.husb, family.wife);
      spouseOf.set(family.wife, family.husb);
    }
  }
  for (let guard = 0; guard < 40; guard++) {
    let moved = false;
    const rows = new Map<number, string[]>();
    for (const [id, point] of positions) {
      const row = rows.get(point.y) ?? [];
      row.push(id);
      rows.set(point.y, row);
    }
    for (const row of rows.values()) {
      row.sort((a, b) => positions.get(a)!.x - positions.get(b)!.x || a.localeCompare(b));
      for (let index = 1; index < row.length; index++) {
        const previous = positions.get(row[index - 1])!;
        const current = positions.get(row[index])!;
        const gap = current.x - previous.x;
        if (gap >= SLOT) continue;
        if (spouseOf.get(row[index - 1]) === row[index]) continue;
        const delta = SLOT - gap;
        const move = new Set<string>([row[index]]);
        const spouse = spouseOf.get(row[index]);
        if (spouse && spouse !== row[index - 1]) move.add(spouse);
        for (const otherId of row) {
          if (positions.get(otherId)!.x > current.x + 0.01) move.add(otherId);
        }
        for (const id of move) positions.get(id)!.x += delta;
        moved = true;
        break;
      }
      if (moved) break;
    }
    if (!moved) break;
  }

  for (const family of families) {
    const childPoints = (family.chil ?? [])
      .map((id) => positions.get(id))
      .filter((point): point is Point => !!point);
    const left = positions.get(family.husb ?? "") ?? positions.get(family.wife ?? "");
    const right = positions.get(family.wife ?? "") ?? left;
    if (!left || !right) continue;
    const barY = Math.round(left.y - 70);
    const node: any = {
      "#text": `${Math.round((left.x + right.x) / 2)},${barY}`,
      Top: {
        Left: `${Math.round(left.x)},${barY}`,
        Right: `${Math.round(right.x === left.x ? left.x + 60 : right.x)},${barY}`,
      },
    };
    if (childPoints.length > 1) {
      const dropY = Math.round(childPoints[0].y + 50);
      const xs = childPoints.map((point) => point.x).sort((a, b) => a - b);
      node.Bottom = {
        Left: `${Math.round(xs[0])},${dropY}`,
        Right: `${Math.round(xs[xs.length - 1])},${dropY}`,
      };
    }
    familyPositions.set(family.id, node);
  }

  return {
    positions: new Map(
      [...positions].map(([id, point]) => [id, `${Math.round(point.x)},${Math.round(point.y)}`])
    ),
    familyPositions,
  };
};

function buildGenoProXml(
  persons: Person[],
  families: Family[],
  places: Place[],
  sources: Source[]
): any {
  const { positions, familyPositions } = layoutTree(persons, families);
  const marriages = families.flatMap((family) => {
    const marriage = family.events?.find((event) => event.type === "MARR");
    const divorce = family.events?.find((event) => event.type === "DIV");
    if (!marriage && !divorce) return [];
    return [{ id: `marriage-${family.id}`, family, marriage, divorce }];
  });
  const pedigree: any[] = [];
  families.forEach((family) => {
    if (family.husb) {
      pedigree.push({ "@_PedigreeLink": "Parent", "@_Family": family.id, "@_Individual": family.husb });
    }
    if (family.wife) {
      pedigree.push({ "@_PedigreeLink": "Parent", "@_Family": family.id, "@_Individual": family.wife });
    }
    family.chil?.forEach((childId) => {
      pedigree.push({ "@_PedigreeLink": "Biological", "@_Family": family.id, "@_Individual": childId });
    });
  });

  const individuals = persons.map((person) => {
    const node: any = {
      "@_ID": person.id,
      Position: positions.get(person.id) ?? "0,0",
    };
    if (person.sex === "M" || person.sex === "F") node.Gender = person.sex;
    const fullName = person.name || [person.given, person.surname].filter(Boolean).join(" ");
    if (fullName || person.given || person.surname) {
      node.Name = {
        ...(fullName ? { "#text": fullName } : {}),
        ...(person.given ? { First: person.given } : {}),
        ...(person.surname ? { Last: person.surname } : {}),
      };
    }
    if (person.note) node.Comment = person.note;

    const extra: any[] = [];
    person.events?.forEach((event) => {
      const body = eventElement(event);
      if (event.type === "BIRT" && !node.Birth) node.Birth = body;
      else if (event.type === "DEAT" && !node.Death) {
        node.IsDead = "Y";
        node.Death = body;
      }
      else if ((event.type === "CHR" || event.type === "BAPM") && !node.Baptism) node.Baptism = body;
      else if (event.type === "BURI" && !node.Burial) node.Burial = body;
      else if (event.type === "OCCU") {
        node.Occupations = node.Occupations ?? { Occupation: [] };
        node.Occupations.Occupation.push(body);
      } else {
        extra.push({ "@_Type": event.typeName || event.type, ...body, "@_Tag": event.type });
      }
    });
    if (extra.length) node.Events = { Event: extra };
    if (person.pictures?.length) {
      node.Pictures = {
        Picture: person.pictures.map((picture) => {
          const item: any = { "@_ID": picture.id };
          if (picture.file && !picture.file.startsWith("data:")) {
            item.Path = { "@_Relative": picture.file };
          }
          return item;
        }),
      };
    }
    return node;
  });

  return {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    GenoPro: {
      Software: {
        "#text": "GenoPro",
        Version: "3.1.0.1",
      },
      GenoMaps: {
        GenoMap: { "@_Name": "GenoMap1" },
      },
      Individuals: { Individual: individuals },
      Families: {
        Family: families.map((family) => {
          const married = marriages.some((item) => item.family.id === family.id);
          return {
            "@_ID": family.id,
            Position: familyPositions.get(family.id) ?? "0,0",
            ...(married ? { Relation: "Marriage", Unions: `marriage-${family.id}` } : {}),
            ...(family.note ? { Comment: family.note } : {}),
          };
        }),
      },
      Marriages: {
        Marriage: marriages.map((item) => ({
          "@_ID": item.id,
          ...eventElement(item.marriage ?? { type: "MARR" }),
          ...(item.divorce?.date ? { Divorce: { Date: genoDate(item.divorce.date) } } : {}),
        })),
      },
      PedigreeLinks: { PedigreeLink: pedigree },
      ...(places.length
        ? {
            Places: {
              Place: places.map((place) => ({
                "@_ID": place.id,
                Name: place.name,
                ...(place.lat ? { "@_Lat": place.lat } : {}),
                ...(place.long ? { "@_Long": place.long } : {}),
              })),
            },
          }
        : {}),
      ...(sources.length
        ? {
            Sources: {
              Source: sources.map((source) => ({
                "@_ID": source.id,
                ...(source.title ? { Title: source.title } : {}),
                ...(source.author ? { Author: source.author } : {}),
                ...(source.publication ? { Publication: source.publication } : {}),
              })),
            },
          }
        : {}),
    },
  };
}

function buildGrampsXml(
  persons: Person[],
  families: Family[],
  places: Place[],
  sources: Source[]
): any {
  const root: any = {
    database: {
      "@_xmlns": "http://gramps-project.org/xml/1.7.1/",
      people: { person: [] as any[] },
      families: { family: [] as any[] },
      places: { placeobj: [] as any[] },
      sources: { source: [] as any[] },
    },
  };

  for (const p of persons) {
    const node: any = {
      "@_id": p.id,
      "@_handle": p.id,
    };
    if (p.name) {
      node.name = {
        "@_type": "Birth Name",
        first: p.name.split(" ")[0] || "",
        surname: { "#text": p.name.split(" ").slice(1).join(" ") || "" },
      };
    }
    if (p.sex) node.gender = p.sex;

    if (p.events?.length) {
      node.eventref = [];
      for (const ev of p.events) {
        const evNode: any = eventToNode(ev, "gramps");
        node.eventref.push({ "@_hlink": `${p.id}_${ev.type}` });
      }
    }

    if (p.famc?.length) {
      node.childof = p.famc.map((fid) => ({ "@_hlink": fid }));
    }
    if (p.fams?.length) {
      node.parentin = p.fams.map((fid) => ({ "@_hlink": fid }));
    }

    root.database.people.person.push(node);
  }

  for (const f of families) {
    const node: any = {
      "@_id": f.id,
      "@_handle": f.id,
    };
    if (f.husb) node.father = { "@_hlink": f.husb };
    if (f.wife) node.mother = { "@_hlink": f.wife };
    if (f.chil?.length) {
      node.childref = f.chil.map((id) => ({ "@_hlink": id }));
    }
    root.database.families.family.push(node);
  }

  for (const place of places) {
    const node: any = {
      "@_id": place.id,
      "@_handle": place.id,
      "@_type": "Unknown",
      pname: { "@_value": place.name },
    };
    if (place.lat || place.long) {
      node.coord = {
        "@_lat": place.lat || "0",
        "@_long": place.long || "0",
      };
    }
    root.database.places.placeobj.push(node);
  }

  for (const source of sources) {
    const node: any = {
      "@_id": source.id,
      "@_handle": source.id,
    };
    if (source.title) node.stitle = source.title;
    if (source.author) node.sauthor = source.author;
    if (source.publication) node.spubinfo = source.publication;
    root.database.sources.source.push(node);
  }

  return root;
}

function buildLegacyFamilyTreeXml(
  persons: Person[],
  families: Family[],
  places: Place[],
  sources: Source[]
): any {
  const root: any = {
    "?xml": {
      "@_version": "1.0",
      "@_encoding": "UTF-8",
    },
    FamilyTree: {
      "@_xmlns": "http://www.legacyfamilytree.com/",
      "@_Version": "9.0",
      Individuals: { Individual: [] as any[] },
      Families: { Family: [] as any[] },
      Places: { Place: [] as any[] },
      Sources: { Source: [] as any[] },
    },
  };

  for (const p of persons) {
    const node: any = { "@_ID": p.id };
    if (p.name) node["@_FullName"] = p.name;
    if (p.sex && p.sex !== "U") node["@_Gender"] = p.sex;
    if (p.events?.length) {
      node.Events = { Event: [] };
      for (const ev of p.events) {
        const eventNode: any = { "@_Type": ev.type };
        if (ev.date) eventNode["@_Date"] = ev.date;
        if (ev.place) eventNode["@_Place"] = ev.place;
        node.Events.Event.push(eventNode);
      }
    }
    root.FamilyTree.Individuals.Individual.push(node);
  }

  for (const f of families) {
    const node: any = { "@_ID": f.id };
    if (f.husb) node["@_Husband"] = f.husb;
    if (f.wife) node["@_Wife"] = f.wife;
    if (f.chil?.length) {
      node.Children = { Child: f.chil.map((id) => ({ "@_ID": id })) };
    }
    root.FamilyTree.Families.Family.push(node);
  }

  for (const place of places) {
    const node: any = { "@_ID": place.id, "@_Name": place.name };
    if (place.lat) node["@_Latitude"] = place.lat;
    if (place.long) node["@_Longitude"] = place.long;
    root.FamilyTree.Places.Place.push(node);
  }

  for (const source of sources) {
    const node: any = { "@_ID": source.id };
    if (source.title) node["@_Title"] = source.title;
    if (source.author) node["@_Author"] = source.author;
    if (source.publication) node["@_Publisher"] = source.publication;
    root.FamilyTree.Sources.Source.push(node);
  }

  return root;
}

function buildMyHeritageXml(
  persons: Person[],
  families: Family[],
  places: Place[],
  sources: Source[]
): any {
  const root: any = {
    "?xml": {
      "@_version": "1.0",
      "@_encoding": "UTF-8",
    },
    MyHeritage: {
      "@_xmlns": "http://www.myheritage.com/",
      "@_version": "1.0",
      People: { Person: [] as any[] },
      Families: { Family: [] as any[] },
      Places: { Location: [] as any[] },
      Sources: { Source: [] as any[] },
    },
  };

  for (const p of persons) {
    const node: any = { "@_id": p.id };
    if (p.name) {
      const parts = p.name.split(" ");
      node.FirstName = parts[0] || "";
      node.LastName = parts.slice(1).join(" ") || "";
    }
    if (p.sex && p.sex !== "U")
      node.Gender =
        p.sex === "M" ? "Male" : p.sex === "F" ? "Female" : "Unknown";
    if (p.events?.length) {
      node.Events = { Event: [] };
      for (const ev of p.events) {
        const eventNode: any = { type: ev.type };
        if (ev.date) eventNode.date = ev.date;
        if (ev.place) eventNode.location = ev.place;
        node.Events.Event.push(eventNode);
      }
    }
    root.MyHeritage.People.Person.push(node);
  }

  for (const f of families) {
    const node: any = { "@_id": f.id };
    if (f.husb) node.husband = { "@_ref": f.husb };
    if (f.wife) node.wife = { "@_ref": f.wife };
    if (f.chil?.length) {
      node.children = { child: f.chil.map((id) => ({ "@_ref": id })) };
    }
    root.MyHeritage.Families.Family.push(node);
  }

  for (const place of places) {
    const node: any = { "@_id": place.id, name: place.name };
    if (place.lat) node.latitude = place.lat;
    if (place.long) node.longitude = place.long;
    root.MyHeritage.Places.Location.push(node);
  }

  for (const source of sources) {
    const node: any = { "@_id": source.id };
    if (source.title) node.title = source.title;
    if (source.author) node.author = source.author;
    if (source.publication) node.publication = source.publication;
    root.MyHeritage.Sources.Source.push(node);
  }

  return root;
}

// Simple, consistent GNO XML (supports multiple formats)
export function modelToGnoXml(
  persons: Person[],
  families: Family[],
  places: Place[] = [],
  sources: Source[] = [],
  format: GnoFormat = "genopro"
): string {
  let root: any;

  switch (format) {
    case "gramps":
      root = buildGrampsXml(persons, families, places, sources);
      break;
    case "legacy":
      root = buildLegacyFamilyTreeXml(persons, families, places, sources);
      break;
    case "myheritage":
      root = buildMyHeritageXml(persons, families, places, sources);
      break;
    case "genopro":
    case "generic":
    default:
      root = buildGenoProXml(persons, families, places, sources);
      break;
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
  });

  const xmlContent = builder.build(root);

  // XML declaration is now included in the GenoPro structure
  // For Gramps, we still need to add it separately
  if (format === "gramps") {
    const header = '<?xml version="1.0" encoding="UTF-8"?>\n';
    return header + xmlContent;
  }

  return xmlContent;
}
