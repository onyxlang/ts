import { dirname } from "https://deno.land/std@0.128.0/path/mod.ts";

import Builtin from "/builtin.nx";
import BuiltinBool from "/builtin/bool.nx";
import BuiltinInt from "/builtin/int.nx";

/**
 * _Onyx path_ => _Source code_.
 */
export const EMBEDS = {
  "builtin.nx": Builtin,
  "builtin/bool.nx": BuiltinBool,
  "builtin/int.nx": BuiltinInt,
};

/**
 * An embeddable piece of code is shipped along with the compiler binary.
 */
export class Embeddable {
  /** E.g. `"builtin.nx"`. */ readonly embedPath: string;
  /** E.g. `"./spec/builtin.nx"`. */ readonly sourcePath: string;
  /** E.g. `"/tmp/builtin.nx"`. */ readonly outputPath: string;
  readonly sourceCode: string;

  /**
   * @param embedPath  E.g. `"builtin.nx"`
   * @param sourcePath E.g. `"./spec/builtin.nx"`
   * @param outputPath E.g. `"/tmp/builtin.nx"`
   */
  static async embed(
    embedPath: string,
    sourcePath: string,
    outputPath: string,
  ): Promise<Embeddable> {
    const source = await Deno.readFile(sourcePath);

    let text = "export default new TextDecoder().decode(new Uint8Array([";
    text += source.join(", ");
    text += "]));";

    await Deno.mkdir(dirname(outputPath), { recursive: true });
    await Deno.writeTextFile(outputPath, text);

    return new Embeddable(
      embedPath,
      sourcePath,
      outputPath,
      new TextDecoder().decode(source),
    );
  }

  private constructor(
    embedPath: string,
    sourcePath: string,
    outputPath: string,
    sourceCode: string,
  ) {
    this.embedPath = embedPath;
    this.sourcePath = sourcePath;
    this.outputPath = outputPath;
    this.sourceCode = sourceCode;
  }
}
