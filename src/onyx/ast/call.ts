// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "../dst.ts";
import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import * as CDST from "../../c/dst.ts";
import * as GenericDST from "../../dst.ts";
import Panic, { Note } from "../../panic.ts";
import { ensureRVal, Node, Resolvable, RVal } from "../ast.ts";

import { CID, ID, Query } from "./id.ts";

export class UnOp extends AST.Node implements Resolvable<DST.Call>, Node {
  /** E.g. `!`. */ readonly operator: ID;
  readonly operand: RVal;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { operator, operand }: {
      operator: ID;
      operand: RVal;
    },
  ) {
    super(location, text);
    this.operator = operator;
    this.operand = operand;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Call {
    return Call.resolveGeneric(this, syntax, this.operand, this.operator, [
      this.operand,
    ]);
  }
}

/**
 * ```nx
 * fib(n - 1) + fib(n - 2)
 * ```
 */
export class BinOp extends AST.Node implements Resolvable<DST.Call>, Node {
  readonly left: RVal;
  /** E.g. `+=` */ readonly operator: ID;
  readonly right: RVal;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { left, operator, right }: {
      left: RVal;
      operator: ID;
      right: RVal;
    },
  ) {
    super(location, text);
    this.left = left;
    this.operator = operator;
    this.right = right;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Call {
    return Call.resolveGeneric(this, syntax, this.left, this.operator, [
      this.left,
      this.right,
    ]);
  }
}

/**
 * ```nx
 * Int32::eq?(result, 55)
 * ```
 */
export default class Call extends AST.Node
  implements Resolvable<DST.Call>, Node {
  readonly callee: CID | ID | Query;
  readonly args: RVal[];

  constructor(
    location: peggy.LocationRange,
    text: string,
    { callee, args }: {
      callee: CID | ID | Query;
      args: RVal[];
    },
  ) {
    super(location, text);
    this.callee = callee;
    this.args = args;
  }

  static resolveGeneric(
    astNode: UnOp | BinOp | Call,
    syntaxScope: DST.Scope,
    callerNode: RVal | undefined, // `n` in `n < 1`
    calleeNode: CID | ID | Query, // `$puts()` | `foo()` | `foo.bar()` | `n < 1`
    argNodes: RVal[],
  ): DST.Call {
    const args = new Array<DST.RuntimeValue>();

    // For `foo.bar()` call, implicitly pass `foo` as the first argument.
    if (
      calleeNode instanceof Query && calleeNode.access == Lang.Access.INSTANCE
    ) {
      args.push(
        ensureRVal(
          calleeNode.container!.resolve(syntaxScope),
          calleeNode.container!.location,
        ),
      );
    }

    for (const arg of argNodes) {
      args.push(ensureRVal(arg.resolve(syntaxScope), arg.location));
    }

    const argTypes = new Array<GenericDST.Type>();

    for (const arg of args) {
      argTypes.push(arg.inferType(syntaxScope));
    }

    let resolveScope = syntaxScope;

    if (callerNode) {
      const caller = ensureRVal(
        callerNode.resolve(syntaxScope),
        callerNode.location,
      );

      const callerType = caller.inferType(syntaxScope);

      if (!(callerType instanceof DST.StructDef)) {
        throw new Panic(
          `Can't have a non-struct value as a caller ` +
            `(\`${callerType.name()}\` inferred)`,
          callerNode.location,
        );
      }

      resolveScope = callerType;
    }

    const callee = calleeNode.resolve(resolveScope);

    if (
      !(callee.target instanceof DST.FunctionDef ||
        callee.target instanceof CDST.Function)
    ) {
      throw new Panic(`\`${calleeNode.text}\` is not a function`);
    }

    // If callee is Onyx function, get its arguments as an array
    // (map insertion ordering consistency is standardized).
    const calleeArgs = callee.target.args instanceof Map
      ? [...callee.target.args.values()]
      : callee.target.args;

    for (let i = 0; i < args.length; i++) {
      const calleeArg = calleeArgs[i];

      if (!calleeArg) {
        throw new Panic("Argument arity mismatch", argNodes[i].location, [
          new Note("Attempted to match this", callee.idNode().location),
        ]);
      }

      if (
        DST.compareTypes(
          calleeArg instanceof DST.VariableDef
            ? calleeArg.inferType(syntaxScope)
            : calleeArg,
          argTypes[i],
        )
      ) {
        throw new Panic("Argument of invalid type", argNodes[i].location, [
          new Note("Declared here", calleeArg.astNode.location),
        ]);
      }
    }

    return new DST.Call(astNode, callee, args);
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Call {
    return Call.resolveGeneric(
      this,
      syntax,
      undefined,
      this.callee,
      this.args,
    );
  }
}
