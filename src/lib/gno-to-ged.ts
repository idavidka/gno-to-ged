import { readGnoXml } from "../sources/gno-reader.js";
import { gnoToModel } from "../mappers/gno-to-model.js";
import { modelToGed } from "../mappers/model-to-ged.js";

/**
 * Converts a GenoPro .gno file (buffer or path) into GEDCOM text (UTF-8).
 * - Detects gzip/zlib/zip compression
 * - Parses XML
 * - Maps to a simple internal model
 * - Emits GEDCOM 5.5.1
 */
export async function gnoToGed(input: string | Buffer): Promise<string> {
  const xmlText = await readGnoXml(input);
  const { persons, families } = gnoToModel(xmlText);
  const ged = modelToGed(persons, families);
  return ged;
}