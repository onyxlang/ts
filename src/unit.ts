import Program from "./program.ts";
import * as AST from "./ast.ts";
import { replaceExt } from "./util.ts";

// An Onyx compilation unit.
export default class Unit {
  program: Program;
  path: string;
  ast?: AST.Root;

  // A lowered module file path, if any.
  lowered?: string;

  constructor(program: Program, path: string) {
    this.program = program;
    this.path = path;
  }

  /**
   * Lower the unit to Zig code.
   *
   * @param output_path Output file path, defaults to "*.zig"
   */
  async lower(output_path?: string) {
    if (!this.ast)
      throw Error(`Unit's AST at ${this.path} hasn't been compiled yet`);

    if (!output_path) {
      output_path = replaceExt(this.path, ".zig");
    }

    const file = await Deno.open(output_path, {
      create: true,
      truncate: true,
      write: true,
    });

    try {
      // List of nodes to go into the unit-local main function.
      const main: AST.Node[] = [];

      for (const node of this.ast!) {
        if (node instanceof AST.Extern) {
          await node.lowerToZig(file);
        } else {
          main.push(node);
        }
      }

      await AST.zigMain(file, async () => {
        for (const node of main) {
          await node.lowerToZig(file);
        }
      });

      this.lowered = output_path;
    } finally {
      file.close();
    }
  }
}
