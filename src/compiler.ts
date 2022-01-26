// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

// @deno-types="https://deno.land/x/chalk_deno@v4.1.1-deno/index.d.ts"
import chalk from "https://deno.land/x/chalk_deno@v4.1.1-deno/source/index.js";

import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";

import { readLine } from "./util.ts";
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

async function customOutput(unit: Unit, e: peggy.parser.SyntaxError) {
  const line = await readLine(unit.path, e.location.start.line);

  if (!line) {
    throw Error(
      `Could not read line ${e.location.start.line} from ${unit.path}`,
    );
  }

  // deno-fmt-ignore-start
  const message = `${chalk.bgRed.bold("  Panic!  ")} Invalid syntax

  At ${chalk.cyan(`${e.location.source.path}:${e.location.start.line}:${e.location.start.column}`)}

     ${chalk.gray(`${e.location.start.line}. |`)} ${chalk.cyan.bold(line)}
         ${' '.repeat(e.location.start.column)}${chalk.red.bold('^')} ${e.message}
`;
  // deno-fmt-ignore-end

  console.error(message);
}

/**
 * Compile a unit AST.
 *
 * @param unit
 * @param semanticAnalysis If true, would enable semantic compilation.
 * Otherwise, would simply parse the file.
 * @returns
 */
async function compile_ast(
  unit: Unit,
  semanticAnalysis: boolean
): Promise<AST.Root> {
  const input = await Deno.readTextFile(unit.path);

  try {
    return pegParser.parse(input, {
      unit,
      semanticAnalysis,
      grammarSource: unit,
    });
  } catch (e: any) {
    if (e instanceof Panic) {
      console.error("Panic! " + e.format());
      Deno.exit(1);
    } else if (typeof e.format === "function") {
      await customOutput(unit, e as peggy.parser.SyntaxError);
      Deno.exit(1);
    } else {
      throw e;
    }
  }
}

async function compile(entry_path: string, cache_dir: string) {
  const program = new Program(cache_dir);
  const unit = program.create_unit(entry_path);
  unit.ast = await compile_ast(unit, true);
  await unit.lower();
  return unit;
}

/**
 * Build an Onyx program.
 *
 * @param input_path  Input source file path
 * @param output_path Output executable path
 * @param zig_path    Zig compiler executable path
 * @param cache_dir   Cache directory
 *
 * @return True if succeeded
 */
export async function build(
  input_path: string,
  output_path: string,
  zig_path: string,
  cache_dir: string
): Promise<boolean> {
  const unit = await compile(input_path, cache_dir);

  const cmd = [
    zig_path,
    "build-exe",
    unit.lowered!,
    "-lc",
    "--cache-dir",
    pathAPI.join(cache_dir, "zig"),
    "-femit-bin=" + output_path,
  ];

  console.debug(cmd.join(" "));
  const process = Deno.run({ cmd });

  return (await process.status()).success;
}

/**
 * Build and run an Onyx program.
 *
 * @param input_path Input file path
 * @param zig_path   Zig compiler executable path
 * @param cache_dir  Cache directory
 *
 * @return True if succeeded
 */
export async function run(
  input_path: string,
  zig_path: string,
  cache_dir: string
): Promise<boolean> {
  const unit = await compile(input_path, cache_dir);

  const cmd = [
    zig_path,
    "run",
    unit.lowered!,
    "-lc",
    "--cache-dir",
    pathAPI.join(cache_dir, "zig"),
  ];

  console.debug(cmd.join(" "));
  const process = Deno.run({ cmd });

  return (await process.status()).success;
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
): Promise<boolean> {
  const program = new Program("");
  const unit = program.create_unit(input_path);
  const ast = await compile_ast(unit, false);

  if (output_path) {
    await Deno.writeTextFile(output_path, Deno.inspect(ast, { depth: 16 }));
  } else {
    // If no output path is specified, output to stdout.
    console.dir(ast, { depth: 16, colors: true, showHidden: false });
  }

  return true;
}
