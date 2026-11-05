import { collectPictureFiles, gedToModel } from "../mappers/ged-to-model";
import { modelToGnoXml } from "../mappers/model-to-gno";
import { GnoFormat } from "../types";
import { maybeCompress } from "../utils/compression";

export interface GedToGnoOptions {
  gzip?: boolean;
  zip?: boolean;
  format?: GnoFormat;
  /** Extra zip entries, such as picture bytes referenced by FILE paths. */
  files?: Array<{ path: string; data: Uint8Array }>;
}

export async function gedToGno(
  gedText: string,
  opts: GedToGnoOptions = {}
): Promise<Uint8Array> {
  const model = gedToModel(gedText);
  const xml = modelToGnoXml(
    model.persons,
    model.families,
    model.places,
    model.sources,
    opts.format || "genopro"
  );
  const encoder = new TextEncoder();
  const arr = encoder.encode(xml);
  const files = collectPictureFiles(model.persons);
  const seen = new Set(files.map((file) => file.path));
  for (const file of opts.files ?? []) {
    if (!file.path || seen.has(file.path)) continue;
    seen.add(file.path);
    files.push(file);
  }
  return maybeCompress(arr, {
    ...opts,
    files,
  });
}
