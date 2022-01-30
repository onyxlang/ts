import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";
import Program from "../program.ts";
import Panic from "../panic.ts";

/**
 * Build and run an Onyx program.
 *
 * @param input_path Input file path
 * @param zig_path   Zig compiler executable path
 * @param cache_dir  Cache directory
 *
 * @return True if succeeded
 */
export default async function run(
  input_path: string,
  zig_path: string,
  cache_dir: string,
): Promise<boolean> {
  try {
    const program = await Program.compile(input_path, cache_dir);

    const cmd = [
      zig_path,
      "run",
      program.entry().loweredModulePath(),
      "-lc",
      "--cache-dir",
      pathAPI.join(cache_dir, "zig"),
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
