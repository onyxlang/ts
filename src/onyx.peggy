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

start = (comment / extern_drct / safety_stmt / func_builtin_def / if)*

expr = int_literal / ffi_str_lit / call / monuple / tuple

tuple = '(' wsp?
  head:expr
  tail:(wsp? ',' wsp? @expr)*
  wsp? ')'
  {
    return new nx.AST.Tuple([head].concat(tail));
  }

monuple = '(' wsp? body:expr wsp? ')' { return body }

id = $([a-zA-Z_] [a-zA-Z_0-9]* [!?]?) { return new nx.AST.ID(text()) }

int_literal = $('0' / ([1-9] [0-9]*)) { return new nx.AST.IntLiteral(text()) }

// Function
//

var_def = id:id sp ":" sp restriction:id {
  return new nx.AST.VarDef(id, restriction)
}

func_args = '(' wsp?
  head:var_def
  tail:(sp* "," sp* @var_def)*
  wsp? ')'
  {
    return [head].concat(tail);
  }

func_builtin_def = "builtin" sp "def" sp id:id args:func_args sp ":" sp returnType:id term {
  const node = new nx.AST.FuncDef(true, id, args, returnType)

  if (semanticAnalysis)
    unit.addFuncDef(location(), node)

  return node
}

call = c:"$"? callee:id args:tuple {
  if (c) {
    let ref

    if (semanticAnalysis)
      ref = unit.program.ref_ffi_proto(location(), callee.id)
    else
      ref = new nx.AST.FFIProtoRef(callee)

    return new nx.AST.Call(ref, args)
  } else {
    let def

    if (semanticAnalysis)
      def = unit.lookupFuncDef(location(), callee.id)
    else
      def = new nx.AST.FuncRef(callee)

    return new nx.AST.Call(def, args)
  }
}

// Branching
//

block = '{' wsp?
  head:expr
  tail:(term @expr)*
  term?
  wsp? '}'
  {
    return new nx.AST.Block([head].concat(tail));
  }

case = cond:expr wsp? then:block {
  return new nx.AST.Case(cond, then)
}

if = "if" sp? self:case else_body:(wsp? "else" wsp? @block) term {
  return new nx.AST.If(self, [], else_body)
}

// Punctuation
//

EOF = !.
sp = ' '+ { return nx.Punct.SPACE }
nl = sp* ('\n\r' / '\n' / '\r') sp* { return nx.Punct.NEWLINE }
wsp = (nl / sp)+ { return nx.Punct.WHITESPACE }
term = (';' / nl) nl* $EOF? // Onyx terminator
nadj = sp+ / nl+ // Non-adjacent (e.g. `if` body expression may be on a new line)

comment = '#' value:$([^\n\r]+) ('\n\r' / '\n' / '\r' / EOF) {
  return new nx.AST.Comment(value)
}

// Extern
//

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

extern_drct = wsp? $"extern" $nadj stmt:c_proto wsp? {
  return new nx.AST.Extern(stmt)
}

// FFI
//

ffi_str_lit = '$' '"' value:$([^"\\] / "\\" .)* '"' {
  return new nx.AST.FFIStringLiteral(value)
}

// Safety statement
//

safety_kw = "unsafe" / "fragile" / "threadsafe"
safety_stmt = wsp? safety:safety_kw '!' $nadj expr:expr wsp? {
  return new nx.AST.SafetyStatement(safety, new nx.AST.Block([expr]))
}
