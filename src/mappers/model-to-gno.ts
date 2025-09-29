import { XMLBuilder } from "fast-xml-parser";
import type { Family, Person } from "../model.js";

function eventToNode(ev: { type: string; date?: string; place?: string }) {
  const tag = ev.type === "BIRT" ? "Birth" : ev.type === "DEAT" ? "Death" : ev.type;
  const attrs: any = {};
  if (ev.date) attrs["@_Date"] = ev.date;
  if (ev.place) attrs["@_Place"] = ev.place;
  return { [tag]: attrs };
}

// Egy egyszerű, konzisztens GNO XML (nem garantált 1:1 GenoPro séma, de jól mappolható)
export function modelToGnoXml(persons: Person[], families: Family[]): string {
  const root: any = { Genealogy: { Individuals: { Individual: [] as any[] }, Families: { Family: [] as any[] } } };

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

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    suppressEmptyNode: true
  });
  return builder.build(root);
}