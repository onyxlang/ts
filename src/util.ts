import * as path from "https://deno.land/std@0.122.0/path/mod.ts";

export function stringToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function replaceExt(source: string, ext: string) {
  const basename = path.basename(source, path.extname(source));
  return path.join(path.dirname(source), basename + ext);
}
