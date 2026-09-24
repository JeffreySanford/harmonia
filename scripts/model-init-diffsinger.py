#!/usr/bin/env python3
"""Safely initialize one DiffSinger HTTP-ZIP artifact into a model root."""

import fnmatch
import json
import os
import shutil
import stat
import sys
import time
import urllib.error
import urllib.request
import uuid
import zipfile
from pathlib import Path, PurePosixPath
from typing import Optional


def fail(message):
    raise RuntimeError(message)


def under(base: Path, candidate: Path) -> bool:
    base = base.resolve()
    candidate = candidate.resolve()
    return candidate == base or base in candidate.parents


def validate_member(info: zipfile.ZipInfo, unpack: Path) -> Path:
    normalized = info.filename.replace("\\", "/")
    pure = PurePosixPath(normalized)
    first = pure.parts[0] if pure.parts else ""
    unix_type = (info.external_attr >> 16) & 0o170000

    if (
        not normalized
        or pure.is_absolute()
        or ".." in pure.parts
        or (len(first) >= 2 and first[1] == ":")
    ):
        fail(f"unsafe ZIP member path: {info.filename}")

    if unix_type == stat.S_IFLNK:
        fail(f"ZIP symbolic links are not allowed: {info.filename}")

    output = (unpack / Path(*pure.parts)).resolve()

    if not under(unpack, output):
        fail(f"ZIP member escapes staging root: {info.filename}")

    return output


def download(url: str, archive: Path) -> int:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Harmonia-Model-Manager/1.0"},
    )

    last_error = None

    for attempt in range(1, 5):
        try:
            total = 0
            with urllib.request.urlopen(request, timeout=60) as response:
                with archive.open("wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        output.write(chunk)
                        total += len(chunk)
            return total
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code in (401, 403):
                raise
            if exc.code != 429 and not (500 <= exc.code <= 599):
                raise
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            last_error = exc

        if attempt < 4:
            time.sleep(min(2**attempt, 8))

    if last_error is not None:
        raise last_error

    fail("download failed without an error")


def extract_safely(archive: Path, unpack: Path) -> None:
    with zipfile.ZipFile(archive, "r") as zf:
        members = zf.infolist()

        if not members:
            fail("archive is empty")

        checked = [
            (info, validate_member(info, unpack))
            for info in members
        ]

        for info, output in checked:
            if info.is_dir():
                output.mkdir(parents=True, exist_ok=True)
                continue

            output.parent.mkdir(parents=True, exist_ok=True)

            with zf.open(info, "r") as source:
                with output.open("wb") as dest:
                    shutil.copyfileobj(
                        source,
                        dest,
                        length=1024 * 1024,
                    )


def locate_package_root(
    unpack: Path,
    archive_root: Optional[str],
) -> Path:
    if archive_root:
        preferred = unpack / archive_root
        if preferred.is_dir():
            return preferred

    roots = sorted(
        {
            config.parent.resolve()
            for config in unpack.rglob("config.yaml")
            if config.is_file()
        }
    )

    if len(roots) != 1:
        fail(
            "archive did not contain one unambiguous package root"
        )

    return roots[0]


def verify_candidate(candidate: Path, verification: dict) -> None:
    for relative in verification.get("requiredFiles") or []:
        pure = PurePosixPath(relative.replace("\\", "/"))

        if pure.is_absolute() or ".." in pure.parts:
            fail(f"unsafe verification path: {relative}")

        check = (candidate / Path(*pure.parts)).resolve()

        if not under(candidate, check):
            fail(
                f"verification path escapes candidate: {relative}"
            )

        if not check.is_file() or check.stat().st_size <= 0:
            fail(
                f"required file is missing or empty: {relative}"
            )

    all_files = [
        item
        for item in candidate.rglob("*")
        if item.is_file()
    ]

    for pattern in verification.get("checkpointGlobs") or []:
        matches = []

        for item in all_files:
            relative = item.relative_to(candidate).as_posix()

            if (
                fnmatch.fnmatch(relative, pattern)
                or fnmatch.fnmatch(item.name, pattern)
            ):
                matches.append(item)

        if not matches:
            fail(
                "required checkpoint pattern has no matches: "
                + pattern
            )

        for item in matches:
            if item.stat().st_size <= 0:
                fail(f"checkpoint is empty: {item.name}")


def main() -> None:
    if len(sys.argv) != 7:
        raise SystemExit(
            "usage: model-init-diffsinger.py "
            "<model-root> <url> <destination> <artifact-id> "
            "<archive-root-or-dash> <verification-json>"
        )

    root = Path(sys.argv[1]).resolve()
    url = sys.argv[2]
    destination = sys.argv[3]
    artifact_id = sys.argv[4]
    archive_root = None if sys.argv[5] == "-" else sys.argv[5]
    verification = json.loads(sys.argv[6])

    target = (
        root / Path(*PurePosixPath(destination).parts)
    ).resolve()

    if not under(root, target):
        fail("destination escapes configured model root")

    if target.exists():
        fail(
            "final destination already exists; "
            "use models:repair for incomplete caches"
        )

    operation_id = (
        time.strftime("%Y%m%dT%H%M%S")
        + "-"
        + uuid.uuid4().hex[:12]
    )
    stage = (
        root
        / ".staging"
        / artifact_id
        / operation_id
    )
    archive = stage / "package.zip"
    unpack = stage / "unpack"
    candidate = stage / "candidate"
    metadata = stage / "operation.json"

    stage.mkdir(parents=True, exist_ok=False)
    unpack.mkdir(parents=True, exist_ok=False)

    def write_metadata(state: str, **extra) -> None:
        payload = {
            "operationId": operation_id,
            "artifactId": artifact_id,
            "source": url,
            "target": destination,
            "state": state,
            **extra,
        }
        metadata.write_text(
            json.dumps(payload, indent=2) + "\n",
            encoding="utf-8",
        )

    write_metadata("downloading")

    try:
        bytes_downloaded = download(url, archive)
        write_metadata(
            "extracting",
            bytesDownloaded=bytes_downloaded,
        )

        extract_safely(archive, unpack)

        package_root = locate_package_root(
            unpack,
            archive_root,
        )
        shutil.copytree(package_root, candidate)
        verify_candidate(candidate, verification)

        write_metadata(
            "promoting",
            bytesDownloaded=bytes_downloaded,
        )

        target.parent.mkdir(parents=True, exist_ok=True)
        os.replace(candidate, target)

        result = {
            "operationId": operation_id,
            "bytesDownloaded": bytes_downloaded,
            "destination": destination,
        }

        shutil.rmtree(stage, ignore_errors=True)

        artifact_stage = (
            root / ".staging" / artifact_id
        )
        try:
            artifact_stage.rmdir()
        except OSError:
            pass

        print(json.dumps(result))
    except Exception as exc:
        try:
            write_metadata("failed", error=str(exc))
        except Exception:
            pass
        raise


if __name__ == "__main__":
    main()
