# videokit — Build Report

MCP Rebuild 100, Wave 1 Batch 5 (final Tier A batch). Clean-room
rebuild of the "video-tools" target, which is a FILL-IN in
TARGETS.json (`source_repo: null`): the 7-tool spec was defined for
this program over the ffmpeg/ffprobe CLI surface and is labelled
as such in the fixture. Local build only — nothing pushed or
published.

Identity: repo `videokit`, npm `@reneturcios/videokit`,
MCP name `io.github.CloudCorpRecords/videokit`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `videokit: dist/cli.js`, `mcpName` set
- `server.json` — description = **86 chars** (≤100 ✓, verified
  programmatically); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/videokit:0.1.0` carries **no** `version`
  field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/videokit"`.
  The base image bundles **no ffmpeg/ffprobe** (see gaps)
- `tsconfig.json`, `.gitignore`, `LICENSE` (MIT), `README.md`,
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/video.ts` (core + execFile executor)
- `test/video.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`

## Implementation notes

- Seven MCP tools: `probe_video`, `get_thumbnail`,
  `extract_frames`, `extract_audio`, `trim_video`,
  `transcode_video`, `resize_video`, each constructing an
  ffmpeg/ffprobe argument array (binary + args, no shell) behind
  an injectable `VideoExecutor`; unit tests use a fake executor and
  assert the exact arg arrays (seek-before-input for thumbnails,
  `fps=` filter for frames, `-vn` for audio, `-ss`/`-t` + `-c copy`
  for trims, `scale=` filter for resizes, output-extension ==
  format check for transcodes).
- **Low-level Server API** with explicit inputSchema literals (not
  McpServer+zod — standing rule). Zod validates `tools/call` args.
- `probe_video` parses ffprobe's JSON output and reports `null`
  for any field ffprobe did not provide — values are never
  invented to fill the shape.

## Verification (exact outputs)

- Build: `tsc` exit 0; canonical `dist/` present with `.d.ts` /
  `.js.map`. (Mid-batch the VM write guard truncated an earlier
  dist; stock `tsc` was re-run after the guard lifted and parity +
  tests re-verified against the canonical dist.)
- Tests: `tsx --test` → tests 11, pass 11, fail 0.
- CLI smoke: `node dist/cli.js --version` → `0.1.0`.
- Parity: verdict **PASS**, parity_pct **100.0**, identical_tools
  **7/7**, schema_diffs {} (`parity-out/parity.json`, re-run
  2026-10-26T17:03:11Z against canonical dist). Original side:
  tools-file fixture `harness/fixtures/video-tools-tools-original.json`
  (program-defined fill-in spec, labelled in its `_source`).

## Lockfile status

`package-lock.json` copied from pdfport with identity fields edited
(top-level `name`, root package `name`, bin key). Clean lockfile
regeneration is REQUIRED before publish — Blocker 3 in
SCOREBOARD.md. `node_modules` is a local `cp -a` copy; gitignored.

## Blockers / honest gaps

- Fill-in target: no original exists to probe; parity proves the
  rebuild matches this program's defined spec.
- **No live ffmpeg/ffprobe run was performed.** Happy paths are
  arg-construction + fake-executor tests; the default executor
  would surface the binary's own error (e.g. ENOENT) at runtime.
- The container image bundles no ffmpeg/ffprobe, so containerised
  videokit passes only the initialize/usage smoke. Same class as
  repoport gap 10.
- mcpaudit / mcpvet / shipcheck pre-publish gate not run — publish
  wave scope, not claimed here.

## Publish-gate remediation (2026-10-27)

Recorded under Rene's 2026-10-27 decision ("Remediate the 6: add param
descriptions + capability-class vet policy, then re-gate") and
`publish/GATE-POLICY.md`, following the standing Wave 2 remediation
pattern. This is an authorized deviation from the parity-faithful
state: descriptions were added to every tool parameter that lacked
one, in the `src/mcp.ts` schema literals only — parameter names,
types and required lists are unchanged.

- Descriptions added: 20 insertion points, covering 20 served
  parameter occurrences (the shared `str` / `num` schema consts are
  spread per property in the `TOOLS` literals, so each insertion
  serves exactly one occurrence). Insertion points:
  `probe_video` parameter `file_path`; `get_thumbnail` parameters
  `file_path`, `output_file`, `timestamp_seconds`; `extract_frames`
  parameters `file_path`, `fps`, `output_dir`; `extract_audio`
  parameters `file_path`, `output_file`; `trim_video` parameters
  `duration_seconds`, `file_path`, `output_file`, `start_seconds`;
  `transcode_video` parameters `file_path`, `format`,
  `output_file`; and `resize_video` parameters `file_path`,
  `height`, `output_file`, `width`.
- Rebuild: `npm run build` exit 0; `tsc --noEmit` exit 0; full
  test suite 11/11 pass (tests 11, pass 11, fail 0).
- Parity harness re-run, verbatim: **PARTIAL, parity_pct 50.0** —
  original_tools=7 rebuild_tools=7 missing=[] extra=[]
  schema_diffs=['extract_audio', 'extract_frames', 'get_thumbnail',
  'probe_video', 'resize_video', 'transcode_video', 'trim_video'].
  Every one of the 20 schema diffs is a description addition
  (`*.description: present in rebuild but not in original`); 0
  structural diffs. Structural parity proven independently:
  stripping `description` keys from BOTH the pre- and
  post-remediation tools/list deep-equals (strip-proof RESULT: PASS;
  every description present in PRE is byte-identical in POST, and
  the only additions are at inputSchema property paths — 20
  additions, 0 removals). Adjudication: the description-only diff
  is the authorized remediation itself; structural parity is
  unchanged. Full record:
  `publish/parity-remediation/videokit/parity.json` and
  `publish/parity-remediation/videokit/strip-proof.txt`.
- No publish gate was run in this remediation (no mcpaudit/mcpvet),
  and nothing was published.
