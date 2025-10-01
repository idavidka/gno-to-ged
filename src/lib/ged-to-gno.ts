import { gedToModel } from "../mappers/ged-to-model.js";
import { modelToGnoXml } from "../mappers/model-to-gno.js";
import { GnoFormat } from "../types.js";
import { maybeCompress } from "../utils/compression.js";

export interface GedToGnoOptions {
  gzip?: boolean;
  zip?: boolean;
  format?: GnoFormat;
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
  return maybeCompress(arr, opts);
}
