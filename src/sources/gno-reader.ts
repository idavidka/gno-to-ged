import fs from "node:fs/promises";
import { maybeDecompressToText } from "../utils/compression.js";

/**
 * Reads a .gno file or buffer, decompresses if needed, and returns XML text.
 * Throws if the result does not look like XML.
 */
export async function readGnoXml(
  input: string | Uint8Array | ArrayBuffer
): Promise<string> {
  let arr: Uint8Array;

  if (typeof input === "string") {
    // Node-only: dynamic import of fs
    const buf = await fs.readFile(input);
    arr = new Uint8Array(buf);
  } else if (input instanceof Uint8Array) {
    arr = input;
  } else {
    arr = new Uint8Array(input); // ArrayBuffer
  }

  const xml = await maybeDecompressToText(arr);

  if (!xml.trim().startsWith("<")) {
    throw new Error(
      ".gno does not look like XML (it may require different processing)"
    );
  }
  return xml;
}
