// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as AST from "./ast.ts";
import { Panic } from "./compiler.ts";
import { digest } from "./util.ts";
import Unit from "./unit.ts";
import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";

// An Onyx program.
export default class Program {
  units = new Array<Unit>();
  cache_dir?: string;
  ffi_protos = new Map<string, AST.CProto>();

  constructor(cache_dir?: string) {
    this.cache_dir = cache_dir;
  }

  /**
   * Create and return a new compilation unit at _path_.
   *
   * @param path Source file path
   * @returns Newly created unit instance
   */
  create_unit(path: string): Unit {
    const unit = new Unit(this, path);
    this.units.push(unit);
    return unit;
  }

  add_ffi_proto(proto: AST.CProto) {
    this.ffi_protos.set(proto.id, proto);
  }

  ref_ffi_proto(location: peggy.Location, id: string): AST.FFIProtoRef {
    if (this.ffi_protos.has(id)) {
      return new AST.FFIProtoRef(id);
    } else {
      throw new Panic(location, `C function \`${id}\` undeclared`);
    }
  }

  /**
   * Return path of the file in the cache dir with optional extension,
   * otherwise extension-less.
   *
   * @example cachePath("./foo/bar.nx")         // "<cache>/<hash>"
   * @example cachePath("./foo/bar.nx", ".zig") // "<cache>/<hash>.zig"
   */
  async cachePath(path: string, ext?: string): Promise<string> {
    if (!this.cache_dir) throw Error("Cache dir is not set for program");

    const resolved = pathAPI.resolve(path);
    const hash = await digest("sha-1", resolved);

    if (ext) return pathAPI.join(this.cache_dir, hash + ext!);
    else return pathAPI.join(this.cache_dir, hash);
  }
}
