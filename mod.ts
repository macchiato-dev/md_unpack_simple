import {
  readLines,
  BufWriter,
  Buffer,
  StringReader
} from "https://deno.land/std@0.102.0/io/mod.ts";
import { ensureDir } from "https://deno.land/std@0.102.0/fs/mod.ts";
import { normalize, dirname } from "https://deno.land/std@0.102.0/path/mod.ts";
import {
  decode as base64Decode
} from "https://deno.land/std@0.102.0/encoding/base64.ts";
import {
  decode as base64urlDecode
} from "https://deno.land/std@0.102.0/encoding/base64url.ts";
import {
  decode as hexDecodeBytes
} from "https://deno.land/std@0.102.0/encoding/hex.ts";
const fileDataRegexp = /^#####\s+\`/;
const codeFenceRegexp = /^(`{3,})[^`]*$/;
const backquotesRegexp = /(?<!\\)`+/;

function hexDecode(s: string): Uint8Array {
  return hexDecodeBytes(new TextEncoder().encode(s.trim()));
}

export function nextInlineString(s: string): [string | null, string] {
  const match = backquotesRegexp.exec(s);
  if (match) {
    const startIndex = match.index + match[0].length;
    const length = s.substr(startIndex).indexOf(match[0]);
    if (length !== -1) {
      const data = s.substr(startIndex, length);
      const rest = s.substr(startIndex + length + match[0].length);
      return [data, rest];
    } else {
      return [null, ''];
    }
  } else {
    return [null, ''];
  }
}

export function readInlineStrings(line: string): string[] {
  const result = [];
  let rest = line;
  while (rest.length > 0) {
    const [data, newRest] = nextInlineString(rest);
    rest = newRest;
    if (data !== null) {
      result.push(data);
    } else {
      return result;
    }
  }
  return result;
}

type ToBinaryFunction = (text: string) => Uint8Array

type ToBinaryMap = {
  [key: string]: ToBinaryFunction
}

type FilePack = { [path: string]: string | Uint8Array }

interface UnpackOptions {
  stream: boolean
  eol: 'lf' | 'crlf'
  newline: boolean
}

export async function unpack(text: string | undefined = undefined, {
  stream = false,
  eol = 'lf',
  newline = true,
}: Partial<UnpackOptions> = {}): Promise<FilePack | undefined> {
  const input = text === undefined ? Deno.stdin : new StringReader(text);
  const open = Deno.open;
  const result: FilePack = {};
  let file = undefined;
  let fence = undefined;
  let gap = 0;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const toBinary: ToBinaryMap = {
    utf8: line => encoder.encode(line),
    base64: line => base64Decode(line.trim()),
    base64url: line => base64urlDecode(line.trim()),
    hex: line => hexDecode(line.trim()),
  }
  for await (const line of readLines(input)) {
    if (fence) {
      const match = codeFenceRegexp.exec(line);
      if (match && match[1] === fence) {
        if (file) {
          let options;
          if (!file.writing && !file.readOptions) {
            let parsedOptions;
            try {
              parsedOptions = JSON.parse(file.data);
            } catch (_err) {
              // do nothing
            }
            if (Array.isArray(parsedOptions) && parsedOptions[0] === '$options') {
              options = parsedOptions[1];
              if (parsedOptions.length !== 2 || options === null || typeof options !== 'object') {
                throw new Error(`Invalid options for ${JSON.stringify(file.path)}`);
              }
            }
          }
          if (options) {
            if (typeof options.encoding === 'string' && options.encoding in toBinary) {
              file.options.encoding = options.encoding;
              file.toBinary = toBinary[file.options.encoding];
            }
            if (typeof options.newline === 'boolean') {
              file.options.newline = options.newline;
            }
            if (options.eol === 'crlf') {
              file.options.eol = '\r\n';
            } else {
              file.options.eol = '\n';
            }
            file.data = '';
            file.preLine = '';
            file.readOptions = true;
          } else {
            if (!file.writing) {
              await file.writer.write(file.toBinary(file.data));
              file.data = '';
              file.writing = true;
            }
            if (file.options.newline) {
              file.writer.write(file.toBinary(file.options.eol));
            }
            if (file.file && file.bufWriter) {
              await file.bufWriter.flush();
              await file.file.close();
            } else if (file.buffer) {
              const bufLength = file.buffer.length;
              const arr = new Uint8Array(file.buffer.length);
              const bytes = await file.buffer.read(arr);
              if (bytes !== bufLength) {
                throw new Error(`Error getting file contents from buffer: got ${bytes}, expected ${bufLength}`);
              }
              if (file.options.encoding === 'utf8') {
                result[file.path] = decoder.decode(arr);
              } else {
                result[file.path] = arr;
              }
            } else {
              throw new Error('No buffer and no file');
            }
            file = undefined;
          }
        }
        fence = undefined;
      } else if (file?.writing) {
        await file.writer.write(file.toBinary(file.preLine + line));
      } else if (file) {
        file.data += file.preLine + line;
        if (file.readOptions || file.data.length >= 1024) {
          await file.writer.write(file.toBinary(file.data));
          file.writing = true;
          file.data = '';
        }
        file.preLine = file.options.eol;
      }
    } else {
      if (fileDataRegexp.test(line)) {
        const inlineStrings = readInlineStrings(line);
        if (inlineStrings.length >= 1) {
          if (file && gap >= 1024) {
            throw new Error(`No file content found for ${JSON.stringify(file.path)}`);
          }
          gap = 0;
          const path = normalize(inlineStrings[0]);
          if (path.startsWith('..') || path.startsWith('/')) {
            throw new Error(`Path ${JSON.stringify(path)} is not inside directory`);
          }
          let openFile
          let writer
          let bufWriter
          let buffer
          if (stream) {
            await ensureDir(dirname(path));
            openFile = await open(path, {write: true, create: true});
            bufWriter = BufWriter.create(openFile);
            writer = bufWriter;
          } else {
            buffer = new Buffer();
            writer = buffer;
          }
          file = {
            preLine: '',
            data: '',
            path,
            options: {
              eol: eol === 'crlf' ? '\r\n' : '\n',
              encoding: 'utf8',
              newline,
            },
            toBinary: toBinary.utf8,
            file: openFile,
            buffer,
            bufWriter,
            writer,
            readOptions: false,
            writing: false,
          };
        }
      }
      const match = codeFenceRegexp.exec(line);
      if (match) {
        fence = match[1];
        if (file && gap >= 1024) {
          throw new Error(`No file content found for ${JSON.stringify(file.path)}`);
        }
      } else if (file) {
        gap += line.length + 1;
      }
    }
  }
  if (file && gap >= 1024) {
    throw new Error(`No file content found for ${JSON.stringify(file.path)}`);
  }
  if (!stream) {
    return result;
  }
}

export async function write(files: FilePack) {
  for (const path of Object.keys(files)) {
    const data = files[path];
    await ensureDir(dirname(path));
    if (typeof data === 'string') {
      await Deno.writeTextFile(path, data);
    } else {
      await Deno.writeFile(path, data);
    }
  }
}

export async function run() {
  const files = await unpack();
  if (files) {
    await write(files);
  } else {
    throw new Error('No files returned');
  }
}

if (import.meta.main) {
  run();
}
