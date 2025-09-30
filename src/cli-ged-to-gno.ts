#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { gedToGno, type GnoFormat } from "./lib/ged-to-gno.js";

const argv = await yargs(hideBin(process.argv))
  .usage("Usage: $0 <input.ged> -o <output.gno> [--format <format>]")
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
  .option("format", {
    alias: "f",
    type: "string",
    choices: ["genopro", "gramps", "legacy", "myheritage", "generic"],
    default: "genopro",
    describe: "Output GNO format (genopro, gramps, legacy, myheritage, or generic)",
  })
  .option("gzip", {
    type: "boolean",
    default: false,
    describe: "Compress output with gzip",
  })
  .option("zip", {
    type: "boolean",
    default: false,
    describe: "Compress output with zip",
  })
  .help()
  .strict()
  .parse();

if (!argv.in) {
  console.error(
    "Missing input file. Example: ged-to-gno input.ged -o output.gno"
  );
  process.exit(1);
}

try {
  const gedText = await fs.readFile(argv.in as string, "utf8");
  const gno = await gedToGno(gedText, {
    format: argv.format as GnoFormat,
    gzip: argv.gzip,
    zip: argv.zip,
  });
  await fs.writeFile(argv.out as string, gno);
  console.log(`Done: ${path.resolve(argv.out as string)} (format: ${argv.format})`);
} catch (e) {
  console.error("Conversion failed:", e instanceof Error ? e.message : e);
  process.exit(1);
}
