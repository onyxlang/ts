// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/parser.js";

import * as AST from "./ast.ts";
import Program from "./program.ts";
import Unit from "./unit.ts";

export enum Punct {
  // A horizontal space.
  SPACE,

  // A single newline.
  NEWLINE,

  // Any character or series of characters that represent horizontal or vertical space.
  // Essentially a multiline.
  WHITESPACE,
}

export class Panic {
  location: peggy.Location;
  message: string;

  constructor(location: peggy.Location, message: string) {
    this.location = location;
    this.message = message;
  }

  format(): string {
    return this.message;
  }
}

const grammarSourcePath = "src/onyx.peggy";
const grammarSource = await Deno.readTextFile(grammarSourcePath);
const pegParser = peggy.generate(grammarSource, {
  grammarSource,
  plugins: [
    {
      use(_: peggy.Config, options: any) {
        options.nx = { AST, Punct, Panic };
      },
    },
  ],
});

// Compile an Onyx AST.
async function compile_ast(
  unit: Unit,
  semanticAnalysis: boolean
): Promise<AST.Root> {
  const input = await Deno.readTextFile(unit.path);

  try {
    return pegParser.parse(input, {
      unit,
      semanticAnalysis,
    });
  } catch (e: any) {
    if (e instanceof Panic) {
      console.error("Panic! " + e.format());
      Deno.exit(1);
    } else if (typeof e.format === "function") {
      const error = e as peggy.parser.SyntaxError;
      console.error(error.format([{ source: null, text: input }]));
      Deno.exit(1);
    } else {
      throw e;
    }
  }
}

async function compile(input_path: string) {
  const program = new Program();
  const unit = program.create_unit(input_path);
  unit.ast = await compile_ast(unit, true);
  await unit.lower();
  return unit;
}

/**
 * Build an Onyx program.
 *
 * @param input_path Input file path
 * @param output_path Output executable path
 * @param zig_path Zig compiler executable path
 */
export async function build(
  input_path: string,
  output_path: string,
  zig_path: string
) {
  const unit = await compile(input_path);

  const process = Deno.run({
    cmd: [zig_path, "build-exe", unit.lowered!, "-lc"],
  });

  await process.status();
}

/**
 * Build and run an Onyx program.
 *
 * @param input_path Input file path
 * @param zig_path Zig compiler executable path
 */
export async function run(input_path: string, zig_path: string) {
  const unit = await compile(input_path);
  const process = Deno.run({ cmd: [zig_path, "run", unit.lowered!, "-lc"] });
  await process.status();
}

/**
 * Parse an Onyx source file into AST.
 *
 * @param input_path Input file path
 * @param output_path If not set, output to stdout
 */
export async function parse(
  input_path: string,
  output_path?: string
): Promise<void> {
  const program = new Program();
  const unit = program.create_unit(input_path);
  const ast = await compile_ast(unit, false);

  if (output_path) {
    await Deno.writeTextFile(output_path, Deno.inspect(ast, { depth: 16 }));
  } else {
    // If no output path is specified, output to stdout.
    console.dir(ast, { depth: 16, colors: true, showHidden: false });
  }
}
