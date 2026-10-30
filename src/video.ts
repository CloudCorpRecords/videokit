/**
 * videokit core: seven local video tools over ffmpeg/ffprobe.
 *
 * Argument construction is the real logic here and is fully
 * deterministic: probe uses ffprobe's JSON output mode and parses
 * it; every transformation builds the conventional ffmpeg argument
 * array for the job (seek-before-input for thumbnails and trims,
 * fps filter for frame extraction, -vn for audio, scale filter for
 * resize, extension-driven output for transcode). Execution goes
 * through the injectable VideoExecutor (execFile, no shell). When
 * ffmpeg/ffprobe are absent the executor surfaces the spawn error
 * (ENOENT) as the tool error - nothing is faked.
 */
import { execFile } from "node:child_process";
import type { FileResult, FramesResult, VideoExecutor, VideoInfo } from "./types.js";

export const VERSION = "0.1.0";

export class ExecFileVideoExecutor implements VideoExecutor {
  async run(binary: "ffmpeg" | "ffprobe", args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(binary, args, { timeout: 120000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || "").trim().split("\n").slice(-3).join("\n") || err.message;
          reject(new Error(`${binary} failed: ${msg}`));
          return;
        }
        resolve(stdout);
      });
    });
  }
}

function need(value: string | undefined, field: string): string {
  if (!value) throw new Error(`${field} is required`);
  return value;
}

export class VideoKit {
  private readonly exec: VideoExecutor;
  constructor(exec: VideoExecutor = new ExecFileVideoExecutor()) { this.exec = exec; }

  async probe(filePath: string): Promise<VideoInfo> {
    need(filePath, "file_path");
    const args = ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath];
    const out = await this.exec.run("ffprobe", args);
    let parsed: { streams?: Array<Record<string, unknown>>; format?: Record<string, unknown> };
    try { parsed = JSON.parse(out); } catch { throw new Error(`ffprobe returned unparseable output for ${filePath}`); }
    const streams = parsed.streams ?? [];
    const video = streams.find((s) => s.codec_type === "video");
    const audio = streams.find((s) => s.codec_type === "audio");
    const format = parsed.format ?? {};
    const num = (v: unknown): number | null => {
      const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
      return Number.isFinite(n) ? n : null;
    };
    return {
      file_path: filePath,
      duration_seconds: num(format.duration),
      width: num(video?.width),
      height: num(video?.height),
      video_codec: typeof video?.codec_name === "string" ? video.codec_name : null,
      audio_codec: typeof audio?.codec_name === "string" ? audio.codec_name : null,
      format: typeof format.format_name === "string" ? format.format_name : null,
      size_bytes: num(format.size),
    };
  }

  async thumbnail(filePath: string, outputFile: string, timestampSeconds = 0): Promise<FileResult> {
    need(filePath, "file_path"); need(outputFile, "output_file");
    if (timestampSeconds < 0) throw new Error("timestamp_seconds must be >= 0");
    const args = ["-y", "-ss", String(timestampSeconds), "-i", filePath, "-frames:v", "1", outputFile];
    await this.exec.run("ffmpeg", args);
    return { file_path: filePath, output_file: outputFile, args };
  }

  async extractFrames(filePath: string, outputDir: string, fps = 1): Promise<FramesResult> {
    need(filePath, "file_path"); need(outputDir, "output_dir");
    if (fps <= 0) throw new Error("fps must be > 0");
    const pattern = `${outputDir.replace(/\/$/, "")}/frame-%04d.png`;
    const args = ["-y", "-i", filePath, "-vf", `fps=${fps}`, pattern];
    await this.exec.run("ffmpeg", args);
    return { file_path: filePath, output_dir: outputDir, pattern, args };
  }

  async extractAudio(filePath: string, outputFile: string): Promise<FileResult> {
    need(filePath, "file_path"); need(outputFile, "output_file");
    const args = ["-y", "-i", filePath, "-vn", outputFile];
    await this.exec.run("ffmpeg", args);
    return { file_path: filePath, output_file: outputFile, args };
  }

  async trim(filePath: string, outputFile: string, startSeconds: number, durationSeconds?: number): Promise<FileResult> {
    need(filePath, "file_path"); need(outputFile, "output_file");
    if (startSeconds < 0) throw new Error("start_seconds must be >= 0");
    const args = ["-y", "-ss", String(startSeconds), "-i", filePath];
    if (durationSeconds !== undefined) {
      if (durationSeconds <= 0) throw new Error("duration_seconds must be > 0");
      args.push("-t", String(durationSeconds));
    }
    args.push("-c", "copy", outputFile);
    await this.exec.run("ffmpeg", args);
    return { file_path: filePath, output_file: outputFile, args };
  }

  async transcode(filePath: string, outputFile: string, format: string): Promise<FileResult> {
    need(filePath, "file_path"); need(outputFile, "output_file"); need(format, "format");
    if (!outputFile.toLowerCase().endsWith(`.${format.toLowerCase()}`)) {
      throw new Error(`output_file must end with .${format} for a ${format} transcode`);
    }
    const args = ["-y", "-i", filePath, "-f", format, outputFile];
    await this.exec.run("ffmpeg", args);
    return { file_path: filePath, output_file: outputFile, args };
  }

  async resize(filePath: string, outputFile: string, width: number, height: number): Promise<FileResult> {
    need(filePath, "file_path"); need(outputFile, "output_file");
    if (width <= 0 || height <= 0) throw new Error("width and height must be > 0");
    const args = ["-y", "-i", filePath, "-vf", `scale=${width}:${height}`, outputFile];
    await this.exec.run("ffmpeg", args);
    return { file_path: filePath, output_file: outputFile, args };
  }
}
