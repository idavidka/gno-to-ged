import { readGnoXml } from "../sources/gno-reader.js";
import { gnoToModel } from "../mappers/gno-to-model.js";
import { modelToGed } from "../mappers/model-to-ged.js";
import { Binary } from "../types.js";

/**
 * Converts a GenoPro .gno file (buffer/arraybuffer/uint8array or path) into GEDCOM text (UTF-8).
 * - Detects gzip/zlib/zip compression
 * - Parses XML
 * - Maps to a simple internal model
 * - Emits GEDCOM 5.5.1
 */
export async function gnoToGed(input: string | Binary): Promise<string> {
  const xmlText = await readGnoXml(input);
  const { persons, families, places, sources } = gnoToModel(xmlText);
  return modelToGed(persons, families, places, sources);
}
