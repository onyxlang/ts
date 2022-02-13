import yargs from "https://deno.land/x/yargs/deno.ts";
import { Arguments } from "https://deno.land/x/yargs/deno-types.ts";
import * as pathAPI from "https://deno.land/std@0.122.0/path/mod.ts";
import compile from "./cli/compile.ts";
import run from "./cli/run.ts";
import { replaceExt } from "./util.ts";

export default function (name: string, args: any) {
  return yargs(args)
    .scriptName(null)
    .usage(`usage: ${name} <command> [options]`)
    .command(
      ["run <file>", "r <file>"],
      "Compile and run program (default)",
      (yargs: any) => {
        return yargs.positional("file", {
          describe: "an Onyx source file",
        });
      },
      async (argv: Arguments) => {
        console.debug(argv);

        const result = await run(
          pathAPI.resolve(argv.file),
          argv.zig,
          pathAPI.resolve(argv["cache-dir"]),
        );

        Deno.exit(result ? 0 : 1);
      },
    )
    .command(
      ["compile <file>", "c <file>"],
      "Compile program",
      (yargs: any) => {
        return yargs.positional("file", {
          describe: "an Onyx source file",
        });
      },
      async (argv: Arguments) => {
        console.debug(argv);

        const input = argv.file;
        let output: string;

        if (argv.output) output = argv.output;
        else output = replaceExt(input, ".exe");

        const result = await compile(
          pathAPI.resolve(input),
          pathAPI.resolve(output),
          argv.zig,
          pathAPI.resolve(argv["cache-dir"]),
        );

        Deno.exit(result ? 0 : 1);
      },
    )
    .option("zig", {
      describe: "Zig executable path",
      type: "string",
      default: "zig",
    })
    .option("cache-dir", {
      describe: "Cache directory",
      type: "string",
      default: pathAPI.join(".cache", "onyx"),
    })
    .demandCommand(1, "")
    .strict()
    .version(false)
    .alias("help", "h")
    .fail((_msg: any, err: string | Error, _yargs: any) => {
      // If there are no args passed, show the help screen and exit.
      if (Deno.args.length == 0) {
        _yargs.showHelp();
        Deno.exit(0);
      }

      // Othwerise, show error.
      console.error(err);
      Deno.exit(1);
    });
}
