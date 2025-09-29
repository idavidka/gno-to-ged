import type { Family, Person } from "../model.js";

// Nagyon egyszerű GEDCOM parser; alap tag-ekre fókuszál.
export function gedToModel(ged: string): { persons: Person[]; families: Family[] } {
  const lines = ged.replace(/\r\n/g, "\n").split("\n");
  const persons: Person[] = [];
  const families: Family[] = [];

  let current: { type?: "INDI" | "FAM"; id?: string } = {};
  let currPerson: Person | undefined;
  let currFamily: Family | undefined;
  let currEventTag: string | undefined;

  function flush() {
    if (current.type === "INDI" && currPerson) persons.push(currPerson);
    if (current.type === "FAM" && currFamily) families.push(currFamily);
    current = {};
    currPerson = undefined;
    currFamily = undefined;
    currEventTag = undefined;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const levelMatch = /^(\d+)\s+(.*)$/.exec(line);
    if (!levelMatch) continue;
    const level = Number(levelMatch[1]);
    const rest = levelMatch[2];

    // Új rekord
    if (level === 0) {
      if (current.type) flush();
      const m = /^@([^@]+)@\s+(INDI|FAM)/.exec(rest);
      if (m) {
        current.type = m[2] as "INDI" | "FAM";
        current.id = m[1];
        if (current.type === "INDI") {
          currPerson = { id: current.id, events: [] };
        } else {
          currFamily = { id: current.id, chil: [] };
        }
      } else {
        current = {};
      }
      currEventTag = undefined;
      continue;
    }

    if (current.type === "INDI" && currPerson) {
      if (level === 1) {
        const mName = /^NAME\s+(.+)$/.exec(rest);
        if (mName) { currPerson.name = mName[1]; continue; }

        const mSex = /^SEX\s+([MFU])$/.exec(rest);
        if (mSex) { currPerson.sex = mSex[1] as any; continue; }

        const mFamc = /^FAMC\s+@([^@]+)@$/.exec(rest);
        if (mFamc) { currPerson.famc = [...(currPerson.famc ?? []), mFamc[1]]; continue; }

        const mFams = /^FAMS\s+@([^@]+)@$/.exec(rest);
        if (mFams) { currPerson.fams = [...(currPerson.fams ?? []), mFams[1]]; continue; }

        const mEvent = /^(BIRT|DEAT|EVEN|CHR|BAPM|BURI|MARR|DIV)$/.exec(rest);
        if (mEvent) {
          currEventTag = mEvent[1];
          currPerson.events!.push({ type: currEventTag });
          continue;
        }
        currEventTag = undefined;
      } else if (level === 2 && currEventTag) {
        const lastEv = currPerson.events![currPerson.events!.length - 1];
        const mDate = /^DATE\s+(.+)$/.exec(rest);
        if (mDate && lastEv) { lastEv.date = mDate[1]; continue; }
        const mPlac = /^PLAC\s+(.+)$/.exec(rest);
        if (mPlac && lastEv) { lastEv.place = mPlac[1]; continue; }
      }
    }

    if (current.type === "FAM" && currFamily) {
      if (level === 1) {
        const mH = /^HUSB\s+@([^@]+)@$/.exec(rest);
        if (mH) { currFamily.husb = mH[1]; continue; }
        const mW = /^WIFE\s+@([^@]+)@$/.exec(rest);
        if (mW) { currFamily.wife = mW[1]; continue; }
        const mC = /^CHIL\s+@([^@]+)@$/.exec(rest);
        if (mC) { currFamily.chil!.push(mC[1]); continue; }
      }
    }
  }
  if (current.type) flush();

  return { persons, families };
}