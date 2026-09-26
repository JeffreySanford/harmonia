from pathlib import Path
import re


REPO_ROOT = Path(__file__).resolve().parents[2]
REQUIREMENTS = REPO_ROOT / "requirements.txt"


def requirement_version(package: str) -> tuple[int, ...]:
    text = REQUIREMENTS.read_text(encoding="utf-8")

    match = re.search(
        rf"(?m)^{re.escape(package)}==([0-9]+(?:\.[0-9]+)*)$",
        text,
    )

    assert match is not None, (
        f"{package} must remain exactly pinned in requirements.txt"
    )

    return tuple(int(part) for part in match.group(1).split("."))


def test_lightning_security_floor():
    """
    Security floor covers:

    GHSA-mr7h-w2qc-ffc2
    GHSA-cgwc-qvrx-rf7f
    GHSA-qqmf-gpg7-g8gw

    The newest of those advisories requires Lightning >= 2.6.6.
    """
    assert requirement_version("lightning") >= (2, 6, 6)
