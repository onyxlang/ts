import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";
import { digest } from "./util.ts";
import Unit from "./unit.ts";
import * as CDST from "./c/dst.ts";
import { EMBEDS } from "./embeddable.ts";

/**
 * An Onyx program is comprised of multiple compilation units.
 * It also maintains the global C AST.
 */
export default class Program {
  private _units = new Map<string, Unit>();
  private _builtin?: Unit;
  private _embeds = new Map<string, Unit>();
  private _entry: Unit;
  private _cacheDir?: string;
  readonly cDST = new CDST.TopLevel();

  async builtin(): Promise<Unit> {
    if (this._builtin) {
      return this._builtin;
    } else {
      this._builtin = new Unit(
        this,
        "builtin.nx",
        EMBEDS["builtin.nx"],
        true,
      );

      this._embeds.set("builtin.nx", this._builtin);
      await this._builtin.compile();

      return this._builtin;
    }
  }

  entry(): Unit {
    return this._entry;
  }

  static async compile(entryPath: string, cacheDir?: string): Promise<Program> {
    const program = new Program(entryPath, cacheDir);

    await program._entry.parse();
    await program._entry.compile();

    for (const [_, unit] of program._units) {
      await unit.lower();
    }

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
   * @param {string} path Source file path
   * @returns Newly created unit instance
   * @throws {Error} If already has unit at this path
   */
  createUnit(path: string): Unit {
    path = path.split(pathAPI.sep).join(pathAPI.posix.sep);

    if (this._units.get(path)) {
      throw new Error(`Already created unit at ${path}`);
    }

    const unit = new Unit(this, path);
    this._units.set(path, unit);

    return unit;
  }

  /**
   * Find an already compiled unit at _path_.
   * If it's not there yet, would compile.
   */
  async findOrCompileUnit(path: string): Promise<Unit> {
    const found = this._units.get(path);

    if (found) {
      if (!found.compiled()) await found.compile();
      return found;
    } else {
      for (const [onyxPath, source] of Object.entries(EMBEDS)) {
        if (onyxPath == path) {
          console.debug(`Detected embed "${path}"`);

          if (this._embeds.has(onyxPath)) {
            return this._embeds.get(onyxPath)!;
          } else {
            const unit = new Unit(
              this,
              onyxPath,
              source,
              !!path.match(/^builtin(\/.+)?\.nx$/),
            );

            this._embeds.set(onyxPath, unit);

            await unit.compile();
            return unit;
          }
        }
      }

      // Not embedded otherwise.
      //

      const unit = this.createUnit(path);
      await unit.compile();
      return unit;
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
    path = path.split(pathAPI.sep).join(pathAPI.posix.sep);
    if (!this._cacheDir) throw Error("Cache dir is not set for program");

    const resolved = pathAPI.posix.resolve(path);
    const hash = await digest("sha-1", resolved);

    if (ext) return pathAPI.posix.join(this._cacheDir, hash + ext!);
    else return pathAPI.posix.join(this._cacheDir, hash);
  }
}
