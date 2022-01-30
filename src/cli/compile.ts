import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";
import Program from "../program.ts";
import Panic from "../panic.ts";

/**
 * Compile an Onyx program.
 *
 * @param input_path  Input source file path
 * @param output_path Output executable path
 * @param zig_path    Zig compiler executable path
 * @param cache_dir   Cache directory
 *
 * @return True if succeeded
 */
export default async function compile(
  input_path: string,
  output_path: string,
  zig_path: string,
  cache_dir: string,
): Promise<boolean> {
  try {
    const program = await Program.compile(input_path, cache_dir);

    const cmd = [
      zig_path,
      "build-exe",
      program.entry().loweredModulePath(),
      "-lc",
      "--cache-dir",
      pathAPI.join(cache_dir, "zig"),
      "-femit-bin=" + output_path,
    ];

    console.debug(cmd.join(" "));
    const process = Deno.run({ cmd });

    return (await process.status()).success;
  } catch (e) {
    if (e instanceof Panic) {
      await e.log({ backtrace: true });
      return false;
    } else throw e;
  }
}
