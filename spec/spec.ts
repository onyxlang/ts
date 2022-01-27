const compiler_exe = Deno.args[0];
console.debug(`Running compiler specs for ${compiler_exe}`);

Deno.test("hello-world spec", async () => {
  const p = Deno.run({ cmd: [compiler_exe, "r", "spec/hello-world.nx"] });
  if (!(await p.status()).success) Deno.exit(1);
  p.close();
});

Deno.test("basic spec", async () => {
  const p = Deno.run({ cmd: [compiler_exe, "r", "spec/basic.nx"] });
  if (!(await p.status()).success) Deno.exit(1);
  p.close();
});
