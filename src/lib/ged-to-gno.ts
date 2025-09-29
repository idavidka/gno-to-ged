import { gedToModel } from "../mappers/ged-to-model.js";
import { modelToGnoXml } from "../mappers/model-to-gno.js";
import { maybeCompress } from "../utils/compression.js";

export interface GedToGnoOptions {
  gzip?: boolean;
  zip?: boolean;
}

export async function gedToGno(gedText: string, opts: GedToGnoOptions = {}): Promise<Buffer> {
  const model = gedToModel(gedText);
  const xml = modelToGnoXml(model.persons, model.families);
  const buf = Buffer.from(xml, "utf8");
  return maybeCompress(buf, opts);
}