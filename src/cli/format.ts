import * as BufferAPI from "https://deno.land/std@0.123.0/io/buffer.ts";
import { StringWriter } from "https://deno.land/std@0.123.0/io/writers.ts";
import parse from "../parser.ts";
import { print } from "../cst.ts";

/**
 * Parse and format an Onyx file.
 *
 * @param inputPath  Input file path
 * @param outputPath If not set, output to stdout
 *
 * @return True if succeeded
 */
export default async function format(
  inputPath: string,
  outputPath?: string,
): Promise<boolean> {
  const cst = await parse(inputPath);

  if (outputPath) {
    const file = await Deno.open(outputPath, {
      create: true,
      write: true,
      truncate: true,
    });

    const buf = new BufferAPI.BufWriter(file);

    try {
      await print(buf, cst);
      buf.flush();
    } finally {
      file.close();
    }
  } else {
    const writer = new StringWriter();
    const buf = new BufferAPI.BufWriter(writer);
    await print(buf, cst);
    buf.flush();
    console.log(writer.toString());
  }

  return true;
}
