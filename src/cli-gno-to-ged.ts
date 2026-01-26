#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { gnoToGed } from "./lib/gno-to-ged";

const argv = await yargs(hideBin(process.argv))
	.usage("Usage: $0 <input.gno> -o <output.ged>")
	.option("i", {
		alias: "in",
		type: "string",
		demandOption: true,
		describe: "Input GNO file path",
	})
	.option("o", {
		alias: "out",
		type: "string",
		demandOption: true,
		describe: "Output GED file path",
	})
	.help()
	.strict()
	.parse();

if (!argv.in) {
	console.error(
		"Missing input file. Example: gno-to-ged input.gno -o output.ged"
	);
	process.exit(1);
}

try {
	const input = argv.in as string;
	// TODO filaname from input: last part of path
	const filename = input.replace(/(^.*\/)?(.+)\.gno$/, "$2");
	const ged = await gnoToGed(input, filename);
	await fs.writeFile(argv.out as string, ged, "utf8");
	console.log(`Done: ${path.resolve(argv.out as string)}`);
} catch (e) {
	console.error("Conversion failed:", e instanceof Error ? e.message : e);
	process.exit(1);
}
