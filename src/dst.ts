import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";
import * as AST from "./ast.ts";

export interface Lowerable {
  lower(output: BufWriter, env: any): Promise<void>;
}

export interface Type {
  lower(output: BufWriter, env: any): Promise<void>;
  name(): string;
}

export interface Identifiable {
  idNode(): AST.Node;
}
