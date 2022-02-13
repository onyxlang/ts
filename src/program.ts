import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";
import { digest } from "./util.ts";
import Unit from "./unit.ts";
import * as CDST from "./c/dst.ts";

/**
 * An Onyx program is comprised of multiple compilation units.
 * It also maintains the global C AST.
 */
export default class Program {
  private _units = new Array<Unit>();
  private _entry: Unit;
  private _cacheDir?: string;
  readonly cDST = new CDST.TopLevel();

  entry(): Unit {
    return this._entry;
  }

  static async compile(entryPath: string, cacheDir?: string): Promise<Program> {
    const program = new Program(entryPath, cacheDir);
    await program.entry().parse();
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
