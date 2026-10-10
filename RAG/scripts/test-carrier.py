#!/usr/bin/env python3
import os
import subprocess
import sys
import tempfile
from pathlib import Path


CARRIER = Path(__file__).with_name("carrier.py")


def run(repo: Path, state: Path, *args: str, ok: bool = True):
    env = {**os.environ, "CARRIER_STATE_DIR": str(state)}
    result = subprocess.run(
        [sys.executable, "-B", str(CARRIER), *args, "--repo", str(repo)],
        env=env,
        text=True,
        capture_output=True,
    )
    if ok and result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout)
    if not ok and result.returncode == 0:
        raise AssertionError("carrier command unexpectedly succeeded")
    return result


def message(topic: str, round_number: int, body: str) -> bytes:
    return (
        f"---\nsubmission: {topic}\nround: {round_number}\n---\n\n{body}\n"
    ).encode()


with tempfile.TemporaryDirectory(prefix="ui-carrier-") as temporary:
    root = Path(temporary)
    repo = root / "repo"
    state = repo / ".codex" / "state"
    inbox = repo / ".codex" / "inbox"
    inbox.mkdir(parents=True)
    live = inbox / "infra-wave.md"

    live.write_bytes(message("infra-wave", 1, "first"))
    run(repo, state, "sync")
    live.write_bytes(message("infra-wave", 2, "second"))
    run(repo, state, "sync")

    artifacts = sorted((repo / ".codex" / "carrier").glob("infra-wave-inbox-*.md"))
    assert len(artifacts) == 2, artifacts
    assert {path.read_bytes() for path in artifacts} == {
        message("infra-wave", 1, "first"),
        message("infra-wave", 2, "second"),
    }

    run(repo, state, "ack-file", "--file", str(live))
    acknowledgements = list((repo / ".codex" / "carrier" / "receipts").glob("*.ack.json"))
    assert len(acknowledgements) == 1

    (state / "index.db").unlink()
    run(repo, state, "rebuild")

    wrong = inbox / "wrong.md"
    wrong.write_bytes(message("different-topic", 1, "mismatch"))
    result = run(repo, state, "sync", ok=False)
    assert "filename must match submission" in result.stderr

    payload = root / "payload.md"
    payload.write_text("payload")
    result = run(
        repo,
        state,
        "submit",
        "--topic",
        "../escape",
        "--direction",
        "inbox",
        "--round",
        "1",
        "--file",
        str(payload),
        ok=False,
    )
    assert "lowercase kebab-case" in result.stderr

    outside_state = root / "outside-state"
    result = run(repo, outside_state, "status", ok=False)
    assert "inside the bound repository" in result.stderr
    assert not outside_state.exists()

    linked_repo = root / "repo-link"
    linked_repo.symlink_to(repo, target_is_directory=True)
    result = run(linked_repo, state, "status", ok=False)
    assert "symbolic link" in result.stderr

    result = subprocess.run(
        [sys.executable, "-B", str(CARRIER), "status", "--rep", str(repo)],
        env={**os.environ, "CARRIER_STATE_DIR": str(state)},
        text=True,
        capture_output=True,
    )
    assert result.returncode != 0
    assert "--repo" in result.stderr

print("carrier smoke: PASS")
