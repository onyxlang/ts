import * as DST from "../dst.ts";
import * as AST from "../../ast.ts";
import { Node, Resolvable } from "../ast.ts";

export class IntLiteral extends AST.Node
  implements Resolvable<DST.IntLiteral>, Node {
  resolve(_syntaxScope: DST.Scope, _semantic?: any): DST.IntLiteral {
    return new DST.IntLiteral(this, parseInt(this.text));
  }
}
