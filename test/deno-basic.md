##### `hello.txt`

```
Hello, world.
```

##### `hello.ts`

```js
const text = await Deno.readTextFile()
console.log(text)
```

##### `README.md`

This runs Deno.

````
To run:

```bash
deno run --allow-read=hello.txt hello.ts
```
````
