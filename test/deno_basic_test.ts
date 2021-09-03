import { assertEquals } from "https://deno.land/std@0.102.0/testing/asserts.ts";
import { unpack } from "../mod.ts";

Deno.test("read example", async () => {
  const text = await Deno.readTextFile('./test/deno-basic.md');
  const files = await unpack(text);
  assertEquals(Object.keys(files || {}).length, 3);
  assertEquals((files || {})['hello.txt'], `Hello, world.\n`);
});
