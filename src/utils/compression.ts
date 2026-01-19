import { inflate, ungzip, gzip as gzipPako } from "pako";
import JSZip from "jszip";
import { Binary } from "../types";

function getArray(buf: Binary): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

/** Detect gzip via magic header (0x1F 0x8B). */
export function isGzip(buf: Binary) {
  const arr = getArray(buf);
  return arr[0] === 0x1f && arr[1] === 0x8b;
}

/** Detect zlib via common CMF/FLG bytes (0x78 0x01/0x9C/0xDA). */
export function isZlib(buf: Binary) {
  const arr = getArray(buf);
  return arr[0] === 0x78 && [0x01, 0x9c, 0xda].includes(arr[1]);
}

/** Detect zip via magic header "PK\x03\x04". */
export function isZip(buf: Binary) {
  const arr = getArray(buf);
  return (
    arr[0] === 0x50 && arr[1] === 0x4b && arr[2] === 0x03 && arr[3] === 0x04
  );
}

/**
 * Converts a possibly-compressed buffer to text (UTF-8).
 * Supports: gzip, zlib/deflate, zip (takes the first file entry).
 * Falls back to raw UTF-8 if no known compression is detected.
 */
export async function maybeDecompressToText(buf: Binary): Promise<string> {
  const arr = getArray(buf);
  if (isGzip(arr)) {
    const out = ungzip(arr);
    return new TextDecoder().decode(out);
  }
  if (isZlib(arr)) {
    const out = inflate(arr);
    return new TextDecoder().decode(out);
  }
  if (isZip(arr)) {
    const zip = await JSZip.loadAsync(arr);
    const firstName = Object.keys(zip.files)[0];
    const firstFile = await zip.files[firstName].async("string");
    return firstFile;
  }
  return new TextDecoder().decode(arr);
}

/**
 * Optionally compress a Buffer.
 * - If opts.gzip is true, returns a gzip-compressed Buffer.
 * - If opts.zip is true, throws unless zip support is added (JSZip or similar).
 * - Otherwise, returns the input unmodified.
 */
export async function maybeCompress(
  buf: Uint8Array,
  opts: { gzip?: boolean; zip?: boolean } = {}
): Promise<Uint8Array> {
  if (opts.gzip) {
    const out = gzipPako(buf);
    return out; // pako Uint8Array-t ad vissza
  }
  if (opts.zip) {
    throw new Error(
      "ZIP output not implemented yet. Use { gzip: true } or ask me to add ZIP support."
    );
  }
  return buf;
}
