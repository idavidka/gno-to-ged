import type { Family, Person } from "../model.js";

/**
 * Converts the internal model to GEDCOM 5.5.1 text.
 * Supports: INDI, FAM, NAME, SEX, BIRT/DEAT (+ DATE, PLAC), FAMC, FAMS.
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
    if (p.name) lines.push(`1 NAME ${p.name}`);
    if (p.sex && p.sex !== "U") lines.push(`1 SEX ${p.sex}`);
    for (const ev of p.events ?? []) {
      lines.push(`1 ${ev.type}`);
      if (ev.date) lines.push(`2 DATE ${ev.date}`);
      if (ev.place) lines.push(`2 PLAC ${ev.place}`);
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