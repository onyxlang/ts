export enum Keyword {
  CONST = "const",
}

export enum BuiltinType {
  Noreturn = 1,
  Void,
  Int,
  Char,
}

export function parseBuiltinTypeID(id: string): BuiltinType | null {
  switch (id) {
    case "_Noreturn":
      return BuiltinType.Noreturn;
    case "void":
      return BuiltinType.Void;
    case "int":
      return BuiltinType.Int;
    case "char":
      return BuiltinType.Char;
    default:
      return null;
  }
}
