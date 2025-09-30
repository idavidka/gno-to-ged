import { XMLBuilder } from "fast-xml-parser";
import type { Family, Person, Place, Source } from "../model.js";

export type GnoFormat = "genopro" | "gramps" | "generic";

function eventToNode(ev: { type: string; date?: string; place?: string; placeId?: string }, format: GnoFormat) {
  if (format === "gramps") {
    // Gramps uses different tag names
    const tag = ev.type === "BIRT" ? "birth" : ev.type === "DEAT" ? "death" : ev.type.toLowerCase();
    const node: any = {};
    if (ev.date) node.dateval = { "@_val": ev.date };
    if (ev.placeId || ev.place) {
      node.place = { "@_hlink": ev.placeId || ev.place };
    }
    return { [tag]: node };
  } else {
    // GenoPro and generic format
    const tag = ev.type === "BIRT" ? "Birth" : ev.type === "DEAT" ? "Death" : ev.type;
    const attrs: any = {};
    if (ev.date) attrs["@_Date"] = ev.date;
    // Prefer placeId reference over plain text place
    if (ev.placeId) attrs["@_Place"] = ev.placeId;
    else if (ev.place) attrs["@_Place"] = ev.place;
    return { [tag]: attrs };
  }
}

function buildGenoProXml(persons: Person[], families: Family[], places: Place[], sources: Source[]): any {
  const root: any = { 
    Genealogy: { 
      Individuals: { Individual: [] as any[] }, 
      Families: { Family: [] as any[] },
      Places: { Place: [] as any[] },
      Sources: { Source: [] as any[] }
    } 
  };

  for (const p of persons) {
    const node: any = { "@_ID": p.id };
    if (p.name) node["@_Name"] = p.name;
    if (p.sex && p.sex !== "U") node["@_Sex"] = p.sex;
    if (p.events?.length) {
      for (const ev of p.events) {
        Object.assign(node, eventToNode(ev, "genopro"));
      }
    }
    root.Genealogy.Individuals.Individual.push(node);
  }

  for (const f of families) {
    const node: any = { "@_ID": f.id };
    if (f.husb) node["@_Husband"] = f.husb;
    if (f.wife) node["@_Wife"] = f.wife;
    if (f.chil?.length) {
      node.Children = { Child: f.chil.map(id => ({ "@_Ref": id })) };
    }
    root.Genealogy.Families.Family.push(node);
  }

  for (const place of places) {
    const node: any = { "@_ID": place.id, "@_Name": place.name };
    if (place.lat) node["@_Lat"] = place.lat;
    if (place.long) node["@_Long"] = place.long;
    root.Genealogy.Places.Place.push(node);
  }

  for (const source of sources) {
    const node: any = { "@_ID": source.id };
    if (source.title) node["@_Title"] = source.title;
    if (source.author) node["@_Author"] = source.author;
    if (source.publication) node["@_Publication"] = source.publication;
    root.Genealogy.Sources.Source.push(node);
  }

  return root;
}

function buildGrampsXml(persons: Person[], families: Family[], places: Place[], sources: Source[]): any {
  const root: any = {
    database: {
      "@_xmlns": "http://gramps-project.org/xml/1.7.1/",
      people: { person: [] as any[] },
      families: { family: [] as any[] },
      places: { placeobj: [] as any[] },
      sources: { source: [] as any[] }
    }
  };

  for (const p of persons) {
    const node: any = { 
      "@_id": p.id,
      "@_handle": p.id
    };
    if (p.name) {
      node.name = { 
        "@_type": "Birth Name",
        first: p.name.split(" ")[0] || "",
        surname: { "#text": p.name.split(" ").slice(1).join(" ") || "" }
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
      node.childof = p.famc.map(fid => ({ "@_hlink": fid }));
    }
    if (p.fams?.length) {
      node.parentin = p.fams.map(fid => ({ "@_hlink": fid }));
    }
    
    root.database.people.person.push(node);
  }

  for (const f of families) {
    const node: any = { 
      "@_id": f.id,
      "@_handle": f.id
    };
    if (f.husb) node.father = { "@_hlink": f.husb };
    if (f.wife) node.mother = { "@_hlink": f.wife };
    if (f.chil?.length) {
      node.childref = f.chil.map(id => ({ "@_hlink": id }));
    }
    root.database.families.family.push(node);
  }

  for (const place of places) {
    const node: any = { 
      "@_id": place.id,
      "@_handle": place.id,
      "@_type": "Unknown",
      pname: { "@_value": place.name }
    };
    if (place.lat || place.long) {
      node.coord = {
        "@_lat": place.lat || "0",
        "@_long": place.long || "0"
      };
    }
    root.database.places.placeobj.push(node);
  }

  for (const source of sources) {
    const node: any = { 
      "@_id": source.id,
      "@_handle": source.id
    };
    if (source.title) node.stitle = source.title;
    if (source.author) node.sauthor = source.author;
    if (source.publication) node.spubinfo = source.publication;
    root.database.sources.source.push(node);
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
    suppressEmptyNode: true
  });
  
  const xmlContent = builder.build(root);
  
  // Add XML declaration based on format
  let header = '<?xml version="1.0" encoding="UTF-8"?>\n';
  
  if (format === "gramps") {
    // Gramps format already includes xmlns in the database element
    return header + xmlContent;
  } else {
    // GenoPro and generic formats
    return header + xmlContent;
  }
}