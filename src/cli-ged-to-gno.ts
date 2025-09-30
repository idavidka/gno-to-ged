#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { gedToGno } from "./lib/ged-to-gno";

const argv = await yargs(hideBin(process.argv))
  .usage("Usage: $0 <input.ged> -o <output.gno>")
  .option("i", {
    alias: "in",
    type: "string",
    demandOption: true,
    describe: "Input GED file path",
  })
  .option("o", {
    alias: "out",
    type: "string",
    demandOption: true,
    describe: "Output GNO file path",
  })
  .help()
  .strict()
  .parse();

if (!argv.in) {
  console.error(
    "Missing input file. Example: ged-to-no input.ged -o output.gno"
  );
  process.exit(1);
}

try {
  const gno = await gedToGno(argv.in as string);
  await fs.writeFile(argv.out as string, gno, "utf8");
  console.log(`Done: ${path.resolve(argv.out as string)}`);
} catch (e) {
  console.error("Conversion failed:", e instanceof Error ? e.message : e);
  process.exit(1);
}
