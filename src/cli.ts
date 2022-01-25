import yargs from "https://deno.land/x/yargs/deno.ts";
import { Arguments } from "https://deno.land/x/yargs/deno-types.ts";
import { run, build, parse } from "./compiler.ts";
import { replaceExt } from "./util.ts";

export default function (args: any) {
  return yargs(args)
    .command(
      ["run <file>", "r <file>"],
      "Compile and run a source file.",
      (yargs: any) => {
        return yargs.positional("file", {
          describe: "an Onyx source file",
        });
      },
      async (argv: Arguments) => {
        console.debug(argv);
        await run(argv.file, argv.zig);
      }
    )

    .command(
      ["compile <file>", "c <file>"],
      "Compile a source file.",
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

        await build(input, output, argv.zig);
      }
    )

    .command(
      ["parse <file>", "p <file>"],
      "Parse a source file.",
      (yargs: any) => {
        return yargs
          .positional("file", {
            describe: "an Onyx source file",
          })
          .option("output", {
            alias: "o",
            describe: "output file; if not set, would output to stdout",
            type: "string",
          });
      },
      async (argv: Arguments) => {
        console.debug(argv);
        await parse(argv.file, argv.output);
      }
    )

    .option("zig", {
      describe: "Zig compiler executable path",
      type: "string",
      default: "zig",
    })

    .demandCommand(1, "")
    .strict()
    .version(false)
    .alias("help", "h")

    .fail((msg: any, err: string | Error, _yargs: any) => {
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
