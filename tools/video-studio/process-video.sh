#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./tools/video-studio/process-video.sh INPUT_VIDEO [OUTPUT_DIR] [LOGO_FILE]

Creates three review-ready MP4 files:
  story.mp4  1080x1920, up to 30 seconds
  feed.mp4   1080x1350, up to 60 seconds
  reel.mp4   1080x1920, up to 90 seconds

Requirements:
  ffmpeg and ffprobe must be installed and available on PATH.

Nothing is uploaded or published.
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

INPUT="$1"
OUTPUT_DIR="${2:-./video-studio-output}"
LOGO="${3:-}"

command -v ffmpeg >/dev/null 2>&1 || { echo "Error: ffmpeg is not installed." >&2; exit 1; }
command -v ffprobe >/dev/null 2>&1 || { echo "Error: ffprobe is not installed." >&2; exit 1; }
[[ -f "$INPUT" ]] || { echo "Error: input video not found: $INPUT" >&2; exit 1; }

if [[ -n "$LOGO" && ! -f "$LOGO" ]]; then
  echo "Error: logo file not found: $LOGO" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Keep the subject visible without stretching the source. Landscape sources are
# center-cropped; portrait sources are scaled and padded where necessary.
vertical_filter="scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
feed_filter="scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350"

encode() {
  local duration="$1"
  local filter="$2"
  local output="$3"

  if [[ -n "$LOGO" ]]; then
    ffmpeg -hide_banner -loglevel warning -y \
      -i "$INPUT" -i "$LOGO" -t "$duration" \
      -filter_complex "[0:v]${filter}[base];[1:v]scale=180:-1[logo];[base][logo]overlay=W-w-40:40:format=auto[v]" \
      -map "[v]" -map 0:a? \
      -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
      -c:a aac -b:a 192k -af "loudnorm=I=-14:LRA=11:TP=-1.5" \
      -movflags +faststart "$output"
  else
    ffmpeg -hide_banner -loglevel warning -y \
      -i "$INPUT" -t "$duration" \
      -vf "$filter" \
      -map 0:v:0 -map 0:a? \
      -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
      -c:a aac -b:a 192k -af "loudnorm=I=-14:LRA=11:TP=-1.5" \
      -movflags +faststart "$output"
  fi
}

echo "Creating Story version..."
encode 30 "$vertical_filter" "$OUTPUT_DIR/story.mp4"

echo "Creating Feed version..."
encode 60 "$feed_filter" "$OUTPUT_DIR/feed.mp4"

echo "Creating Reel version..."
encode 90 "$vertical_filter" "$OUTPUT_DIR/reel.mp4"

cat > "$OUTPUT_DIR/REVIEW_CHECKLIST.txt" <<'EOF'
CAIOS VIDEO STUDIO REVIEW CHECKLIST

[ ] The opening is immediately understandable.
[ ] Captions were added or checked in Adobe Premiere mobile.
[ ] The speaker or main subject remains in frame.
[ ] No copyrighted music was added without permission.
[ ] Branding is correct for this content.
[ ] Audio is clear and not clipping.
[ ] Story, Feed, and Reel exports were watched completely.
[ ] The Chile approved the final files before posting.
EOF

echo "Done. Review-ready files are in: $OUTPUT_DIR"
