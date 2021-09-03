# md_unpack_simple

[![pipeline status](https://gitlab.com/ResourcesCo/macchiato/md_unpack_simple/badges/main/pipeline.svg)](https://gitlab.com/ResourcesCo/macchiato/md_unpack_simple/-/commits/main)

Unpack a Markdown document into multiple files

To run, pass a Markdown file to standard input, and give permission to write
to the current directory:

```bash
cat source.md | deno run --allow-read=. --allow-write=. --unstable https://deno.land/x/md_unpack_simple/mod.ts
```

This will take embedded files in the source Markdown document and write them
to their path within the current directory. If directories are missing, they
will be created.

It only requires permissions to read and write to the current directory, as
well as the `--unstable` flag. The read permission is required for checking
if the directory already exists before creating it.

The embedded files can be defined with a level 5 header with an inline code
block, like this:

````md
##### `js/file1.js`

```js
console.log('Hello, world.')
```

##### `css/file2.css`

```css
body { background-color: yellow; }
```
````
