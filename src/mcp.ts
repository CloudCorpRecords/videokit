/**
 * videokit MCP server. Tools: probe_video, get_thumbnail,
 * extract_frames, extract_audio, trim_video, transcode_video,
 * resize_video.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects two keys
 * that are not in this toolset's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file therefore serves tools/list with
 * the spec's exact input schemas, while zod still validates every
 * tools/call argument set.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { VideoKit, VERSION } from "./video.js";

const FileArgs = z.object({ file_path: z.string() });
const ThumbArgs = z.object({ file_path: z.string(), output_file: z.string(), timestamp_seconds: z.number().optional() });
const FramesArgs = z.object({ file_path: z.string(), output_dir: z.string(), fps: z.number().optional() });
const OutArgs = z.object({ file_path: z.string(), output_file: z.string() });
const TrimArgs = z.object({ file_path: z.string(), output_file: z.string(), start_seconds: z.number(), duration_seconds: z.number().optional() });
const TranscodeArgs = z.object({ file_path: z.string(), output_file: z.string(), format: z.string() });
const ResizeArgs = z.object({ file_path: z.string(), output_file: z.string(), width: z.number(), height: z.number() });

const str = { type: "string" as const };
const num = { type: "number" as const };
const TOOLS = [
  { name: "probe_video", description: "Probe a local video file for duration, dimensions, codecs and format", inputSchema: { type: "object" as const, properties: { file_path: { ...str, description: "Path to the local video file to probe." } }, required: ["file_path"] } },
  { name: "get_thumbnail", description: "Extract a single frame of a video as a thumbnail image file", inputSchema: { type: "object" as const, properties: { file_path: { ...str, description: "Path to the local video file to extract the thumbnail frame from." }, output_file: { ...str, description: "Path of the image file to write the extracted thumbnail frame to." }, timestamp_seconds: { ...num, description: "Optional timestamp in seconds into the video at which to capture the thumbnail frame; defaults to 0 and must be >= 0." } }, required: ["file_path", "output_file"] } },
  { name: "extract_frames", description: "Extract frames of a video as image files in an output directory at a given rate", inputSchema: { type: "object" as const, properties: { file_path: { ...str, description: "Path to the local video file to extract frames from." }, fps: { ...num, description: "Optional rate in frames per second at which to extract frames; defaults to 1 and must be > 0." }, output_dir: { ...str, description: "Directory to write the extracted frame image files into, named frame-%04d.png." } }, required: ["file_path", "output_dir"] } },
  { name: "extract_audio", description: "Extract the audio track of a video into an audio file", inputSchema: { type: "object" as const, properties: { file_path: { ...str, description: "Path to the local video file to extract the audio track from." }, output_file: { ...str, description: "Path of the audio file to write the extracted audio track to." } }, required: ["file_path", "output_file"] } },
  { name: "trim_video", description: "Trim a video to a segment starting at an offset, optionally with a duration", inputSchema: { type: "object" as const, properties: { duration_seconds: { ...num, description: "Optional length in seconds of the trimmed segment, starting at start_seconds; must be > 0 when given." }, file_path: { ...str, description: "Path to the local video file to trim." }, output_file: { ...str, description: "Path of the video file to write the trimmed segment to." }, start_seconds: { ...num, description: "Offset in seconds from the start of the video at which the trimmed segment begins; must be >= 0." } }, required: ["file_path", "output_file", "start_seconds"] } },
  { name: "transcode_video", description: "Transcode a video to another container format", inputSchema: { type: "object" as const, properties: { file_path: { ...str, description: "Path to the local video file to transcode." }, format: { ...str, description: "Target container format to transcode the video to; output_file must end with '.' followed by this format." }, output_file: { ...str, description: "Path of the video file to write the transcoded video to; must end with '.' followed by the target format." } }, required: ["file_path", "output_file", "format"] } },
  { name: "resize_video", description: "Resize a video to the given width and height", inputSchema: { type: "object" as const, properties: { file_path: { ...str, description: "Path to the local video file to resize." }, height: { ...num, description: "Target height in pixels for the resized video; must be > 0." }, output_file: { ...str, description: "Path of the video file to write the resized video to." }, width: { ...num, description: "Target width in pixels for the resized video; must be > 0." } }, required: ["file_path", "output_file", "width", "height"] } },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const kit = new VideoKit();
const server = new Server({ name: "videokit", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "probe_video": return textResult(await kit.probe(FileArgs.parse(args ?? {}).file_path));
      case "get_thumbnail": { const p = ThumbArgs.parse(args ?? {}); return textResult(await kit.thumbnail(p.file_path, p.output_file, p.timestamp_seconds)); }
      case "extract_frames": { const p = FramesArgs.parse(args ?? {}); return textResult(await kit.extractFrames(p.file_path, p.output_dir, p.fps)); }
      case "extract_audio": { const p = OutArgs.parse(args ?? {}); return textResult(await kit.extractAudio(p.file_path, p.output_file)); }
      case "trim_video": { const p = TrimArgs.parse(args ?? {}); return textResult(await kit.trim(p.file_path, p.output_file, p.start_seconds, p.duration_seconds)); }
      case "transcode_video": { const p = TranscodeArgs.parse(args ?? {}); return textResult(await kit.transcode(p.file_path, p.output_file, p.format)); }
      case "resize_video": { const p = ResizeArgs.parse(args ?? {}); return textResult(await kit.resize(p.file_path, p.output_file, p.width, p.height)); }
    }
  } catch (err) { return errorResult(err); }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> { await server.connect(new StdioServerTransport()); }
void main();
