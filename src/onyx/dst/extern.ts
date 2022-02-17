import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as OnyxAST from "./../ast.ts";
import * as CDST from "../../c/dst.ts";
import { Lowerable } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";

import { Mappable } from "../dst.ts";

export default class Extern implements Lowerable, Mappable<OnyxAST.Extern> {
  readonly astNode: OnyxAST.Extern;
  readonly proto: CDST.Function;

  constructor(astNode: OnyxAST.Extern, proto: CDST.Function) {
    this.astNode = astNode;
    this.proto = proto;
  }

  async lower(output: BufWriter, _env: any) {
    await this.proto.lower(output);
    await output.write(stringToBytes("\n"));
  }
}
