#!/usr/bin/env bash
set -euo pipefail

usage(){ cat <<'EOF'
Usage:
  process-production.sh CLIPS_DIR MUSIC_FILE [OUTPUT_DIR] [LOGO_PNG]

Creates review-ready social exports from ordered MP4/MOV clips.
Source audio is muted. MUSIC_FILE must be a locally approved, copyright-safe track.
Nothing is uploaded or published.
EOF
}

[[ ${1:-} == "-h" || ${1:-} == "--help" || $# -lt 2 ]] && { usage; exit 0; }
CLIPS_DIR="$1"; MUSIC="$2"; OUT="${3:-./media-studio-output}"; LOGO="${4:-}"
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe is required" >&2; exit 1; }
[[ -d "$CLIPS_DIR" ]] || { echo "Clips directory not found" >&2; exit 1; }
[[ -f "$MUSIC" ]] || { echo "Music file not found" >&2; exit 1; }
[[ -z "$LOGO" || -f "$LOGO" ]] || { echo "Logo file not found" >&2; exit 1; }
mkdir -p "$OUT/work"

mapfile -t clips < <(find "$CLIPS_DIR" -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' \) | sort)
((${#clips[@]})) || { echo "No supported clips found" >&2; exit 1; }

: > "$OUT/work/concat.txt"
for i in "${!clips[@]}"; do
  n=$(printf '%03d' "$i")
  normalized="$OUT/work/clip-$n.mp4"
  duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "${clips[$i]}")
  fade_out=$(awk -v d="$duration" 'BEGIN { s=d-0.18; if (s<0) s=0; printf "%.3f", s }')
  ffmpeg -hide_banner -loglevel error -y -i "${clips[$i]}" \
    -an -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fade=t=in:st=0:d=.18,fade=t=out:st=${fade_out}:d=.18,fps=30" \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "$normalized"
  printf "file '%s'\n" "$(realpath "$normalized")" >> "$OUT/work/concat.txt"
done

silent="$OUT/work/master-silent.mp4"
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$OUT/work/concat.txt" -c copy "$silent"
master_duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$silent")
music_fade_out=$(awk -v d="$master_duration" 'BEGIN { s=d-0.8; if (s<0) s=0; printf "%.3f", s }')
master="$OUT/work/master-music.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$silent" -stream_loop -1 -i "$MUSIC" \
  -map 0:v:0 -map 1:a:0 -shortest -c:v copy -c:a aac -b:a 192k \
  -af "afade=t=in:st=0:d=.5,afade=t=out:st=${music_fade_out}:d=.8,loudnorm=I=-14:LRA=11:TP=-1.5" \
  -movflags +faststart "$master"

render(){ name="$1"; w="$2"; h="$3"; seconds="$4"; vf="scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}";
  if [[ -n "$LOGO" ]]; then
    ffmpeg -hide_banner -loglevel error -y -i "$master" -i "$LOGO" -t "$seconds" \
      -filter_complex "[0:v]${vf}[b];[1:v]scale=160:-1[l];[b][l]overlay=W-w-36:36[v]" \
      -map '[v]' -map 0:a:0 -c:v libx264 -preset medium -crf 20 -c:a copy -pix_fmt yuv420p -movflags +faststart "$OUT/$name.mp4"
  else
    ffmpeg -hide_banner -loglevel error -y -i "$master" -t "$seconds" -vf "$vf" \
      -c:v libx264 -preset medium -crf 20 -c:a copy -pix_fmt yuv420p -movflags +faststart "$OUT/$name.mp4"
  fi
}

render instagram-story 1080 1920 30
render instagram-reel 1080 1920 90
render instagram-feed 1080 1350 60
render facebook-reel 1080 1920 90
render facebook-feed 1080 1350 120
render tiktok 1080 1920 90
render youtube-shorts 1080 1920 60
render x-video 1280 720 140
render linkedin-video 1080 1350 180
render pinterest-video 1080 1920 60
render snapchat-spotlight 1080 1920 60
render threads-video 1080 1350 60

cat > "$OUT/PRODUCTION_MANIFEST.txt" <<EOF
CAIOS MEDIA STUDIO PRODUCTION MANIFEST
Source directory: $CLIPS_DIR
Music file: $MUSIC
Music license/source verified by operator: [ ]
Source audio muted: yes
Automatic transitions: short fade in/out per clip
Automatic publishing: disabled
Human approval required: yes

REVIEW
[ ] Strong opening hook
[ ] Correct clip order
[ ] Music fits content and license is documented
[ ] Transitions look natural
[ ] Branding and safe zones are correct
[ ] Every export was watched completely
[ ] Approved by The Chile before posting
EOF

echo "Complete: $OUT"
