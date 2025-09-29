# GNO → GED converter (TypeScript)

A minimal, extensible TypeScript tool to convert GenoPro `.gno` files to GEDCOM `.ged`.

Features:
- Automatically detects and decompresses gzip/zlib/zip-packed `.gno` files
- Parses the resulting XML and maps it heuristically to a simple internal model
- Emits GEDCOM 5.5.1 with basic records (INDI, FAM, NAME, SEX, BIRT/DEAT with DATE/PLAC, FAMC/FAMS)
- Node 20+ and ESM-friendly

Note: GenoPro `.gno` XML schemas may vary across versions or exports. The mapper aims to handle typical containers and attributes (`GenoPro`/`Genealogy`, `Individuals`/`Persons`, `Families`/`Unions`, etc.). For best fidelity, share a sample `.gno` and we can refine the mapper accordingly.

## Install

```bash
npm i
npm run build
```

## CLI

```bash
# Convert .GNO to .GED
npx gno-to-ged input.gno -o output.ged
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
4. Maps XML → internal model (persons, families).
5. Serializes internal model → GEDCOM (5.5.1).

## Known limitations

- The mapper is heuristic. For full fidelity, we may need to align to your exact `.gno` XML schema and field names.
- Only a handful of tags are supported by default. Extending the mapper is straightforward—add fields in `src/mappers/gno-to-model.ts` and `src/mappers/model-to-ged.ts`.

## Requirements

- Node.js 20+
- macOS/Linux/Windows

## License

MIT (adjust as needed).