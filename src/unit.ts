import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";

// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import Program from "./program.ts";
import * as AST from "./ast.ts";
import { Panic } from "./compiler.ts";

// An Onyx compilation unit.
export default class Unit {
  program: Program;
  path: string;
  ast?: AST.Root;

  // A lowered module file path, if any.
  lowered?: string;

  funcDefs = new Map<string, AST.FuncDef>();

  constructor(program: Program, path: string) {
    this.program = program;
    this.path = path;
  }

  lookupFuncDef(location: peggy.Location, id: string): AST.FuncRef {
    if (this.funcDefs.has(id)) {
      return new AST.FuncRef(this.funcDefs.get(id)!);
    } else {
      throw new Panic(location, `Undefined function \`${id}\``);
    }
  }

  addFuncDef(_location: peggy.Location, node: AST.FuncDef) {
    this.funcDefs.set(node.id.id, node);
  }

  /**
   * Lower the unit to Zig code.
   */
  async lower() {
    if (!this.ast) {
      throw Error(`Unit's AST at ${this.path} hasn't been compiled yet`);
    }

    const output_path = await this.program.cachePath(this.path, ".zig");
    console.debug(`Writing to ${output_path}`);

    Deno.mkdir(pathAPI.dirname(output_path), { recursive: true });
    const file = await Deno.open(output_path, {
      create: true,
      truncate: true,
      write: true,
    });

    try {
      // List of nodes to go into the unit-local main function.
      const main: AST.Node[] = [];

      for (const node of this.ast!) {
        if (node instanceof AST.Extern || node instanceof AST.FuncDef) {
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
