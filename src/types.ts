/**
 * videokit types.
 *
 * The core builds ffmpeg/ffprobe argument arrays and runs them
 * through the VideoExecutor interface (execFile semantics: a binary
 * name plus an argument array, never a shell string). The default
 * executor spawns the real binaries; tests inject a fake that
 * records the arrays and returns canned probe output.
 */

/** Runs a binary with an argument array; resolves with stdout. */
export interface VideoExecutor {
  run(binary: "ffmpeg" | "ffprobe", args: string[]): Promise<string>;
}

/** Parsed result of an ffprobe JSON probe. */
export interface VideoInfo {
  file_path: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  video_codec: string | null;
  audio_codec: string | null;
  format: string | null;
  size_bytes: number | null;
}

/** Result of an operation that writes a file. */
export interface FileResult {
  file_path: string;
  output_file: string;
  args: string[];
}

/** Result of frame extraction (writes many files into a directory). */
export interface FramesResult {
  file_path: string;
  output_dir: string;
  pattern: string;
  args: string[];
}
