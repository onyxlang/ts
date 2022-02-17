// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "../dst.ts";
import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import Panic from "../../panic.ts";
import { ensureRVal, Node, Resolvable, RVal } from "../ast.ts";

// An identifier, like `foo`.
export class ID extends AST.Node implements Resolvable<DST.Ref>, Node {
  resolve(
    syntax: DST.Scope,
    _semantic?: any,
  ): DST.Ref {
    return new DST.Ref(this, syntax.find(this));
  }
}

export class CID extends AST.Node implements Resolvable<DST.Ref> {
  readonly value: AST.Node;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { value }: { value: AST.Node },
  ) {
    super(location, text);
    this.value = value;
  }

  resolve(
    syntax: DST.Scope,
    _semantic?: any,
  ): DST.Ref {
    return new DST.Ref(this, syntax.unit().program.cDST.find(this.value));
  }
}

export class Query extends AST.Node implements Resolvable<DST.Ref>, Node {
  readonly container?: RVal;
  readonly access?: Lang.Access;
  readonly id: ID;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { container, access, id }: {
      container?: RVal;
      access?: Lang.Access;
      id: ID;
    },
  ) {
    super(location, text);
    this.container = container;
    this.access = access;
    this.id = id;
  }

  resolve(
    syntax: DST.Scope,
    _semantic?: any,
  ): DST.Ref {
    if (this.container) {
      const container = ensureRVal(
        this.container.resolve(syntax),
        this.container.location,
      );

      const containerType = container.inferType(syntax);

      if (containerType instanceof DST.StructDef) {
        return this.id.resolve(containerType);
      } else {
        throw new Panic(
          `Can not query type \`${containerType.name()}\``,
          this.container.location,
        );
      }
    } else {
      return this.id.resolve(syntax);
    }
  }
}
