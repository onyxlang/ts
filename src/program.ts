import * as CAST from "./c/ast.ts";
import * as CCST from "./c/cst.ts";
import * as CLang from "./c/lang.ts";

import * as OnyxCST from "./onyx/cst.ts";

import Panic, { Note } from "./panic.ts";
import { digest } from "./util.ts";
import Unit from "./unit.ts";
import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";

/**
 * An Onyx program is comprised of multiple compilation units.
 * It also maintains the global C AST.
 */
export default class Program {
  private _units = new Array<Unit>();
  private _entry: Unit;
  private _cacheDir?: string;
  private _cProtos = new Map<string, CAST.Proto>();

  entry(): Unit {
    return this._entry;
  }

  static async compile(entryPath: string, cacheDir?: string): Promise<Program> {
    const program = new Program(entryPath, cacheDir);
    await program.entry().parse();
    program.entry().compile();
    await program.entry().lower();
    return program;
  }

  constructor(entryPath: string, cache_dir?: string) {
    const unit = this.createUnit(entryPath);
    this._entry = unit;
    this._cacheDir = cache_dir;
  }

  /**
   * Create and return a new compilation unit at _path_, linked to the program.
   *
   * @param path Source file path
   * @returns    Newly created unit instance
   */
  createUnit(path: string): Unit {
    const unit = new Unit(this, path);
    this._units.push(unit);
    return unit;
  }

  /**
   * Resolve a C type reference.
   *
   * @param cstNode The source CST node
   *
   * @returns Resolved AST node
   * @throws  Panic otherwise
   */
  resolveCTypeRef(cstNode: CCST.TypeRef): CAST.BuiltinType {
    const builtin = CLang.parseBuiltinTypeID(cstNode.id.raw);

    if (builtin) {
      return new CAST.BuiltinType(cstNode, builtin, cstNode.pointerDepth);
    } else {
      throw new Panic(`Undeclared \`${cstNode.id.raw}\``, cstNode.id.loc());
    }
  }

  /**
   * Ensure that a C _id_ is not taken.
   * For example, `char` is a builtin type ID and thus can't be used.
   *
   * @param id The checked identifier CST node
   *
   * @returns If it can be used
   * @throws  Panic otherwise
   */
  ensureCIDFree(id: CCST.ID): void {
    const builtin = CLang.parseBuiltinTypeID(id.raw);

    if (builtin) {
      throw new Panic(`Can't use builtin id \`${id.raw}\``, id.loc());
    }

    const cProto = this._cProtos.get(id.raw);

    if (cProto) {
      throw new Panic(`Already declared id \`${id.raw}\``, id.loc(), [
        new Note("Previously declared here", cProto.cstNode.id.loc()),
      ]);
    }

    // TODO: Check user-defined types.

    return; // OK, it's free
  }

  /**
   * Compile a C function prototype CST node.
   *
   * @param   cstNode
   * @returns Compiled AST node
   * @throws  Panic if something goes wrong
   */
  compileCProto(cstNode: CCST.Proto): CAST.Proto {
    const proto = CAST.Proto.compile(this, cstNode);
    this._cProtos.set(cstNode.id.raw, proto);
    return proto;
  }

  /**
   * Find a C prototype in the program.
   *
   * @param   id
   * @returns Found prototype AST node
   * @throws  Panic if not found
   */
  findCProto(id: OnyxCST.ID): CAST.Proto {
    const found = this._cProtos.get(id.value);

    if (found) {
      return found;
    } else {
      throw new Panic(`Undeclared C function \`${id.value}\``, id.loc());
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
    if (!this._cacheDir) throw Error("Cache dir is not set for program");

    const resolved = pathAPI.resolve(path);
    const hash = await digest("sha-1", resolved);

    if (ext) return pathAPI.join(this._cacheDir, hash + ext!);
    else return pathAPI.join(this._cacheDir, hash);
  }
}
