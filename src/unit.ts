import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";
import * as BufferAPI from "https://deno.land/std@0.123.0/io/buffer.ts";
import Program from "./program.ts";
import * as OnyxAST from "./onyx/ast.ts";
import * as OnyxDST from "./onyx/dst.ts";
import * as Lang from "./onyx/lang.ts";
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
  readonly program: Program;
  readonly filePath: string;
  private _ast?: OnyxAST.Node[];
  private _dst?: OnyxDST.TopLevel;
  private _loweredModulePath?: string;

  defaultExport?: OnyxDST.Exportable;
  readonly imports = new Map<string, OnyxDST.Exportable>();

  cachedPath(): Promise<string> {
    return this.program.cachePath(this.filePath, ".zig");
  }

  loweredModulePath(): string {
    if (!this._loweredModulePath) {
      throw new Error(
        "The unit at " + this.filePath + " hasn't been lowered yet",
      );
    } else {
      return this._loweredModulePath;
    }
  }

  parsed(): boolean {
    return !!this._ast;
  }

  compiled(): boolean {
    return !!this._dst;
  }

  constructor(program: Program, path: string) {
    this.program = program;
    this.filePath = path;
  }

  async parse() {
    if (this.parsed()) {
      return; // Already parsed
    }

    this._ast = await parse(this.filePath);
  }

  async compile() {
    if (!this.parsed()) await this.parse();
    this._dst = new OnyxDST.TopLevel(this);

    console.debug(`Compiling ${this.filePath}...`);
    for (const node of this._ast!) {
      const dst = await node.resolve(this._dst);
      if (dst instanceof OnyxDST.Call) this._dst.store(dst);
      if (dst instanceof OnyxDST.Import) this._dst.imports.push(dst);
    }
  }

  async lower(): Promise<string> {
    if (!this.compiled()) await this.compile();

    const output_path = await this.cachedPath();
    console.debug(`Lowering ${this.filePath} to ${output_path}...`);

    await Deno.mkdir(pathAPI.dirname(output_path), { recursive: true });

    const file = await Deno.open(output_path, {
      create: true,
      truncate: true,
      write: true,
    });

    const buf = new BufferAPI.BufWriter(file);

    try {
      await this._dst!.lower(buf, { safety: Lang.Safety.FRAGILE });
      await buf.flush();
      this._loweredModulePath = output_path;
    } finally {
      file.close();
    }

    return output_path;
  }
}
