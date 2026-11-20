"""Package the project into a clean zip archive for submission or release,
verifying that flows.json is in sync and no secrets or excluded folders are bundled.
"""
import argparse
import re
import subprocess
import sys
import zipfile
from pathlib import Path

FOLDER = Path(__file__).resolve().parent
EXCLUDED_DIRS = {".backups", ".preview", "node_modules", "__pycache__", ".git"}
EXCLUDED_FILES = {".env"}
SECRET_PATTERN = re.compile(
    r"(sk-[a-zA-Z0-9]{20,}|(?:OPENAI|DEEPSEEK|ANTHROPIC|OPENROUTER|GEMINI)_API_KEY\s*=\s*['\"]?[a-zA-Z0-9_\-]{12,})"
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "-o", "--output", default="fishing-node-red-submission.zip",
        help="Output zip filename (created in parent directory by default)"
    )
    args = parser.parse_args()

    # 1. Verify sync_dashboard.py --check
    check = subprocess.run([sys.executable, str(FOLDER / "sync_dashboard.py"), "--check"])
    if check.returncode != 0:
        sys.exit(check.returncode)

    out_path = (FOLDER.parent / args.output).resolve()
    files_to_pack = []

    for path in sorted(FOLDER.rglob("*")):
        if path.is_dir():
            continue
        rel = path.relative_to(FOLDER)
        if any(part in EXCLUDED_DIRS for part in rel.parts):
            continue
        if rel.name in EXCLUDED_FILES or (rel.name.startswith(".env") and rel.name != ".env.example"):
            continue
        if path.suffix in {".zip", ".pyc"}:
            continue
        # Scan text files for accidental secret leakage
        if path.suffix in {".js", ".mjs", ".py", ".json", ".yaml", ".yml", ".md", ".html", ".css", ".sh", ".example"}:
            text = path.read_text(encoding="utf-8", errors="ignore")
            if SECRET_PATTERN.search(text):
                sys.exit(f"SECURITY BLOCK: Potential API key detected in {rel}!")
        files_to_pack.append((path, rel))

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for full_path, rel_path in files_to_pack:
            zf.write(full_path, arcname=str(Path("fishing-node-red") / rel_path))

    print(f"Clean archive created: {out_path} ({len(files_to_pack)} files, 0 secrets).")


if __name__ == "__main__":
    main()
