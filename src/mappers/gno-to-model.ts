import { XMLParser } from "fast-xml-parser";
import type { Family, Person, Place, Source } from "../model";

/**
 * Heuristic GNO XML → internal model mapper.
 *
 * Tries common containers:
 * - Root: GenoPro | Genealogy | genealogy | (fallback: parsed root)
 * - Individuals container: Individuals | Persons | individuals | persons
 * - Families container: Families | Unions | families | unions
 * - Places container: Places | places
 * - Sources container: Sources | sources
 *
 * Tries common element/attribute names:
 * - Individual/Person nodes with @ID/Id/id, @Name/Name/DisplayName/FullName, @Sex/Sex
 * - Family/Union nodes with @ID and @Husband/@Wife; children under Children/Child[@Ref]
 * - Birth/Death sub-nodes with @Date/@Place
 * - Place nodes with @ID and @Name/@Title
 * - Source nodes with @ID and @Title/@Author/@Publication
 *
 * This is a starting point; adjust the mappings for your exact .gno schema.
 */
export function gnoToModel(xmlText: string): { persons: Person[]; families: Family[]; places: Place[]; sources: Source[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true
  });
  const root = parser.parse(xmlText);

  // Resolve the likely root object
  const rootObj =
    root.GenoPro?.Genealogy ??
    root.GenoPro ??
    root.Genealogy ??
    root.genealogy ??
    root;

  // Resolve individuals container
  const individualsContainer =
    rootObj.Individuals ?? rootObj.Persons ?? rootObj.individuals ?? rootObj.persons;

  // Normalize individuals to an array
  const individuals1 = Array.isArray(individualsContainer?.Individual) 
    ? individualsContainer.Individual 
    : individualsContainer?.Individual ? [individualsContainer.Individual] : [];
  const individuals2 = Array.isArray(individualsContainer?.Person) 
    ? individualsContainer.Person 
    : individualsContainer?.Person ? [individualsContainer.Person] : [];
  const rawIndividuals: any[] = [...individuals1, ...individuals2];

  // Resolve families container
  const familiesContainer =
    rootObj.Families ?? rootObj.Unions ?? rootObj.families ?? rootObj.unions;

  // Normalize families to an array
  const families1 = Array.isArray(familiesContainer?.Family) 
    ? familiesContainer.Family 
    : familiesContainer?.Family ? [familiesContainer.Family] : [];
  const families2 = Array.isArray(familiesContainer?.Union) 
    ? familiesContainer.Union 
    : familiesContainer?.Union ? [familiesContainer.Union] : [];
  const rawFamilies: any[] = [...families1, ...families2];

  // Resolve places container
  const placesContainer =
    rootObj.Places ?? rootObj.places;

  // Normalize places to an array
  const rawPlaces: any[] =
    (Array.isArray(placesContainer?.Place) ? placesContainer.Place :
    placesContainer?.Place ? [placesContainer.Place] : []) as any[];

  // Resolve sources container
  const sourcesContainer =
    rootObj.Sources ?? rootObj.sources;

  // Normalize sources to an array
  const rawSources: any[] =
    (Array.isArray(sourcesContainer?.Source) ? sourcesContainer.Source :
    sourcesContainer?.Source ? [sourcesContainer.Source] : []) as any[];

  // Parse places
  const places: Place[] = rawPlaces.map((node, idx) => {
    const id = node?.["@_ID"] ?? node?.["@_Id"] ?? node?.["@_id"] ?? `P${idx + 1}`;
    const name = node?.["@_Name"] ?? node?.Name ?? node?.["@_Title"] ?? node?.Title ?? "";
    const lat = node?.["@_Lat"] ?? node?.Lat ?? node?.["@_Latitude"] ?? node?.Latitude;
    const long = node?.["@_Long"] ?? node?.Long ?? node?.["@_Longitude"] ?? node?.Longitude;
    return { id, name, lat, long };
  });

  // Parse sources
  const sources: Source[] = rawSources.map((node, idx) => {
    const id = node?.["@_ID"] ?? node?.["@_Id"] ?? node?.["@_id"] ?? `S${idx + 1}`;
    const title = node?.["@_Title"] ?? node?.Title;
    const author = node?.["@_Author"] ?? node?.Author;
    const publication = node?.["@_Publication"] ?? node?.Publication ?? node?.["@_Publ"] ?? node?.Publ;
    return { id, title, author, publication };
  });

  const persons: Person[] = rawIndividuals.map((node, idx) => {
    const id = node?.["@_ID"] ?? node?.["@_Id"] ?? node?.["@_id"] ?? `I${idx + 1}`;
    
    // Extract name - handle complex Name object structure
    let name: string | undefined;
    
    // Check for FirstName/LastName at node level first
    if (node?.FirstName || node?.LastName) {
      const parts = [];
      if (node.FirstName) parts.push(node.FirstName);
      if (node.LastName) parts.push(node.LastName);
      name = parts.join(" ");
    }
    
    // If not found, check Name object structure
    if (!name) {
      const nameObj = node?.Name;
      if (nameObj) {
        if (typeof nameObj === "string") {
          name = nameObj;
        } else if (nameObj["#text"]) {
          name = nameObj["#text"];
        } else if (nameObj.Display) {
          name = typeof nameObj.Display === "string" ? nameObj.Display : nameObj.Display["#text"];
        } else if (nameObj.First || nameObj.Last) {
          // Construct name from parts
          const parts = [];
          if (nameObj.First) parts.push(nameObj.First);
          if (nameObj.Last) parts.push(nameObj.Last);
          name = parts.join(" ");
        }
      }
    }
    
    // Fallback to other name attributes
    if (!name) {
      name = node?.["@_Name"] ?? node?.DisplayName ?? node?.FullName;
    }
    
    // Extract sex/gender
    const sexRaw = (node?.["@_Sex"] ?? node?.Sex ?? node?.Gender ?? "").toString().toUpperCase();
    const sex = sexRaw === "M" || sexRaw === "F" ? sexRaw : "U";

    // Birth/Death extraction (heuristic)
    const birthNode = node?.Birth ?? node?.BIRT ?? node?.birth;
    const deathNode = node?.Death ?? node?.DEAT ?? node?.death;

    const events = [];
    if (birthNode) {
      const placeValue = birthNode?.["@_Place"] ?? birthNode?.Place ?? birthNode?.place;
      events.push({
        type: "BIRT",
        date: birthNode?.["@_Date"] ?? birthNode?.Date ?? birthNode?.date,
        place: placeValue,
        placeId: placeValue && placeValue.startsWith("place") ? placeValue : undefined
      });
    }
    if (deathNode) {
      const placeValue = deathNode?.["@_Place"] ?? deathNode?.Place ?? deathNode?.place;
      events.push({
        type: "DEAT",
        date: deathNode?.["@_Date"] ?? deathNode?.Date ?? deathNode?.date,
        place: placeValue,
        placeId: placeValue && placeValue.startsWith("place") ? placeValue : undefined
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
      node?.Children?.Child ? [node.Children.Child] :
      []) as any[];

    const chil = childrenArray
      .map(c => c?.["@_Ref"] ?? c?.["@_ID"] ?? c?.Ref ?? c?.ID)
      .filter(Boolean);

    return { id, husb, wife, chil };
  });

  // Parse PedigreeLinks to establish family relationships
  const pedigreeLinksContainer = rootObj.PedigreeLinks ?? rootObj.pedigreeLinks;
  const rawPedigreeLinks: any[] =
    (Array.isArray(pedigreeLinksContainer?.PedigreeLink) ? pedigreeLinksContainer.PedigreeLink :
    pedigreeLinksContainer?.PedigreeLink ? [pedigreeLinksContainer.PedigreeLink] : []) as any[];

  // Build family relationships from PedigreeLinks
  const familyMap = new Map(families.map(f => [f.id, f]));
  
  rawPedigreeLinks.forEach(link => {
    const linkType = link?.["@_PedigreeLink"] ?? link?.PedigreeLink;
    const familyId = link?.["@_Family"] ?? link?.Family;
    const individualId = link?.["@_Individual"] ?? link?.Individual;
    
    if (!familyId || !individualId) return;
    
    const family = familyMap.get(familyId);
    if (!family) return;
    
    // "Parent" means spouse, "Biological" means child
    if (linkType === "Parent") {
      // Determine if husb or wife based on individual's gender
      const person = rawIndividuals.find(p => 
        (p?.["@_ID"] ?? p?.ID) === individualId
      );
      const gender = person?.Gender ?? person?.["@_Sex"] ?? person?.Sex;
      
      if (gender === "M" && !family.husb) {
        family.husb = individualId;
      } else if (gender === "F" && !family.wife) {
        family.wife = individualId;
      } else if (!family.husb) {
        family.husb = individualId;
      } else if (!family.wife) {
        family.wife = individualId;
      }
    } else if (linkType === "Biological" || linkType === "Adopted" || linkType === "Foster") {
      if (!family.chil) family.chil = [];
      if (!family.chil.includes(individualId)) {
        family.chil.push(individualId);
      }
    }
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

  return { persons, families, places, sources };
}