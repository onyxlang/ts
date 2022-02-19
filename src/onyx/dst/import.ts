import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";
import { basename } from "https://deno.land/std@0.126.0/path/mod.ts";

import * as AST from "../ast.ts";
import { Exportable } from "../dst.ts";
import { Lowerable } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";
import { Mappable } from "../dst.ts";

export default class Import implements Mappable<AST.Import>, Lowerable {
  readonly astNode: AST.Import;
  readonly exported: Exportable;

  constructor(astNode: AST.Import, exported: Exportable) {
    this.astNode = astNode;
    this.exported = exported;
  }

  async lower(output: BufWriter, _env: any) {
    if (this.exported.id() == "Bool" || this.exported.id() == "Int32") {
      return; // ADHOC: Skip builtin imports for now.
    }

    await output.write(
      stringToBytes(
        `const ${this.astNode.alias.text} = @import("${
          basename(
            await this.exported
              .unit().cachedPath(),
          )
        }").${this.exported.id()};`,
      ),
    );
  }
}
