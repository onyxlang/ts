// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as AST from "./ast.ts";
import { Panic } from "./compiler.ts";
import Unit from "./unit.ts";

// An Onyx program.
export default class Program {
  ffi_protos = new Map<string, AST.CProto>();
  units = new Array<Unit>();

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
}
