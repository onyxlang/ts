import * as GenericAST from "../../ast.ts";
import * as AST from "../ast.ts";
import { Scope } from "../dst.ts";
import { LocationRange } from "../../parser.ts";

export default class Comment extends GenericAST.Node implements AST.Node {
  readonly value: string;

  constructor(
    location: LocationRange,
    text: string,
    { value }: { value: string },
  ) {
    super(location, text);
    this.value = value;
  }

  async resolve(_syntax: Scope, _semantic?: any): Promise<any> {
    // A comment can't be currently resolved.
    return await void 0;
  }
}
