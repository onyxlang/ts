import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

export interface Node {
  lower(output: BufWriter, context: any): Promise<void>;
}
