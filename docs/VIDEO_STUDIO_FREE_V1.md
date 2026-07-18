# CAIOS Video Studio — Free v1

## Purpose

Turn one source video into three review-ready social versions without adding a paid subscription.

**Core rule:** AI and automation prepare. The Chile approves. Nothing publishes automatically.

## What v1 automates

- Creates a 9:16 Story version, limited to 30 seconds.
- Creates a 4:5 Feed version, limited to 60 seconds.
- Creates a 9:16 Reel version, limited to 90 seconds.
- Normalizes audio for social playback.
- Optionally adds a logo watermark.
- Produces a review checklist beside the exports.

## What remains in Adobe Premiere mobile

Premiere mobile is used only for the fast finishing pass:

1. Import the three generated files.
2. Generate and verify captions.
3. Use Enhance Speech when the recording needs cleanup.
4. Correct framing only when the center crop misses the subject.
5. Add approved music, title text, or a platform-specific CTA.
6. Export after review.

This avoids rebuilding each edit from scratch.

## Free stack

- CAIOS GitHub repository for code and instructions.
- FFmpeg for local video processing.
- Adobe Premiere mobile for captions, speech enhancement, and final review.
- Existing phone or computer storage.

No API key, paid automation platform, or new cloud service is required for v1.

## Installation

### Windows

Install FFmpeg using one of these existing package managers:

```powershell
winget install Gyan.FFmpeg
```

Restart the terminal after installation.

### macOS

```bash
brew install ffmpeg
```

## Run the processor

From the CAIOS repository:

```bash
chmod +x tools/video-studio/process-video.sh
./tools/video-studio/process-video.sh "/path/to/source-video.mp4"
```

Choose a specific output folder:

```bash
./tools/video-studio/process-video.sh source.mp4 ./review/project-name
```

Add a PNG logo watermark:

```bash
./tools/video-studio/process-video.sh source.mp4 ./review/project-name ./brand/logo.png
```

## Output

```text
review/project-name/
├── story.mp4
├── feed.mp4
├── reel.mp4
└── REVIEW_CHECKLIST.txt
```

## Standard formats

| Version | Resolution | Maximum duration | Intended use |
|---|---:|---:|---|
| Story | 1080 × 1920 | 30 sec | Instagram/Facebook Story |
| Feed | 1080 × 1350 | 60 sec | Instagram/Facebook feed |
| Reel | 1080 × 1920 | 90 sec | Instagram/Facebook Reel |

## Operating procedure

1. Copy the original video to a project folder.
2. Run the processor once.
3. Open the three outputs in Premiere mobile.
4. Generate captions and check spelling, names, and timing.
5. Add the correct brand treatment.
6. Watch every export from beginning to end.
7. Approve or reject each version.
8. Post manually only after approval.

## Important limitation

This first version does not decide which moment is the strongest highlight. It starts at the beginning of the source video and creates time-limited platform versions. Automated highlight selection requires either a local transcription/highlight model or a paid API and should be added only after this dependable base workflow is tested.

## v1 acceptance test

A successful test must confirm:

- All three files play correctly on a phone.
- No output is stretched.
- Audio is clear and synchronized.
- The logo appears correctly when supplied.
- Premiere mobile can import every output.
- Nothing is uploaded or published automatically.
