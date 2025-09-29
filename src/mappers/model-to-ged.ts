import type { Family, Person } from "../model.js";

/**
 * Converts the internal model to GEDCOM 5.5.1 text.
 * Supports: INDI, FAM, NAME (structured + fallback), SEX, BIRT/DEAT (+ DATE, PLAC, _PLAC_REF), FAMC, FAMS.
 */
export function modelToGed(persons: Person[], families: Family[]): string {
  const lines: string[] = [];
  lines.push("0 HEAD");
  lines.push("1 SOUR GNO2GED");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");

  for (const p of persons) {
    lines.push(`0 @${p.id}@ INDI`);
    
    // Handle structured names
    if (p.nameParts && (p.nameParts.given || p.nameParts.surname)) {
      // Emit structured NAME line
      const given = p.nameParts.given || "";
      const surname = p.nameParts.surname || "";
      lines.push(`1 NAME ${given} /${surname}/`.replace(/\s+/g, ' ').trim());
      
      // Emit subordinate GIVN and SURN lines
      if (p.nameParts.given) {
        lines.push(`2 GIVN ${p.nameParts.given}`);
      }
      if (p.nameParts.surname) {
        lines.push(`2 SURN ${p.nameParts.surname}`);
      }
    } else if (p.name) {
      // Fallback: try to infer surname as last token if no "/" present
      if (p.name.includes("/")) {
        lines.push(`1 NAME ${p.name}`);
      } else {
        const tokens = p.name.trim().split(/\s+/);
        if (tokens.length > 1) {
          const given = tokens.slice(0, -1).join(" ");
          const surname = tokens[tokens.length - 1];
          lines.push(`1 NAME ${given} /${surname}/`);
          lines.push(`2 GIVN ${given}`);
          lines.push(`2 SURN ${surname}`);
        } else {
          lines.push(`1 NAME ${p.name}`);
        }
      }
    }
    
    if (p.sex && p.sex !== "U") lines.push(`1 SEX ${p.sex}`);
    
    for (const ev of p.events ?? []) {
      lines.push(`1 ${ev.type}`);
      if (ev.date) lines.push(`2 DATE ${ev.date}`);
      
      // Handle place and place reference
      if (ev.place) {
        lines.push(`2 PLAC ${ev.place}`);
      } else if (ev.placeRef) {
        // Only ID available, no resolved place
        lines.push(`2 PLAC ${ev.placeRef}`);
      }
      
      // Always emit _PLAC_REF if we have a reference
      if (ev.placeRef) {
        lines.push(`2 _PLAC_REF @${ev.placeRef}@`);
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

  lines.push("0 TRLR");
  return lines.join("\n") + "\n";
}