// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as pathAPI from "https://deno.land/std@0.126.0/path/mod.ts";

import * as GenericAST from "../../ast.ts";
import * as AST from "../ast.ts";
import * as DST from "../dst.ts";
import * as Lang from "../lang.ts";
import Unit from "../../unit.ts";
import Panic, { AlreadyDeclared } from "../../panic.ts";

/**
 * An import directive with an explicit path to import _from_.
 *
 * # Examples
 *
 * Import default export:
 *
 * ```nx
 * import Foo from "./foo.nx"
 * ```
 *
 * Complex import:
 *
 * ```nx
 * import { Foo, Bar as Baz }, Qux from "./quux.nx"
 * ```
 *
 * Export imported shortcut:
 *
 * ```nx
 * import Foo from "./foo.nx"
 * export Foo
 *
 * # Shortcut as:
 * export Foo from "./foo.nx"
 *
 * # export { Foo, Bar as Baz }, Qux from "./quux.nx"
 * # export default Foo from "./foo.nx"
 * ```
 */
export class Import extends GenericAST.Node
  implements AST.Resolvable<DST.Import>, AST.Node {
  /** `import` or `export` */ readonly keyword:
    | AST.Keyword<Lang.Keyword.IMPORT>
    | AST.Keyword<Lang.Keyword.EXPORT>;
  readonly from: AST.StringLiteral;
  readonly alias: GenericAST.Node; // TODO: Make it `AST.ID`, also in other AST nodes.

  constructor(
    location: peggy.LocationRange,
    text: string,
    { keyword, from, alias }: {
      keyword:
        | AST.Keyword<Lang.Keyword.IMPORT>
        | AST.Keyword<Lang.Keyword.EXPORT>;
      from: AST.StringLiteral;
      alias: AST.ID;
    },
  ) {
    super(location, text);
    this.keyword = keyword;
    this.from = from;
    this.alias = alias;
  }

  async resolve(syntax: DST.Scope, _semantic?: any): Promise<DST.Import> {
    const found = syntax.lookup(this.alias);

    if (found) {
      throw new AlreadyDeclared(
        this.alias,
        // TODO: `instanceof DST.Builtin`.
        found instanceof DST.Void ? undefined : found.idNode(),
      );
    }

    let path: string;

    if (this.from.value.startsWith(".")) {
      // Relative
      path = pathAPI.posix.join(
        pathAPI.dirname(syntax.unit().filePath),
        this.from.value.split(pathAPI.sep).join(pathAPI.posix.sep),
      );
    } else {
      // Absolute
      path = this.from.value.split(pathAPI.sep).join(pathAPI.posix.sep);
    }

    const sourceUnit: Unit = await syntax.unit().program.findOrCompileUnit(
      path,
    );

    if (sourceUnit.defaultExport) {
      syntax.unit().imports.set(this.alias.text, sourceUnit.defaultExport);

      if (this.keyword.kind == Lang.Keyword.EXPORT) {
        // Also add to the unit's exports.
        syntax.unit().exports.set(this.alias.text, sourceUnit.defaultExport);
      }

      return new DST.Import(this, sourceUnit.defaultExport);
    } else {
      throw new Panic(
        `${this.from.value} contains no default export`,
        this.from.location,
      );
    }
  }
}
