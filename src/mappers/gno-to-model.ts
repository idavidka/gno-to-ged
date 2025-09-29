import { XMLParser } from "fast-xml-parser";
import type { Family, Person } from "../model.js";

/**
 * Heuristic GNO XML → internal model mapper.
 *
 * Tries common containers:
 * - Root: GenoPro | Genealogy | genealogy | (fallback: parsed root)
 * - Individuals container: Individuals | Persons | individuals | persons
 * - Families container: Families | Unions | families | unions
 *
 * Tries common element/attribute names:
 * - Individual/Person nodes with @ID/Id/id, @Name/Name/DisplayName/FullName, @Sex/Sex
 * - Family/Union nodes with @ID and @Husband/@Wife; children under Children/Child[@Ref]
 * - Birth/Death sub-nodes with @Date/@Place
 *
 * This is a starting point; adjust the mappings for your exact .gno schema.
 */
export function gnoToModel(xmlText: string): { persons: Person[]; families: Family[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true
  });
  const root = parser.parse(xmlText);

  // Resolve the likely root object
  const rootObj =
    root.GenoPro ??
    root.Genealogy ??
    root.genealogy ??
    root;

  // Resolve individuals container
  const individualsContainer =
    rootObj.Individuals ?? rootObj.Persons ?? rootObj.individuals ?? rootObj.persons;

  // Normalize individuals to an array
  const rawIndividuals: any[] =
    (Array.isArray(individualsContainer?.Individual) ? individualsContainer.Individual :
    individualsContainer?.Individual ? [individualsContainer.Individual] :
    Array.isArray(individualsContainer?.Person) ? individualsContainer.Person :
    individualsContainer?.Person ? [individualsContainer.Person] : []) as any[];

  // Resolve families container
  const familiesContainer =
    rootObj.Families ?? rootObj.Unions ?? rootObj.families ?? rootObj.unions;

  // Normalize families to an array
  const rawFamilies: any[] =
    (Array.isArray(familiesContainer?.Family) ? familiesContainer.Family :
    familiesContainer?.Family ? [familiesContainer.Family] :
    Array.isArray(familiesContainer?.Union) ? familiesContainer.Union :
    familiesContainer?.Union ? [familiesContainer.Union] : []) as any[];

  const persons: Person[] = rawIndividuals.map((node, idx) => {
    const id = node?.["@_ID"] ?? node?.["@_Id"] ?? node?.["@_id"] ?? `I${idx + 1}`;
    const name = node?.["@_Name"] ?? node?.Name ?? node?.DisplayName ?? node?.FullName;
    const sexRaw = (node?.["@_Sex"] ?? node?.Sex ?? "").toString().toUpperCase();
    const sex = sexRaw === "M" || sexRaw === "F" ? sexRaw : "U";

    // Birth/Death extraction (heuristic)
    const birthNode = node?.Birth ?? node?.BIRT ?? node?.birth;
    const deathNode = node?.Death ?? node?.DEAT ?? node?.death;

    const events = [];
    if (birthNode) {
      events.push({
        type: "BIRT",
        date: birthNode?.["@_Date"] ?? birthNode?.Date ?? birthNode?.date,
        place: birthNode?.["@_Place"] ?? birthNode?.Place ?? birthNode?.place
      });
    }
    if (deathNode) {
      events.push({
        type: "DEAT",
        date: deathNode?.["@_Date"] ?? deathNode?.Date ?? deathNode?.date,
        place: deathNode?.["@_Place"] ?? deathNode?.Place ?? deathNode?.place
      });
    }

    return {
      id,
      name,
      sex,
      events
    };
  });

  const families: Family[] = rawFamilies.map((node, idx) => {
    const id = node?.["@_ID"] ?? node?.["@_Id"] ?? node?.["@_id"] ?? `F${idx + 1}`;
    const husb = node?.["@_Husband"] ?? node?.Husband ?? node?.husband ?? node?.["@_Husb"];
    const wife = node?.["@_Wife"] ?? node?.Wife ?? node?.wife;

    // Children may appear as a list: Children > Child[@Ref]
    const childrenArray: any[] =
      (Array.isArray(node?.Child) ? node.Child :
      node?.Child ? [node.Child] :
      Array.isArray(node?.Children?.Child) ? node.Children.Child :
      []) as any[];

    const chil = childrenArray
      .map(c => c?.["@_Ref"] ?? c?.["@_ID"] ?? c?.Ref ?? c?.ID)
      .filter(Boolean);

    return { id, husb, wife, chil };
  });

  // Backfill famc/fams pointers (useful for GED generation)
  const pById = new Map(persons.map(p => [p.id, p]));
  families.forEach(f => {
    if (f.husb && pById.has(f.husb)) {
      pById.get(f.husb)!.fams = [...(pById.get(f.husb)!.fams ?? []), f.id];
    }
    if (f.wife && pById.has(f.wife)) {
      pById.get(f.wife)!.fams = [...(pById.get(f.wife)!.fams ?? []), f.id];
    }
    (f.chil ?? []).forEach(cid => {
      const cp = pById.get(cid);
      if (cp) cp.famc = [...(cp.famc ?? []), f.id];
    });
  });

  return { persons, families };
}