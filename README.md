# Onyx

_Enjoy the performance._

## 👋 About

Onyx is a fresh programming language with efficiency in mind.
This repository contains the reference Onyx compiler implementation.

<details>
  <summary>Brief history</summary>
  <br />
  Ever had that feeling of creating a game, but then remembering how painful it is to write in C++?
  Any other language doesn't seem just the right tool?
  Want something new?
  <br /><br />
  The first idea of Onyx came to me in 2020, at the very peak of my Open Source career.
  Coming all the way from Warcraft® III™ map editor to Crystal, I am still struggling to find the most comfortable language for daily use.
  <br /><br />
  What I want is a language which I would consider perfect.
  A language with a perfectly built ecosystem and organization.
  A language with infinite possibilities.
</details>

## ✨ Features

Formally speaking, Onyx is an inference-typed imperative multiparadigmal computer programming language.

Onyx is inspired by [Typescript](https://www.typescriptlang.org/), therefore comparing it would be enough for a brief introduction.

First of all, Onyx is designed to be compiled to native machine code, still allowed to be evaluated dynamically.
A Typescript bytecode compiler is hard to implement due to its dependence on EcmaScript, at least for version 4.5.4.

Native compilation paves a way to directly interact with a lower-level language in form of [FFI](https://en.wikipedia.org/wiki/Foreign_function_interface).
This immediately makes Onyx a higher-level language, the concept of which is defined in the form of multiple safety levels: `unsafe`, `fragile`, `threadsafe`.

```nx
extern #include "stdio.h"
unsafe! $puts($"Hello, world!") # The string has inferred type `` $`const char`* ``,
                                # mapped to the C `const char*` type
```

The code snippet above would be an error without `unsafe!` because the top-level scope has `fragile` safety by default (can be changed per compilation).

Another powerful feature of Onyx is macros, which are evaluated during compilation.
The ultimate goal is to write macros in the Onyx language itself.

```nx
%{
  # You're inside an Onyx macro.
  #

  console.log("Debug = #{ $DEBUG }") # Would output the C macro during compilation

  [("roses", "blue"), ("violets", "red")].map((pair) => {
    emit("unsafe! $puts($\"#{ pair[0] } are #{ pair[1] })\"")
  })
%}

# Would be compiled exactly as:
#

unsafe! $puts($"Roses are blue")
unsafe! $puts($"Violets are red")
```

Onyx encourages the use of exact typing when you need to, e.g. `Real` over `Float` over `Float<64>`.
The type system covers, among others, tensor and hypercomplex number literals and operations.

Generally, Onyx doesn't look at EcmaScript in terms of standard types.
`[1, 2] : Int32[2] : Array<Int32, 2>` is, for example, a static array of fixed size, not a dynamic list.

The `struct` type in Onyx resembles a pure passed-by-value data structure.
A `class` type data is an automatically-managed reference to a non-static memory, similar to such in Typescript.

There is no `interface` type in Onyx, but `trait`, which allows exclusively function declarations _and_ definitions.

Unlike Typescript, there are no `async` and `await` keywords on the language level.
Instead, _any_ function may be called asynchronously with a scheduler of your choice (or the standard one).

The will to make Onyx a compile-able language imposes some restrictions, of course, compared to Typescript.
For example, a lambda has explicit closure.

```nx
import Scheduler from "std/scheduler.nx"
import { Mutex } from "std/threading.nx"

final list = new List<Int32>()
final mutex = new Mutex()

final promise = Scheduler.parallel([list]() ~> {
  # The context here is implicitly `threadsafe`.
  #

  # list.push(42) # => Panic! Can't call `fragile List<Int32>::push`
                  # from within a threadsafe context!

  mutex.sync(() => list.push(42)) # OK, the access is synchronized,
                                  # `Mutex::sync` call is threadsafe
})
```

These are just a few of the differences when compared to Typescript.
Further documentation to come!

## 🚧 Development

A _stage_ is defined by the a set of rules in no particular order.
Currently, the compiler is at the **stage I** implementation effort.

### Stage I: ⬅️

1. Compiler logic (i.e. _frontend_) is written in [Typescript](https://www.typescriptlang.org), utilizing [Peggyjs](https://github.com/onyxlang/peggy).
1. [Zig](https://github.com/ziglang/zig) is used as the _backend_: Onyx source code is translated to Zig source code.
1. Host machine is expected to have Zig installed on it.
1. [Deno](https://deno.land) is assumed the development environment.
1. Development speed > runtime performance > correctness.
    1. Macros are not implemented.
    1. Panics are shallow and incomplete.
1. May assume that target is a mainstream Windows, Linux or MacOS machine.
1. Target may rely on Zig standard library.

### Stage II:

1. Compiler logic (i.e. _frontend_) is written in Onyx.
1. [Zig](https://github.com/ziglang/zig) is used as the _backend_: Onyx source code is translated to Zig source code.
1. Host machine is expected to have Zig installed on it.
1. Development speed > correctness > runtime performance.
    1. Macros are not implemented.
1. May assume that target is a mainstream Windows, Linux or MacOS machine.
1. Target may rely on Zig standard library.

### Stage III:

1. Compiler logic (i.e. _frontend_) is written in Onyx.
1. [Zig](https://github.com/ziglang/zig) is used as the _backend_: Onyx source code is translated to Zig source code internally.
1. _(Extraneous)_ Host machine is expected to have Zig installed on it.[^1]
1. Correctness > development speed > runtime performance.
1. Target may rely on Zig standard library.

[^1]: By that time Zig could become linkable as a static library.

### Stage IV:

1. Compiler is written in Onyx.
1. Correctness > (developer happiness = runtime performance).

## 📜 License

Any contribution to this repository is MIT licensed in accordance to [GitHub ToS § 6](https://docs.github.com/en/github/site-policy/github-terms-of-service#6-contributions-under-repository-license).
