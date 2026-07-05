from pathlib import Path
from datetime import datetime


def generate_show_prep() -> str:
    """Generate a starter show prep packet."""
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)

    filename = output_dir / f"show_prep_{datetime.now().strftime('%Y%m%d')}.md"

    content = f"""# Rod Ryan Show Prep\n\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n## Alternative Rock\n- [ ] Story 1\n\n## Houston\n- [ ] Story 1\n\n## Food News\n- [ ] Story 1\n\n## Celebrity\n- [ ] Story 1\n\n## Criminalzzz\n- [ ] Story 1\n\n## Social Media Ideas\n- [ ] Reel\n- [ ] Story\n- [ ] X Post\n"""

    filename.write_text(content, encoding="utf-8")
    return str(filename)
