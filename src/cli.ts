#!/usr/bin/env node
/**
 * videokit CLI.
 *
 *   videokit mcp
 *   videokit probe <file>
 *   videokit thumbnail <file> <output> [timestamp-seconds]
 *   videokit audio <file> <output>
 *   videokit trim <file> <output> <start-seconds> [duration-seconds]
 *   videokit resize <file> <output> <width> <height>
 *   videokit --version
 *
 * Exit codes: 0 success, 1 ffmpeg error, 2 usage error.
 */
import { VideoKit, VERSION } from "./video.js";

function usage(): never {
  console.error(`Usage:
  videokit mcp
  videokit probe <file>
  videokit thumbnail <file> <output> [timestamp-seconds]
  videokit audio <file> <output>
  videokit trim <file> <output> <start-seconds> [duration-seconds]
  videokit resize <file> <output> <width> <height>
  videokit --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd) usage();
  try {
    const kit = new VideoKit();
    if (cmd === "probe") {
      const [file] = rest; if (!file) usage();
      console.log(JSON.stringify(await kit.probe(file), null, 2));
    } else if (cmd === "thumbnail") {
      const [file, out, ts] = rest; if (!file || !out) usage();
      console.log(JSON.stringify(await kit.thumbnail(file, out, ts ? Number(ts) : undefined), null, 2));
    } else if (cmd === "audio") {
      const [file, out] = rest; if (!file || !out) usage();
      console.log(JSON.stringify(await kit.extractAudio(file, out), null, 2));
    } else if (cmd === "trim") {
      const [file, out, start, dur] = rest; if (!file || !out || start === undefined) usage();
      console.log(JSON.stringify(await kit.trim(file, out, Number(start), dur ? Number(dur) : undefined), null, 2));
    } else if (cmd === "resize") {
      const [file, out, w, h] = rest; if (!file || !out || !w || !h) usage();
      console.log(JSON.stringify(await kit.resize(file, out, Number(w), Number(h)), null, 2));
    } else usage();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
