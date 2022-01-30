import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";
import * as BufferAPI from "https://deno.land/std@0.123.0/io/buffer.ts";
import Program from "./program.ts";
import * as OnyxAST from "./onyx/ast.ts";
import * as OnyxCST from "./onyx/cst.ts";
import parse from "./parser.ts";

// IDEA: Would be nice to have this syntax in Onyx:
//
// ```nx
// import {
//   * as AST from "./onyx/ast.ts",
//   * as CST from "./onyx/cst.ts",
// } as Onyx;
//
// # Or:
// #
//
// namespace Onyx {
//   import * as AST from "./onyx/ast.ts"
//   import * as CST from "./onyx/cst.ts"
// }
//
// Onyx::AST::Block
// ```
//

/** An Onyx compilation unit. */
export default class Unit {
  private _program: Program;
  private _filePath: string;

  private _cst?: OnyxCST.Any[];
  private _topLevel?: OnyxAST.TopLevel;

  _loweredModulePath?: string;

  loweredModulePath(): string {
    if (!this._loweredModulePath) {
      throw new Error(
        "The unit at " + this._filePath + " hasn't been lowered yet",
      );
    } else {
      return this._loweredModulePath;
    }
  }

  program(): Program {
    return this._program;
  }

  filePath(): string {
    return this._filePath;
  }

  parsed(): boolean {
    return !!this._cst;
  }

  compiled(): boolean {
    return !!this._topLevel;
  }

  constructor(program: Program, path: string) {
    this._program = program;
    this._filePath = path;
  }

  async parse() {
    if (this.parsed()) {
      return; // Already parsed
    }

    this._cst = await parse(this._filePath);
  }

  compile() {
    if (this.compiled()) {
      return; // Already compiled
    }

    if (!this.parsed()) {
      throw Error("The unit's CST isn't parsed yet");
    }

    this._topLevel = new OnyxAST.TopLevel(this);

    for (const node of this._cst!) {
      this._topLevel.compile(node);
    }
  }

  async lower(): Promise<string> {
    if (!this.compiled()) {
      throw Error(`Unit at ${this._filePath} hasn't been compiled yet`);
    }

    const output_path = await this._program.cachePath(this._filePath, ".zig");
    console.debug(`Lowering to ${output_path}`);

    Deno.mkdir(pathAPI.dirname(output_path), { recursive: true });

    const file = await Deno.open(output_path, {
      create: true,
      truncate: true,
      write: true,
    });

    const buf = new BufferAPI.BufWriter(file);

    try {
      await this._topLevel!.lower(buf);
      buf.flush();
      this._loweredModulePath = output_path;
    } finally {
      file.close();
    }

    return output_path;
  }
}
