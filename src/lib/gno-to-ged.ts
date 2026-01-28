import { gnoToModel } from "../mappers/gno-to-model";
import { modelToGed } from "../mappers/model-to-ged";
import { readGnoXml } from "../sources/gno-reader";
import type { Binary } from "../types";

/**
 * Converts a GenoPro .gno file (buffer/arraybuffer/uint8array or path) into GEDCOM text (UTF-8).
 * - Detects gzip/zlib/zip compression
 * - Parses XML
 * - Maps to a simple internal model
 * - Emits GEDCOM 5.5.1
 *
 * @param input - The .gno file as path, Buffer, ArrayBuffer, or Uint8Array
 * @param fileName - Optional filename to use in the GEDCOM header (without extension)
 */
export async function gnoToGed(
	input: string | Binary,
	fileName?: string
): Promise<string> {
	const xmlText = await readGnoXml(input);
	const { persons, families, places, sources } = gnoToModel(xmlText);
	return modelToGed(persons, families, places, sources, fileName);
}
