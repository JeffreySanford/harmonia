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

WORKSPACE = REPO_ROOT / "pnpm-workspace.yaml"


def workspace_override_version(spec: str) -> tuple[int, ...]:
    text = WORKSPACE.read_text(encoding="utf-8")

    match = re.search(
        rf"(?m)^  {re.escape(spec)}: ([0-9]+(?:\.[0-9]+)*)$",
        text,
    )

    assert match is not None, (
        f"missing security override {spec}"
    )

    return tuple(
        int(part)
        for part in match.group(1).split(".")
    )


def test_file_type_override_security_floor():
    # GHSA-5v7r-6r5c-r473 and GHSA-j47w-4g3g-c36v.
    assert workspace_override_version(
        "\x27file-type@>=20.0.0 <=21.3.1\x27"
    ) >= (21, 3, 2)


def test_fflate_override_security_floor():
    # GHSA-px8p-9vwx-vf98 / CVE-2026-45820.
    assert workspace_override_version(
        "\x27fflate@>=0.8.0 <0.8.3\x27"
    ) >= (0, 8, 3)


def test_body_parser_override_security_floor():
    # GHSA-v422-hmwv-36x6.
    assert workspace_override_version(
        "\x27body-parser@>=2.0.0 <2.3.0\x27"
    ) >= (2, 3, 0)

def test_bull_uuid_override_security_floor():
    # Bull 4.16.5 declares uuid ^8.3.0; GHSA requires uuid >= 11.1.1.
    assert workspace_override_version(
        "\x27bull@4.16.5>uuid\x27"
    ) >= (11, 1, 1)

def test_dev_build_security_override_floors():
    cases = [
        ("\x27@babel/core@7.28.5\x27", (7, 29, 6)),
        ("\x27@tootallnate/once@2.0.0\x27", (2, 0, 1)),
        ("\x27follow-redirects@1.15.11\x27", (1, 16, 0)),
        ("\x27http-proxy-middleware@2.0.9\x27", (2, 0, 10)),
        ("\x27postcss@>=8.0.0 <8.5.23\x27", (8, 5, 23)),
        ("\x27postcss-selector-parser@7.1.1\x27", (7, 1, 3)),
        ("\x27webpack@5.103.0\x27", (5, 104, 1)),
        ("\x27webpack-dev-server@5.2.2\x27", (5, 2, 6)),
        ("\x27ajv@6.12.6\x27", (6, 14, 0)),
        ("\x27ajv@8.17.1\x27", (8, 18, 0)),
        ("\x27yaml@1.10.2\x27", (1, 10, 3)),
        ("\x27yaml@2.8.2\x27", (2, 8, 3)),
        ("\x27body-parser@1.20.4\x27", (1, 20, 6)),
    ]

    for spec, floor in cases:
        assert workspace_override_version(spec) >= floor

def test_dev_uuid_parent_scoped_security_floors():
    cases = [
        ("\x27@storybook/test-runner@0.24.0>uuid\x27", (11, 1, 1)),
        ("\x27istanbul-lib-processinfo@2.0.3>uuid\x27", (11, 1, 1)),
        ("\x27jest-junit@16.0.0>uuid\x27", (11, 1, 1)),
        ("\x27sockjs@0.3.24>uuid\x27", (11, 1, 1)),
        ("\x27mongodb-memory-server-core@8.16.1>uuid\x27", (11, 1, 1)),
    ]

    for spec, floor in cases:
        assert workspace_override_version(spec) >= floor
