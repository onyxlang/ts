// This file is used to compile (i.e. bundle) the onyx compiler binary,
// wrapping the `deno compile` command.
//

import { join } from "https://deno.land/std@0.128.0/path/mod.ts";
import { Embeddable, EMBEDS } from "./src/embeddable.ts";

export default async function build(): Promise<number> {
  const dir = await Deno.makeTempDir();

  const embeddables = new Array<Promise<Embeddable>>();

  for (const onyxPath of Object.keys(EMBEDS)) {
    embeddables.push(
      Embeddable.embed(
        onyxPath,
        join("spec", onyxPath),
        join(dir, onyxPath + ".ts"),
      ),
    );
  }

  const resolved = await Promise.all(embeddables);

  const imports: any = {};
  for (const embeddable of resolved) {
    imports["/" + embeddable.embedPath] = "file://" + embeddable.outputPath;
  }

  console.debug(`Temporary import map: ` + JSON.stringify({ imports }));

  const importMapPath = await Deno.makeTempFile();
  await Deno.writeTextFile(importMapPath, JSON.stringify({ imports }));

  const cmd = [
    "deno",
    "compile",
    "-A",
    "--output",
    "bin/onyx",
    "--import-map",
    importMapPath,
    "src/main.ts",
  ];

  console.debug(cmd.join(" "));
  const process = Deno.run({ cmd });
  return (await process.status()).code;
}

Deno.exit(await build());
