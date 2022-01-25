import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";
import { encodeToString } from "https://deno.land/std@0.97.0/encoding/hex.ts";

export function stringToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function replaceExt(path: string, ext: string | null) {
  const basename = pathAPI.basename(path, pathAPI.extname(path));
  if (ext) return pathAPI.join(pathAPI.dirname(path), basename + ext!);
  else return pathAPI.join(pathAPI.dirname(path), basename);
}

export async function digest(algo: AlgorithmIdentifier, data: string) {
  const _data = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest(algo, _data.buffer);
  return encodeToString(new Uint8Array(digest));
}
