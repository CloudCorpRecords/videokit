import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VideoKit } from "../src/video.js";
import type { VideoExecutor } from "../src/types.js";

const PROBE_JSON = JSON.stringify({
  streams: [
    { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
    { codec_type: "audio", codec_name: "aac" },
  ],
  format: { format_name: "mov,mp4,m4a", duration: "12.5", size: "2048000" },
});

class FakeVideo implements VideoExecutor {
  calls: Array<{ binary: string; args: string[] }> = [];
  async run(binary: "ffmpeg" | "ffprobe", args: string[]): Promise<string> {
    this.calls.push({ binary, args });
    return binary === "ffprobe" ? PROBE_JSON : "";
  }
}

describe("videokit core", () => {
  it("probe parses ffprobe JSON into typed info", async () => {
    const fake = new FakeVideo(); const kit = new VideoKit(fake);
    const info = await kit.probe("/tmp/a.mp4");
    assert.equal(info.duration_seconds, 12.5);
    assert.equal(info.width, 1920); assert.equal(info.height, 1080);
    assert.equal(info.video_codec, "h264"); assert.equal(info.audio_codec, "aac");
    assert.equal(info.size_bytes, 2048000);
    assert.equal(fake.calls[0].binary, "ffprobe");
    assert.ok(fake.calls[0].args.includes("-show_streams"));
  });
  it("probe reports nulls (never invented values) for missing streams", async () => {
    const kit = new VideoKit({ async run() { return JSON.stringify({ streams: [], format: {} }); } });
    const info = await kit.probe("/tmp/empty.bin");
    assert.equal(info.video_codec, null); assert.equal(info.duration_seconds, null);
  });
  it("probe rejects unparseable ffprobe output", async () => {
    const kit = new VideoKit({ async run() { return "not json"; } });
    await assert.rejects(() => kit.probe("/tmp/a.mp4"), /unparseable/);
  });
  it("thumbnail seeks before the input and grabs one frame", async () => {
    const fake = new FakeVideo(); const kit = new VideoKit(fake);
    const r = await kit.thumbnail("/tmp/a.mp4", "/tmp/t.png", 3);
    assert.deepEqual(r.args, ["-y", "-ss", "3", "-i", "/tmp/a.mp4", "-frames:v", "1", "/tmp/t.png"]);
    await assert.rejects(() => kit.thumbnail("/tmp/a.mp4", "/tmp/t.png", -1), />= 0/);
  });
  it("extractFrames builds the fps filter and output pattern", async () => {
    const fake = new FakeVideo(); const kit = new VideoKit(fake);
    const r = await kit.extractFrames("/tmp/a.mp4", "/tmp/frames/", 2);
    assert.equal(r.pattern, "/tmp/frames/frame-%04d.png");
    assert.ok(r.args.includes("fps=2"));
    await assert.rejects(() => kit.extractFrames("/tmp/a.mp4", "/tmp/f", 0), /fps must be > 0/);
  });
  it("extractAudio drops the video stream with -vn", async () => {
    const fake = new FakeVideo(); const kit = new VideoKit(fake);
    const r = await kit.extractAudio("/tmp/a.mp4", "/tmp/a.mp3");
    assert.ok(r.args.includes("-vn")); assert.equal(r.output_file, "/tmp/a.mp3");
  });
  it("trim seeks, optionally limits duration and stream-copies", async () => {
    const fake = new FakeVideo(); const kit = new VideoKit(fake);
    const r = await kit.trim("/tmp/a.mp4", "/tmp/b.mp4", 5, 10);
    assert.deepEqual(r.args, ["-y", "-ss", "5", "-i", "/tmp/a.mp4", "-t", "10", "-c", "copy", "/tmp/b.mp4"]);
    const open = await kit.trim("/tmp/a.mp4", "/tmp/b.mp4", 5);
    assert.ok(!open.args.includes("-t"));
    await assert.rejects(() => kit.trim("/tmp/a.mp4", "/tmp/b.mp4", -2), />= 0/);
  });
  it("transcode requires the output extension to match the format", async () => {
    const fake = new FakeVideo(); const kit = new VideoKit(fake);
    const r = await kit.transcode("/tmp/a.mp4", "/tmp/a.webm", "webm");
    assert.ok(r.args.includes("-f")); assert.ok(r.args.includes("webm"));
    await assert.rejects(() => kit.transcode("/tmp/a.mp4", "/tmp/a.mkv", "webm"), /must end with .webm/);
  });
  it("resize builds the scale filter and validates dimensions", async () => {
    const fake = new FakeVideo(); const kit = new VideoKit(fake);
    const r = await kit.resize("/tmp/a.mp4", "/tmp/b.mp4", 640, 360);
    assert.ok(r.args.includes("scale=640:360"));
    await assert.rejects(() => kit.resize("/tmp/a.mp4", "/tmp/b.mp4", 0, 360), /> 0/);
  });
  it("missing required fields are rejected before any execution", async () => {
    const fake = new FakeVideo(); const kit = new VideoKit(fake);
    await assert.rejects(() => kit.probe(""), /file_path is required/);
    await assert.rejects(() => kit.extractAudio("/tmp/a.mp4", ""), /output_file is required/);
    assert.equal(fake.calls.length, 0);
  });
  it("executor failures propagate as tool errors", async () => {
    const kit = new VideoKit({ async run() { throw new Error("ffmpeg failed: spawn ffmpeg ENOENT"); } });
    await assert.rejects(() => kit.probe("/tmp/a.mp4"), /ENOENT/);
  });
});
