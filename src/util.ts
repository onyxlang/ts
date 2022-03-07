import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";
import { encodeToString } from "https://deno.land/std@0.97.0/encoding/hex.ts";
import * as BufferAPI from "https://deno.land/std@0.122.0/io/buffer.ts";
import { StringReader } from "https://deno.land/std@0.128.0/io/mod.ts";

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

async function readLine(
  reader: Deno.Reader,
  lineNumber: number,
): Promise<string | undefined> {
  let i = 0;

  for await (const line of BufferAPI.readLines(reader)) {
    if (lineNumber == i++) {
      return line;
    }
  }

  return undefined;
}

/**
 * @param source     Source code string to read from
 * @param lineNumber The line number to return, starting from 0
 * @returns          The line read, or undefined if there is no such line
 */
export async function readLineFromString(
  source: string,
  lineNumber: number,
): Promise<string | undefined> {
  const stringReader = new StringReader(source);
  return await readLine(stringReader, lineNumber);
}

/**
 * @param filePath   File path to read from
 * @param lineNumber The line number to return, starting from 0
 * @returns          The line read, or undefined if there is no such line
 */
export async function readLineFromFile(
  filePath: string,
  lineNumber: number,
): Promise<string | undefined> {
  const fileReader = await Deno.open(filePath);
  return await readLine(fileReader, lineNumber);
}

export function enumFromStringValue<T>(
  enm: { [s: string]: T },
  value: string,
): T | undefined {
  return (Object.values(enm) as unknown as string[]).includes(value)
    ? value as unknown as T
    : undefined;
}
