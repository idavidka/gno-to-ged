import type { Family, Person, Place, Source } from "../model";

// Very simple GEDCOM parser; focuses on basic tags.
export function gedToModel(ged: string): { persons: Person[]; families: Family[]; places: Place[]; sources: Source[] } {
  const lines = ged.replace(/\r\n/g, "\n").split("\n");
  const persons: Person[] = [];
  const families: Family[] = [];
  const places: Place[] = [];
  const sources: Source[] = [];

  let current: { type?: "INDI" | "FAM" | "SOUR"; id?: string } = {};
  let currPerson: Person | undefined;
  let currFamily: Family | undefined;
  let currSource: Source | undefined;
  let currEventTag: string | undefined;
  let inMap = false;
  let currPlaceName: string | undefined;
  let currLat: string | undefined;
  let currLong: string | undefined;
  let inName = false;
  let currGivenName: string | undefined;
  let currSurname: string | undefined;

  function flush() {
    if (current.type === "INDI" && currPerson) persons.push(currPerson);
    if (current.type === "FAM" && currFamily) families.push(currFamily);
    if (current.type === "SOUR" && currSource) sources.push(currSource);
    current = {};
    currPerson = undefined;
    currFamily = undefined;
    currSource = undefined;
    currEventTag = undefined;
    inMap = false;
    currPlaceName = undefined;
    currLat = undefined;
    currLong = undefined;
    inName = false;
    currGivenName = undefined;
    currSurname = undefined;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const levelMatch = /^(\d+)\s+(.*)$/.exec(line);
    if (!levelMatch) continue;
    const level = Number(levelMatch[1]);
    const rest = levelMatch[2];

    // New record
    if (level === 0) {
      if (current.type) flush();
      const m = /^@([^@]+)@\s+(INDI|FAM|SOUR)/.exec(rest);
      if (m) {
        const recordType = m[2];
        current.id = m[1];
        if (recordType === "INDI") {
          current.type = "INDI";
          currPerson = { id: current.id, events: [] };
        } else if (recordType === "FAM") {
          current.type = "FAM";
          currFamily = { id: current.id, chil: [] };
        } else if (recordType === "SOUR") {
          current.type = "SOUR";
          currSource = { id: current.id };
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
        if (mName) { 
          // Parse the name value, stripping GEDCOM slashes if present
          let nameValue = mName[1];
          // Extract surname from /surname/ format if present
          const surnameMatch = /\/([^\/]+)\//.exec(nameValue);
          if (surnameMatch) {
            currSurname = surnameMatch[1];
            // Remove /surname/ from the name to get given name
            const givenPart = nameValue.replace(/\/[^\/]+\//, "").trim();
            currGivenName = givenPart;
            // Store as "Given Surname" format
            nameValue = givenPart ? `${givenPart} ${currSurname}` : currSurname;
          }
          currPerson.name = nameValue;
          inName = true;
          continue; 
        }

        const mSex = /^SEX\s+([MFU])$/.exec(rest);
        if (mSex) { currPerson.sex = mSex[1] as any; inName = false; continue; }

        const mFamc = /^FAMC\s+@([^@]+)@$/.exec(rest);
        if (mFamc) { currPerson.famc = [...(currPerson.famc ?? []), mFamc[1]]; inName = false; continue; }

        const mFams = /^FAMS\s+@([^@]+)@$/.exec(rest);
        if (mFams) { currPerson.fams = [...(currPerson.fams ?? []), mFams[1]]; inName = false; continue; }

        const mEvent = /^(BIRT|DEAT|EVEN|CHR|BAPM|BURI|MARR|DIV)$/.exec(rest);
        if (mEvent) {
          currEventTag = mEvent[1];
          currPerson.events!.push({ type: currEventTag });
          inMap = false;
          inName = false;
          currPlaceName = undefined;
          currLat = undefined;
          currLong = undefined;
          continue;
        }
        currEventTag = undefined;
        inName = false;
      } else if (level === 2 && inName) {
        // Handle GIVN and SURN sub-tags under NAME
        const mGivn = /^GIVN\s+(.+)$/.exec(rest);
        if (mGivn) {
          currGivenName = mGivn[1];
          // Reconstruct name from GIVN and SURN if we have both
          if (currGivenName && currSurname) {
            currPerson.name = `${currGivenName} ${currSurname}`;
          } else if (currGivenName) {
            currPerson.name = currGivenName;
          }
          continue;
        }
        
        const mSurn = /^SURN\s+(.+)$/.exec(rest);
        if (mSurn) {
          currSurname = mSurn[1];
          // Reconstruct name from GIVN and SURN if we have both
          if (currGivenName && currSurname) {
            currPerson.name = `${currGivenName} ${currSurname}`;
          } else if (currSurname) {
            currPerson.name = currSurname;
          }
          continue;
        }
      } else if (level === 2 && currEventTag) {
        const lastEv = currPerson.events![currPerson.events!.length - 1];
        const mDate = /^DATE\s+(.+)$/.exec(rest);
        if (mDate && lastEv) { lastEv.date = mDate[1]; continue; }
        const mPlac = /^PLAC\s+(.+)$/.exec(rest);
        if (mPlac && lastEv) { 
          lastEv.place = mPlac[1]; 
          currPlaceName = mPlac[1];
          continue; 
        }
      } else if (level === 3 && currEventTag) {
        const mMap = /^MAP$/.exec(rest);
        if (mMap) { inMap = true; continue; }
      } else if (level === 4 && inMap && currEventTag) {
        const mLati = /^LATI\s+(.+)$/.exec(rest);
        if (mLati) { currLat = mLati[1]; continue; }
        const mLong = /^LONG\s+(.+)$/.exec(rest);
        if (mLong) { currLong = mLong[1]; continue; }
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

    if (current.type === "SOUR" && currSource) {
      if (level === 1) {
        const mTitle = /^TITL\s+(.+)$/.exec(rest);
        if (mTitle) { currSource.title = mTitle[1]; continue; }
        const mAuth = /^AUTH\s+(.+)$/.exec(rest);
        if (mAuth) { currSource.author = mAuth[1]; continue; }
        const mPubl = /^PUBL\s+(.+)$/.exec(rest);
        if (mPubl) { currSource.publication = mPubl[1]; continue; }
      }
    }
  }
  if (current.type) flush();

  // Extract unique places from events with coordinates
  const placeMap = new Map<string, Place>();
  persons.forEach(p => {
    p.events?.forEach(ev => {
      if (ev.place) {
        // For now, we don't extract places from GEDCOM back to Place records
        // as places in GEDCOM are inline, not separate records
      }
    });
  });

  return { persons, families, places: Array.from(placeMap.values()), sources };
}