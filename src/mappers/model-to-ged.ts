import type { Family, Person, Place, Source } from "../model";

/**
 * Converts the internal model to GEDCOM 5.5.1 text.
 * Supports: INDI, FAM, NAME, SEX, BIRT/DEAT (+ DATE, PLAC), FAMC, FAMS, PLAC records, SOUR records.
 *
 * @param persons - Array of Person objects
 * @param families - Array of Family objects
 * @param places - Array of Place objects
 * @param sources - Array of Source objects
 * @param treeName - Optional tree name for the GEDCOM file
 */
export function modelToGed(
	persons: Person[],
	families: Family[],
	places: Place[] = [],
	sources: Source[] = [],
	treeName?: string
): string {
	const lines: string[] = [];
	lines.push("0 HEAD");
	lines.push("1 SOUR GNO2GED");

	// Add tree name with RIN (similar to Ancestry/FamilySearch format)
	if (treeName) {
		lines.push(`1 _TREE ${treeName}`);
		// Generate a random RIN (Record Identification Number)
		const randomRIN = Math.floor(Math.random() * 100000000);
		lines.push(`2 RIN ${randomRIN}`);
	}

	lines.push("1 GEDC");
	lines.push("2 VERS 5.5.1");
	lines.push("2 FORM LINEAGE-LINKED");
	lines.push("1 CHAR UTF-8");

	// Add FILE tag with tree name for getUniversalTreeName() to find
	if (treeName) {
		lines.push(`1 FILE ${treeName}.gno`);
	}

	// Build a map of place IDs to Place objects for quick lookup
	const placeMap = new Map(places.map((p) => [p.id, p]));

	for (const p of persons) {
		lines.push(`0 @${p.id}@ INDI`);
		if (p.name) {
			// Parse name into given and surname parts
			const nameParts = p.name.split(" ");
			const givenName = nameParts[0] || "";
			const surname = nameParts.slice(1).join(" ") || "";

			// Write NAME with GEDCOM format (given /surname/)
			if (surname) {
				lines.push(`1 NAME ${givenName} /${surname}/`);
			} else {
				lines.push(`1 NAME ${givenName}`);
			}

			// Write GIVN and SURN sub-tags
			if (givenName) lines.push(`2 GIVN ${givenName}`);
			if (surname) lines.push(`2 SURN ${surname}`);
		}
		if (p.sex && p.sex !== "U") lines.push(`1 SEX ${p.sex}`);
		for (const ev of p.events ?? []) {
			lines.push(`1 ${ev.type}`);
			if (ev.date) lines.push(`2 DATE ${ev.date}`);
			// If there's a placeId, resolve it to the actual place with coordinates
			if (ev.placeId && placeMap.has(ev.placeId)) {
				const place = placeMap.get(ev.placeId)!;
				lines.push(`2 PLAC ${place.name}`);
				// Add coordinates if available using MAP structure
				if (place.lat || place.long) {
					lines.push(`3 MAP`);
					if (place.lat) lines.push(`4 LATI ${place.lat}`);
					if (place.long) lines.push(`4 LONG ${place.long}`);
				}
			} else if (ev.place) {
				lines.push(`2 PLAC ${ev.place}`);
			}
		}
		for (const famc of p.famc ?? []) lines.push(`1 FAMC @${famc}@`);
		for (const fams of p.fams ?? []) lines.push(`1 FAMS @${fams}@`);
	}

	for (const f of families) {
		lines.push(`0 @${f.id}@ FAM`);
		if (f.husb) lines.push(`1 HUSB @${f.husb}@`);
		if (f.wife) lines.push(`1 WIFE @${f.wife}@`);
		for (const c of f.chil ?? []) lines.push(`1 CHIL @${c}@`);
	}

	// Output source records
	for (const source of sources) {
		lines.push(`0 @${source.id}@ SOUR`);
		if (source.title) lines.push(`1 TITL ${source.title}`);
		if (source.author) lines.push(`1 AUTH ${source.author}`);
		if (source.publication) lines.push(`1 PUBL ${source.publication}`);
	}

	lines.push("0 TRLR");
	return lines.join("\n") + "\n";
}
