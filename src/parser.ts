// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

// IDEA:
//
// ```nx
// namespace Onyx {
//   import * as CST from "./onyx/cst.nx";
//   import * as Lang from "./onyx/lang.nx";
//   final foo = 42 # Implicitly static
//   decl bar()     # Ditto
// }
// ```
//

import * as OnyxAST from "./onyx/ast.ts";
import * as OnyxLang from "./onyx/lang.ts";
import * as CAST from "./c/ast.ts";
import * as CLang from "./c/lang.ts";
import * as GenAST from "./ast.ts";

import Panic from "./panic.ts";

function copyLocationRange(source: peggy.LocationRange): peggy.LocationRange {
  return {
    source: source.source,
    start: {
      line: source.start.line,
      column: source.start.column,
      offset: source.start.offset,
    },
    end: {
      line: source.end.line,
      column: source.end.column,
      offset: source.end.offset,
    },
  };
}

export function joinLocationRanges(
  ranges: peggy.LocationRange[],
): peggy.LocationRange {
  const result = copyLocationRange(ranges[0]);

  for (const range of ranges) {
    if (result.source !== range.source) {
      throw Error(
        `Location source mismatch upon joining them: ${result.source} vs. ${range.source}`,
      );
    }

    if (range.start.line < result.start.line) {
      result.start.line = range.start.line;
      result.start.column = range.start.column;
    } else if (
      range.start.line === result.start.line &&
      range.start.column < result.start.column
    ) {
      result.start.column = range.start.column;
    }

    if (range.end.line > result.end.line) {
      result.end.line = range.end.line;
      result.end.column = range.end.column;
    } else if (
      range.end.line === result.end.line &&
      range.end.column > result.end.column
    ) {
      result.end.column = range.end.column;
    }
  }

  return result;
}

const trace = false; // Change to enable tracing

const grammarSourcePath = "src/grammar/onyx.peggy";
const grammarSource = await Deno.readTextFile(grammarSourcePath);
const pegParser = peggy.generate(grammarSource, {
  allowedStartRules: ["top_level"],
  plugins: [
    {
      use(_: peggy.Config, options: any) {
        options.Onyx = { AST: OnyxAST, Lang: OnyxLang };
        options.C = { AST: CAST, Lang: CLang };
        options.Generic = { AST: GenAST };
        options.util = {
          joinLocationRanges,
        };
      },
    },
  ],
});

/**
 * Parse an Onyx source file CST.
 * @param filePath Path to source file
 * @returns The parsed CST.
 */
export default async function parse(
  filePath: string,
): Promise<OnyxAST.Node[]> {
  const input = await Deno.readTextFile(filePath);

  try {
    return pegParser.parse(input, {
      grammarSource: filePath,
      startRule: "top_level",
      trace,
    });
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
