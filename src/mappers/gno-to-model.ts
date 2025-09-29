import { XMLParser } from "fast-xml-parser";
import type { Family, Person, NameParts } from "../model.js";

/**
 * Recursively extracts text content from an object or array, also detecting references.
 * Returns both the text content and any reference/ID found.
 */
function extractTextAndRef(obj: any): { text: string; ref?: string } {
  if (obj === null || obj === undefined) {
    return { text: "" };
  }
  
  if (typeof obj === "string" || typeof obj === "number") {
    const text = obj.toString();
    // Check if the text looks like an ID (e.g., "place00161", "unknown_place_id", "location123")
    const isIdLike = /^[a-zA-Z_]+\d+$|^[a-zA-Z_]+_[a-zA-Z_]+_[a-zA-Z_]+$/.test(text);
    return { text, ref: isIdLike ? text : undefined };
  }
  
  if (typeof obj === "object") {
    // Check for reference attributes first
    const ref = obj["@_Ref"] ?? obj["@_ID"] ?? obj["@_Id"] ?? obj.Ref ?? obj.ID ?? obj.id;
    
    // Extract text content recursively
    const textParts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith("@_")) continue; // Skip attributes
      const { text } = extractTextAndRef(value);
      if (text.trim()) textParts.push(text.trim());
    }
    
    const text = textParts.join(" ");
    return { text, ref: ref || (text && /^[a-zA-Z_]+\d+$|^[a-zA-Z_]+_[a-zA-Z_]+_[a-zA-Z_]+$/.test(text) ? text : undefined) };
  }
  
  if (Array.isArray(obj)) {
    const results = obj.map(item => extractTextAndRef(item));
    const text = results.map(r => r.text).filter(Boolean).join(" ");
    const ref = results.find(r => r.ref)?.ref;
    return { text, ref };
  }
  
  return { text: obj.toString() };
}

/**
 * Builds a places dictionary from Places/Place or Locations/Location containers.
 */
function buildPlacesDictionary(rootObj: any): Map<string, string> {
  const placesMap = new Map<string, string>();
  
  // Try different container names
  const placesContainer = rootObj.Places ?? rootObj.Locations ?? rootObj.places ?? rootObj.locations;
  if (!placesContainer) return placesMap;
  
  // Normalize places to an array
  const placesArray: any[] = 
    (Array.isArray(placesContainer.Place) ? placesContainer.Place :
    placesContainer.Place ? [placesContainer.Place] :
    Array.isArray(placesContainer.Location) ? placesContainer.Location :
    placesContainer.Location ? [placesContainer.Location] : []) as any[];
  
  for (const place of placesArray) {
    const id = place?.["@_ID"] ?? place?.["@_Id"] ?? place?.["@_id"] ?? place?.ID ?? place?.id;
    if (id) {
      const { text } = extractTextAndRef(place);
      if (text.trim()) {
        placesMap.set(id, text.trim());
      }
    }
  }
  
  return placesMap;
}

/**
 * Extracts structured name parts from a name object.
 */
function extractNameParts(nameObj: any): { nameParts?: NameParts; combinedName?: string } {
  if (!nameObj) return {};
  
  if (typeof nameObj === "string") {
    return { combinedName: nameObj };
  }
  
  const given = nameObj.Given ?? nameObj.First ?? nameObj.given ?? nameObj.first;
  const surname = nameObj.Surname ?? nameObj.Last ?? nameObj.surname ?? nameObj.last;
  const display = nameObj.Display ?? nameObj.DisplayName ?? nameObj.display ?? nameObj.displayName;
  
  const nameParts: NameParts = {};
  if (given) nameParts.given = given.toString();
  if (surname) nameParts.surname = surname.toString();
  if (display) nameParts.display = display.toString();
  
  // Create combined name for backward compatibility
  let combinedName = "";
  if (nameParts.display) {
    combinedName = nameParts.display;
  } else if (nameParts.given || nameParts.surname) {
    combinedName = [nameParts.given, nameParts.surname].filter(Boolean).join(" ");
  }
  
  const hasStructuredParts = nameParts.given || nameParts.surname || nameParts.display;
  return { 
    nameParts: hasStructuredParts ? nameParts : undefined, 
    combinedName: combinedName || undefined 
  };
}

/**
 * Heuristic GNO XML → internal model mapper.
 *
 * Tries common containers:
 * - Root: GenoPro | Genealogy | genealogy | (fallback: parsed root)
 * - Individuals container: Individuals | Persons | individuals | persons
 * - Families container: Families | Unions | families | unions
 * - Places container: Places | Locations | places | locations
 *
 * Tries common element/attribute names:
 * - Individual/Person nodes with @ID/Id/id, @Name/Name/DisplayName/FullName, @Sex/Sex
 * - Family/Union nodes with @ID and @Husband/@Wife; children under Children/Child[@Ref]
 * - Birth/Death sub-nodes with @Date/@Place
 * - Name sub-objects with Given/First, Surname/Last, Display/DisplayName
 * - Place references via @_Ref, @_ID, or ID-like tokens
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

  // Build places dictionary for resolving place references
  const placesDict = buildPlacesDictionary(rootObj);

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
    
    // Handle both simple name strings and structured name objects
    const nameValue = node?.["@_Name"] ?? node?.Name ?? node?.DisplayName ?? node?.FullName;
    const { nameParts, combinedName } = extractNameParts(nameValue);
    const name = combinedName || (typeof nameValue === "string" ? nameValue : undefined);
    
    const sexRaw = (node?.["@_Sex"] ?? node?.Sex ?? "").toString().toUpperCase();
    const sex = sexRaw === "M" || sexRaw === "F" ? sexRaw : "U";

    // Birth/Death extraction (heuristic) with recursive text and reference extraction
    const birthNode = node?.Birth ?? node?.BIRT ?? node?.birth;
    const deathNode = node?.Death ?? node?.DEAT ?? node?.death;

    const events = [];
    if (birthNode) {
      const dateValue = birthNode?.["@_Date"] ?? birthNode?.Date ?? birthNode?.date;
      const placeValue = birthNode?.["@_Place"] ?? birthNode?.Place ?? birthNode?.place;
      
      const { text: placeText, ref: placeRef } = extractTextAndRef(placeValue);
      const resolvedPlace = placeRef && placesDict.has(placeRef) ? placesDict.get(placeRef) : placeText;
      
      events.push({
        type: "BIRT",
        date: typeof dateValue === "string" ? dateValue : extractTextAndRef(dateValue).text || undefined,
        place: resolvedPlace || undefined,
        placeRef: placeRef || undefined
      });
    }
    if (deathNode) {
      const dateValue = deathNode?.["@_Date"] ?? deathNode?.Date ?? deathNode?.date;
      const placeValue = deathNode?.["@_Place"] ?? deathNode?.Place ?? deathNode?.place;
      
      const { text: placeText, ref: placeRef } = extractTextAndRef(placeValue);
      const resolvedPlace = placeRef && placesDict.has(placeRef) ? placesDict.get(placeRef) : placeText;
      
      events.push({
        type: "DEAT",
        date: typeof dateValue === "string" ? dateValue : extractTextAndRef(dateValue).text || undefined,
        place: resolvedPlace || undefined,
        placeRef: placeRef || undefined
      });
    }

    return {
      id,
      name,
      nameParts,
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