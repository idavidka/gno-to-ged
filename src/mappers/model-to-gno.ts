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

const eventElement = (ev: { type: string; typeName?: string; date?: string; place?: string; note?: string }) => {
  const node: any = {};
  if (ev.typeName && ev.type === "EVEN") node["@_Type"] = ev.typeName;
  else if (ev.typeName && ev.type !== "OCCU") node["@_Type"] = ev.typeName;
  if (ev.date) node.Date = ev.date;
  if (ev.place) node.Place = ev.place;
  if (ev.note) node.Comment = ev.note;
  if (ev.type === "OCCU" && ev.typeName) node.Description = ev.typeName;
  return node;
};

const layoutPositions = (persons: Person[], families: Family[]) => {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const generation = new Map<string, number>();
  const rank = (id: string, seen: Set<string>): number => {
    const known = generation.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const person = byId.get(id);
    const parentFamilies = (person?.famc ?? [])
      .map((familyId) => families.find((family) => family.id === familyId))
      .filter((family): family is Family => !!family);
    const parentIds = parentFamilies.flatMap((family) => [family.husb, family.wife].filter((item): item is string => !!item));
    const value = parentIds.length
      ? Math.max(...parentIds.map((parentId) => rank(parentId, seen))) + 1
      : 0;
    generation.set(id, value);
    return value;
  };
  persons.forEach((person) => rank(person.id, new Set()));
  const columns = new Map<number, number>();
  const positions = new Map<string, string>();
  persons.forEach((person) => {
    const row = generation.get(person.id) ?? 0;
    const column = columns.get(row) ?? 0;
    columns.set(row, column + 1);
    positions.set(person.id, `${column * 220},${row * 160}`);
  });
  return positions;
};

function buildGenoProXml(
  persons: Person[],
  families: Family[],
  places: Place[],
  sources: Source[]
): any {
  const positions = layoutPositions(persons, families);
  const marriages = families.map((family) => ({
    id: `marriage-${family.id}`,
    family,
    marriage: family.events?.find((event) => event.type === "MARR"),
    divorce: family.events?.find((event) => event.type === "DIV"),
  }));
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
    if (person.given) node.FirstName = person.given;
    if (person.surname) node.LastName = person.surname;
    if (person.name) node.Name = person.name;
    if (person.note) node.Comment = person.note;

    const extra: any[] = [];
    person.events?.forEach((event) => {
      const body = eventElement(event);
      if (event.type === "BIRT" && !node.Birth) node.Birth = body;
      else if (event.type === "DEAT" && !node.Death) node.Death = body;
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
          if (picture.file) item["@_File"] = picture.file;
          if (picture.title) item.Title = picture.title;
          return item;
        }),
      };
    }
    return node;
  });

  return {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    GenoPro: {
      "@_Version": "2020.0.0.1",
      GenoMap: {
        "@_ID": "genomap1",
        "@_Name": "Family",
        Individuals: { Individual: individuals },
        Families: {
          Family: families.map((family, index) => ({
            "@_ID": family.id,
            ...(family.husb ? { "@_Husband": family.husb } : {}),
            ...(family.wife ? { "@_Wife": family.wife } : {}),
            Position: `${index * 220},80`,
            Unions: `marriage-${family.id}`,
            Children: { Child: (family.chil ?? []).map((id) => ({ "@_Ref": id })) },
            ...(family.note ? { Comment: family.note } : {}),
          })),
        },
        Marriages: {
          Marriage: marriages.map((item) => ({
            "@_ID": item.id,
            ...eventElement(item.marriage ?? { type: "MARR" }),
            ...(item.divorce?.date ? { Divorce: { Date: item.divorce.date } } : {}),
          })),
        },
        PedigreeLinks: { PedigreeLink: pedigree },
        Places: {
          Place: places.map((place) => ({
            "@_ID": place.id,
            "@_Name": place.name,
            ...(place.lat ? { "@_Lat": place.lat } : {}),
            ...(place.long ? { "@_Long": place.long } : {}),
          })),
        },
        Sources: {
          Source: sources.map((source) => ({
            "@_ID": source.id,
            ...(source.title ? { "@_Title": source.title } : {}),
            ...(source.author ? { "@_Author": source.author } : {}),
            ...(source.publication ? { "@_Publication": source.publication } : {}),
          })),
        },
      },
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
