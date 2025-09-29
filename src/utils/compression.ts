import { inflate, ungzip, gzip as gzipPako } from "pako";
import unzipper from "unzipper";

/** Detect gzip via magic header (0x1F 0x8B). */
export function isGzip(buf: Buffer) {
  return buf[0] === 0x1f && buf[1] === 0x8b;
}

/** Detect zlib via common CMF/FLG bytes (0x78 0x01/0x9C/0xDA). */
export function isZlib(buf: Buffer) {
  return buf[0] === 0x78 && [0x01, 0x9c, 0xda].includes(buf[1]);
}

/** Detect zip via magic header "PK\x03\x04". */
export function isZip(buf: Buffer) {
  return (
    buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04
  );
}

/**
 * Converts a possibly-compressed buffer to text (UTF-8).
 * Supports: gzip, zlib/deflate, zip (takes the first file entry).
 * Falls back to raw UTF-8 if no known compression is detected.
 */
export async function maybeDecompressToText(buf: Buffer): Promise<string> {
  if (isGzip(buf)) {
    const out = ungzip(buf);
    return new TextDecoder().decode(out);
  }
  if (isZlib(buf)) {
    const out = inflate(buf);
    return new TextDecoder().decode(out);
  }
  if (isZip(buf)) {
    const dir = await unzipper.Open.buffer(buf);
    const first = dir.files.find((f) => !f.path.endsWith("/"));
    if (!first) throw new Error("ZIP: no file entry found");
    const content = await first.buffer();
    return content.toString("utf8");
  }
  return buf.toString("utf8");
}

/**
 * Optionally compress a Buffer.
 * - If opts.gzip is true, returns a gzip-compressed Buffer.
 * - If opts.zip is true, throws unless zip support is added (JSZip or similar).
 * - Otherwise, returns the input unmodified.
 */
export async function maybeCompress(
  buf: Buffer,
  opts: { gzip?: boolean; zip?: boolean } = {}
): Promise<Buffer> {
  if (opts.gzip) {
    const out = gzipPako(buf);
    return Buffer.from(out);
  }
  if (opts.zip) {
    // If you want ZIP output, I can add JSZip and implement it.
    throw new Error(
      "ZIP output not implemented yet. Use { gzip: true } or ask me to add ZIP support."
    );
  }
  return buf;
}
