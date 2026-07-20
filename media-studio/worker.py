from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

INPUT_DIR = Path("/workspace/input")
OUTPUT_DIR = Path("/workspace/output")
JOBS_DIR = Path("/workspace/jobs")
DONE_DIR = Path("/workspace/done")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def escape_drawtext(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(":", "\\:")
        .replace("'", "\\'")
        .replace("%", "\\%")
        .replace("\n", "\\n")
    )


def render_job(job_path: Path) -> Path:
    job = json.loads(job_path.read_text(encoding="utf-8"))
    clips = [INPUT_DIR / name for name in job["clips"]]
    missing = [str(path) for path in clips if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing input files: {missing}")

    output_name = job.get("output", f"{job_path.stem}.mp4")
    output_path = OUTPUT_DIR / output_name
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    inputs: list[str] = []
    for clip in clips:
        inputs.extend(["-i", str(clip)])

    video_chains: list[str] = []
    audio_chains: list[str] = []
    concat_inputs: list[str] = []
    for index in range(len(clips)):
        video_chains.append(
            f"[{index}:v]scale=-2:1920,crop=1080:1920,setsar=1,fps=30[v{index}]"
        )
        audio_chains.append(
            f"[{index}:a]aresample=48000,asetpts=N/SR/TB[a{index}]"
        )
        concat_inputs.append(f"[v{index}][a{index}]")

    filters = video_chains + audio_chains
    filters.append(
        "".join(concat_inputs)
        + f"concat=n={len(clips)}:v=1:a=1[basev][basea]"
    )

    current = "basev"
    overlays = job.get("text", [])
    for index, item in enumerate(overlays):
        nxt = f"txt{index}"
        text = escape_drawtext(item["value"])
        start = float(item["start"])
        end = float(item["end"])
        size = int(item.get("font_size", 64))
        y = item.get("y", "(h-text_h)/2")
        filters.append(
            f"[{current}]drawtext=text='{text}':fontcolor=white:fontsize={size}:"
            "borderw=4:bordercolor=black@0.8:line_spacing=12:"
            "x=(w-text_w)/2:"
            f"y={y}:enable='between(t,{start},{end})'[{nxt}]"
        )
        current = nxt

    command = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        f"[{current}]",
        "-map",
        "[basea]",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    run(command)
    return output_path


def process_jobs() -> None:
    for directory in (INPUT_DIR, OUTPUT_DIR, JOBS_DIR, DONE_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    while True:
        jobs = sorted(JOBS_DIR.glob("*.json"))
        if not jobs:
            time.sleep(2)
            continue

        for job_path in jobs:
            try:
                output = render_job(job_path)
                status = {"status": "complete", "output": str(output)}
                (DONE_DIR / f"{job_path.stem}.json").write_text(
                    json.dumps(status, indent=2), encoding="utf-8"
                )
                job_path.unlink()
            except Exception as exc:
                status = {"status": "failed", "error": str(exc)}
                (DONE_DIR / f"{job_path.stem}.json").write_text(
                    json.dumps(status, indent=2), encoding="utf-8"
                )
                job_path.rename(DONE_DIR / f"{job_path.stem}.failed.json")


if __name__ == "__main__":
    process_jobs()
