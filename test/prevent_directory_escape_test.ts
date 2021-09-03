import { assertThrowsAsync } from "https://deno.land/std@0.102.0/testing/asserts.ts";
import { unpack } from "../mod.ts";

Deno.test("prevent directory escape", async () => {
  const text = await Deno.readTextFile('./test/directory-escape.md');
  await assertThrowsAsync(async () => {
    await unpack(text);
  });
});
