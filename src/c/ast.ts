// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";
import * as DST from "./dst.ts";
import * as AST from "../ast.ts";
import Panic from "../panic.ts";

interface Resolvable<T> {
  resolve(scope: DST.Scope): T;
}

export class TypeRef extends AST.Node {
}

export class ArgDecl extends AST.Node {
  readonly type: TypeRef;
  readonly id?: AST.Node;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { type, id }: {
      type: TypeRef;
      id?: AST.Node;
    },
  ) {
    super(location, text);
    this.type = type;
    this.id = id;
  }
}

export class Prototype extends AST.Node implements Resolvable<DST.Function> {
  readonly returnType: TypeRef;
  readonly id: AST.Node;
  readonly args: ArgDecl[];

  constructor(
    location: peggy.LocationRange,
    text: string,
    { returnType, id, args }: {
      returnType: AST.Node;
      id: AST.Node;
      args: ArgDecl[];
    },
  ) {
    super(location, text);
    this.returnType = returnType;
    this.id = id;
    this.args = args;
  }

  resolve(scope: DST.Scope): DST.Function {
    const found = scope.lookup(this.id);

    if (found) {
      if (found instanceof DST.Function) {
        // Multiple declarations with same id are legal.
        // TODO: Validate arity.
        return found;
      } else {
        throw new Panic(
          `Already declared \`${this.id.text}\` as not a function`,
          this.id.location,
        );
      }
    } else {
      const returnType = scope.find(this.returnType);

      if (!(returnType instanceof DST.TypeRef)) {
        throw new Panic(
          "C function must return a type",
          this.returnType.location,
        );
      }

      const args = new Array<DST.TypeRef>();
      for (const arg of this.args) {
        const found = scope.find(arg.type);
        if (found instanceof DST.TypeRef) args.push(found);
        else throw new Panic("Can't use function here", arg.type.location);
      }

      const dst = new DST.Function(this, this.id.text, returnType, args);
      scope.store(dst);

      return dst;
    }
  }
}
