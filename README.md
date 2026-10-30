# videokit

Local video file tools as a CLI and a stdio MCP server in one bin.
Probe a video for duration, dimensions and codecs; extract a
thumbnail, frames or the audio track; trim, transcode and resize.

All work is built as ffmpeg/ffprobe argument arrays (execFile,
never a shell string) behind an injectable executor, and probe
results are parsed from ffprobe's JSON output — fields a file does
not carry come back as null, never invented. This package bundles
no ffmpeg: host runs use the host's binaries, and when they are
absent the spawn error (ENOENT) is the tool error.

## Install

```bash
npx -y @reneturcios/videokit mcp
```

## CLI

```bash
videokit mcp
videokit probe <file>
videokit thumbnail <file> <output> [timestamp-seconds]
videokit audio <file> <output>
videokit trim <file> <output> <start-seconds> [duration-seconds]
videokit resize <file> <output> <width> <height>
videokit --version
```

Exit codes: 0 success, 1 ffmpeg error, 2 usage error.

## MCP tools

| Tool | Purpose |
|---|---|
| `probe_video` | Probe a local video file for duration, dimensions, codecs and format |
| `get_thumbnail` | Extract a single frame of a video as a thumbnail image file |
| `extract_frames` | Extract frames of a video as image files in an output directory at a given rate |
| `extract_audio` | Extract the audio track of a video into an audio file |
| `trim_video` | Trim a video to a segment starting at an offset, optionally with a duration |
| `transcode_video` | Transcode a video to another container format |
| `resize_video` | Resize a video to the given width and height |

MCP client config:

```json
{
  "mcpServers": {
    "videokit": {
      "command": "npx",
      "args": ["-y", "@reneturcios/videokit", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/videokit          # MCP server (ffmpeg unavailable in-image)
docker run --rm ghcr.io/cloudcorprecords/videokit --version
```

## Development

```bash
npm install
npm run build
npm test
```

MIT license.
