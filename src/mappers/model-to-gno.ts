import { XMLBuilder } from "fast-xml-parser";
import type { Family, Person, Place, Source } from "../model.js";

function eventToNode(ev: { type: string; date?: string; place?: string; placeId?: string }) {
  const tag = ev.type === "BIRT" ? "Birth" : ev.type === "DEAT" ? "Death" : ev.type;
  const attrs: any = {};
  if (ev.date) attrs["@_Date"] = ev.date;
  // Prefer placeId reference over plain text place
  if (ev.placeId) attrs["@_Place"] = ev.placeId;
  else if (ev.place) attrs["@_Place"] = ev.place;
  return { [tag]: attrs };
}

// Simple, consistent GNO XML (not guaranteed 1:1 GenoPro schema, but well-mappable)
export function modelToGnoXml(persons: Person[], families: Family[], places: Place[] = [], sources: Source[] = []): string {
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
        Object.assign(node, eventToNode(ev));
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

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    suppressEmptyNode: true
  });
  return builder.build(root);
}