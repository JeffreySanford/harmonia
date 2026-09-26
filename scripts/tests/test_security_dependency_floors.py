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


def package_json_dependency_version(package: str) -> tuple[int, ...]:
    import json

    package_json = REPO_ROOT / "package.json"
    data = json.loads(package_json.read_text(encoding="utf-8"))

    value = data.get("dependencies", {}).get(package)

    assert value is not None, (
        f"{package} must remain a production dependency"
    )

    match = re.fullmatch(
        r"[\^~]?([0-9]+(?:\.[0-9]+)*)",
        value,
    )

    assert match is not None, (
        f"{package} must use a simple semver security floor; got {value!r}"
    )

    return tuple(
        int(part)
        for part in match.group(1).split(".")
    )


def test_nestjs_core_security_floor():
    # GHSA-36xv-jgw5-4q75 requires @nestjs/core >= 11.1.18.
    assert package_json_dependency_version(
        "@nestjs/core"
    ) >= (11, 1, 18)


def test_mongoose_security_floor():
    # GHSA-664h-wqgq-64gw requires mongoose >= 7.8.10.
    assert package_json_dependency_version(
        "mongoose"
    ) >= (7, 8, 10)
