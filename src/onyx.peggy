// Global initializer.
{{
  // The global Onyx context.
  const nx = options.nx
}}

// Per-parse initializer.
{
  const unit = options.unit
  const semanticAnalysis = options.semanticAnalysis

  if (semanticAnalysis)
    console.log(`Compiling ${unit.path}`)
  else
    console.log(`Parsing ${unit.path}`)
}

start = (extern_drct / safety_stmt)*

EOF = !.
sp = ' '+ { return nx.Punct.SPACE }
nl = sp* ('\n\r' / '\n' / '\r') sp* { return nx.Punct.NEWLINE }
wsp = nl+ { return nx.Punct.WHITESPACE }
term = nl+ / ';' / $EOF // Onyx terminator
nadj = sp+ / nl+ // Non-adjacent (e.g. `if` body expression may be on a new line)

// Extern directive
//

extern_drct = wsp? $"extern" $nadj stmt:c_proto wsp? {
  return new nx.AST.Extern(stmt)
}

c_term = ';'
c_proto_arg = const_mod:$("const" sp)? type:c_type id:($sp+ @$c_id)? {
  return new nx.AST.CProtoArg(!!const_mod, type, id)
}

c_proto_args = '('
  head:c_proto_arg
  tail:($sp* "," $sp* @c_proto_arg)*
  ')'
  {
    return [head].concat(tail);
  }

c_proto = return_type:c_type $sp+ id:c_id args:c_proto_args $c_term {
  const proto = new nx.AST.CProto(id, args, return_type)

  if (semanticAnalysis)
    unit.program.add_ffi_proto(proto)

  return proto
}

c_id = $([a-zA-Z_] [a-zA-Z_0-9]*)
c_type = id:c_id depth:'*'* {
  return new nx.AST.CType(id, depth.length)
}

// Safety statement
//

safety_kw = "unsafe" / "fragile" / "threadsafe"
safety_stmt = wsp? safety:safety_kw '!' $nadj expr:expr wsp? {
  return new nx.AST.SafetyStatement(safety, [expr])
}

ffi_call = $'$' id:c_id args:tuple {
  let ref

  if (semanticAnalysis)
    ref = unit.program.ref_ffi_proto(location(), id)
  else
    ref = new nx.AST.FFIProtoRef(id)

  return new nx.AST.FFICall(ref, args)
}

expr = ffi_call
rval = expr / ffi_str_lit

tuple = '('
  head:rval
  tail:($sp* ',' $sp* @rval)*
  ')'
  {
    return [head].concat(tail);
  }

ffi_str_lit = '$' '"' value:$([^"\\] / "\\" .)* '"' {
  return new nx.AST.FFIStringLiteral(value)
}
