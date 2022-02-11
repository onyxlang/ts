// @deno-types="https://raw.githubusercontent.com/onyxlang/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/onyxlang/peggy/cjs-to-es15/lib/peg.js";

import * as BufferAPI from "https://deno.land/std@0.123.0/io/buffer.ts";
import { StringWriter } from "https://deno.land/std@0.123.0/io/writers.ts";

import * as OnyxCST from "./onyx/cst.ts";
import * as CCST from "./c/cst.ts";
import * as CST from "./cst.ts";
import { Keyword as OnyxKeyword, Safety } from "./onyx/lang.ts";
import { Keyword as CKeyword } from "./c/lang.ts";
import Panic from "./panic.ts";

const grammarSourcePath = "src/onyx.peggy";
const grammarSource = await Deno.readTextFile(grammarSourcePath);
const pegParser = peggy.generate(grammarSource, {
  // trace: true, // Uncomment to enable tracing
  // grammarSource,
  plugins: [
    {
      use(_: peggy.Config, options: any) {
        options.poly = { CST }; // "poly" stands for "polyglot"
        options.nx = { CST: OnyxCST, Keyword: OnyxKeyword, Safety };
        options.c = { CST: CCST, Keyword: CKeyword };
      },
    },
  ],
});

/**
 * Parse an Onyx source file CST.
 * @param filePath Path to source file
 * @returns The parsed CST.
 */
export default async function parse(filePath: string): Promise<OnyxCST.Any[]> {
  const input = await Deno.readTextFile(filePath);

  try {
    return pegParser.parse(input, { grammarSource: filePath });
  } catch (e: any) {
    if (typeof e.format === "function") {
      await new Panic(
        (e as peggy.parser.SyntaxError).message,
        (e as peggy.parser.SyntaxError).location,
      ).log({ backtrace: false });

      Deno.exit(1);
    } else {
      throw e;
    }
  }
}

export async function parseToString(filePath: string): Promise<string> {
  const cst = await parse(filePath);

  const writer = new StringWriter();
  const buf = new BufferAPI.BufWriter(writer);

  for (const node of cst) {
    await node.print(buf);
  }

  buf.flush();
  return writer.toString();
}
