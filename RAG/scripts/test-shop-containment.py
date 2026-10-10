#!/usr/bin/env python3
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


SOURCE_SCRIPTS = Path(__file__).resolve().parent


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, timeout=30)


def install_fixture(root: Path) -> Path:
    repo = root / "repo"
    scripts = repo / "RAG" / "scripts"
    scripts.mkdir(parents=True)
    for name in ("carrier.py", "ui-channel.sh"):
        shutil.copy2(SOURCE_SCRIPTS / name, scripts / name)
    return repo


def submit(repo: Path, payload: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return run(
        "bash",
        str(repo / "RAG" / "scripts" / "ui-channel.sh"),
        "submit",
        "--topic",
        "probe",
        "--direction",
        "inbox",
        "--round",
        "1",
        "--file",
        str(payload),
        *extra,
    )


with tempfile.TemporaryDirectory(prefix="ui-shop-containment-") as temporary:
    root = Path(temporary)
    payload = root / "payload.md"
    payload.write_text("---\nsubmission: probe\nround: 1\n---\nfixture only\n")

    normal = install_fixture(root / "normal")
    result = submit(normal, payload)
    assert result.returncode == 0, result.stderr
    assert len(list((normal / ".codex" / "carrier").glob("*.md"))) == 1

    for case, spelling in (("separate", "--repo"), ("equals", "--repo="), ("abbrev", "--rep")):
        fixture = install_fixture(root / f"override-{case}")
        outside = fixture.parent / "outside"
        extra = (f"{spelling}{outside}",) if "=" in spelling else (spelling, str(outside))
        result = submit(fixture, payload, *extra)
        assert result.returncode != 0, (spelling, result.stdout, result.stderr)
        assert not outside.exists(), (spelling, list(outside.rglob("*")))
        assert not (fixture / ".codex").exists(), spelling
        assert "repo" in result.stderr.lower(), result.stderr

    fixture = install_fixture(root / "symlink-channel")
    outside = fixture.parent / "outside"
    outside.mkdir()
    (fixture / ".codex").symlink_to(outside, target_is_directory=True)
    result = submit(fixture, payload)
    assert result.returncode != 0, (result.stdout, result.stderr)
    assert list(outside.iterdir()) == [], list(outside.rglob("*"))
    assert "symbolic link" in result.stderr.lower() or "symlink" in result.stderr.lower()

    fixture = install_fixture(root / "dangling-channel")
    outside = fixture.parent / "missing"
    (fixture / ".codex").symlink_to(outside, target_is_directory=True)
    result = submit(fixture, payload)
    assert result.returncode != 0, (result.stdout, result.stderr)
    assert not outside.exists()

print("shop containment smoke: PASS")
