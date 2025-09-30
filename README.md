# GNO → GED converter (TypeScript)

A minimal, extensible TypeScript tool to convert GenoPro `.gno` files to GEDCOM `.ged` and vice versa.

Features:

- Automatically detects and decompresses gzip/zlib/zip-packed `.gno` files
- Parses the resulting XML and maps it heuristically to a simple internal model
- Emits GEDCOM 5.5.1 with comprehensive record support:
  - INDI (individuals) with NAME, SEX, events (BIRT/DEAT with DATE/PLAC), FAMC/FAMS
  - FAM (families) with HUSB, WIFE, CHIL references
  - PLAC with MAP structure (LATI/LONG) for place coordinates embedded in events
  - Source records (SOUR) with title, author, and publication info
- Recursively resolves all references:
  - Place references (e.g., `place00055`) are resolved and coordinates embedded in events
  - Source references are fully expanded
  - Family child references are properly maintained
- Bidirectional conversion: GNO ↔ GED with round-trip fidelity
- Node 20+ and ESM-friendly

Note: GenoPro `.gno` XML schemas may vary across versions or exports. The mapper aims to handle typical containers and attributes (`GenoPro`/`Genealogy`, `Individuals`/`Persons`, `Families`/`Unions`, `Places`, `Sources`, etc.). For best fidelity, share a sample `.gno` and we can refine the mapper accordingly.

## Install

```bash
npm i
npm run build
```

## CLI

```bash
# Convert .GNO to .GED
npx gno-to-ged -i input.gno -o output.ged
```

During development (without building):

```bash
npm run dev -- input.gno -o output.ged
```

## Library API

```ts
import { gnoToGed } from "./dist";

const gedText = await gnoToGed("path/to/input.gno"); // or Buffer
console.log(gedText);
```

## How it works

1. Reads the `.gno` file as a Buffer.
2. Detects compression (gzip/zlib/zip) and decompresses if needed.
3. Parses the result as XML.
4. Maps XML → internal model (persons, families, places, sources).
5. Recursively resolves all references (e.g., place IDs → embedded coordinates).
6. Serializes internal model → GEDCOM (5.5.1) with proper MAP/LATI/LONG structure for places.

For GED → GNO conversion:
1. Parses GEDCOM file into internal model.
2. Extracts all records (individuals, families, places from MAP structures, sources).
3. Generates GNO XML with proper structure and references.
4. Optionally compresses the output (gzip/zip).

## Known limitations

- The mapper is heuristic. For full fidelity, we may need to align to your exact `.gno` XML schema and field names.
- Only a subset of GEDCOM tags are supported by default. Extending the mapper is straightforward—add fields in `src/mappers/gno-to-model.ts` and `src/mappers/model-to-ged.ts`.
- Place coordinates are embedded in events using GEDCOM standard MAP/LATI/LONG structure (not as separate records).

## Requirements

- Node.js 20+
- macOS/Linux/Windows

## License

MIT (adjust as needed).
