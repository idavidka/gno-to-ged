import fs from "node:fs/promises";
import { maybeDecompressToText } from "../utils/compression.js";

/**
 * Reads a .gno file or buffer, decompresses if needed, and returns XML text.
 * Throws if the result does not look like XML.
 */
export async function readGnoXml(input: string | Buffer): Promise<string> {
  const buf = Buffer.isBuffer(input) ? input : await fs.readFile(input);
  const xml = await maybeDecompressToText(buf);
  if (!xml.trim().startsWith("<")) {
    throw new Error(
      ".gno does not look like XML (it may require different processing)"
    );
  }
  return xml;
}
