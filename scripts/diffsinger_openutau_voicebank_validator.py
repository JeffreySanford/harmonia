#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path

import yaml


CONFIG_SPECS = {
    "dsconfig.yaml": {
        "required": [
            "acoustic",
            "phonemes",
        ],
        "file_keys": [
            "acoustic",
            "phonemes",
            "languages",
        ],
    },
    "dsdur/dsconfig.yaml": {
        "required": [
            "linguistic",
            "dur",
        ],
        "file_keys": [
            "linguistic",
            "dur",
            "phonemes",
            "languages",
        ],
    },
    "dspitch/dsconfig.yaml": {
        "required": [
            "linguistic",
            "pitch",
            "sample_rate",
            "hop_size",
        ],
        "file_keys": [
            "linguistic",
            "pitch",
            "phonemes",
            "languages",
        ],
    },
    "dsvariance/dsconfig.yaml": {
        "required": [
            "linguistic",
            "variance",
            "sample_rate",
            "hop_size",
        ],
        "file_keys": [
            "linguistic",
            "variance",
            "phonemes",
            "languages",
        ],
    },
    "dsvocoder/vocoder.yaml": {
        "required": [
            "name",
            "model",
            "sample_rate",
            "hop_size",
            "win_size",
            "fft_size",
            "num_mel_bins",
            "mel_fmin",
            "mel_fmax",
            "mel_base",
            "mel_scale",
        ],
        "file_keys": [
            "model",
        ],
    },
}


def inside_root(root: Path, path: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def load_yaml(path: Path):
    with path.open(
        "r",
        encoding="utf-8",
    ) as handle:
        value = yaml.safe_load(handle)

    if not isinstance(value, dict):
        raise ValueError(
            f"{path} must contain a YAML mapping"
        )

    return value


def validate_voicebank(root: Path):
    root = root.resolve()

    failures = []
    warnings = []
    configs = {}
    speakers = set()
    referenced_files = []

    if not root.exists():
        failures.append(
            f"voicebank directory does not exist: {root}"
        )

        return {
            "voicebank": str(root),
            "valid": False,
            "failures": failures,
            "warnings": warnings,
            "speakers": [],
            "mandarinAssets": [],
            "referencedFiles": [],
        }

    if not root.is_dir():
        failures.append(
            f"voicebank path is not a directory: {root}"
        )

        return {
            "voicebank": str(root),
            "valid": False,
            "failures": failures,
            "warnings": warnings,
            "speakers": [],
            "mandarinAssets": [],
            "referencedFiles": [],
        }

    for relative, spec in CONFIG_SPECS.items():
        config_path = root / relative

        if not config_path.is_file():
            failures.append(
                f"missing required config: {relative}"
            )
            continue

        try:
            config = load_yaml(config_path)
        except Exception as error:
            failures.append(
                f"cannot parse {relative}: {error}"
            )
            continue

        configs[relative] = config

        for key in spec["required"]:
            if key not in config:
                failures.append(
                    f"{relative}: missing required key '{key}'"
                )

        raw_speakers = config.get(
            "speakers",
            [],
        )

        if raw_speakers is not None:
            if not isinstance(
                raw_speakers,
                list,
            ):
                failures.append(
                    f"{relative}: speakers must be a list"
                )
            else:
                for speaker in raw_speakers:
                    if isinstance(
                        speaker,
                        str,
                    ) and speaker.strip():
                        speakers.add(
                            speaker.strip()
                        )
                    else:
                        failures.append(
                            f"{relative}: invalid speaker entry {speaker!r}"
                        )

        for key in spec["file_keys"]:
            value = config.get(key)

            if value is None:
                continue

            if not isinstance(
                value,
                str,
            ) or not value.strip():
                failures.append(
                    f"{relative}: '{key}' must be a non-empty relative path"
                )
                continue

            config_dir = config_path.parent

            target = (
                config_dir /
                value
            ).resolve()

            if not inside_root(
                root,
                target,
            ):
                failures.append(
                    f"{relative}: '{key}' escapes voicebank root: {value}"
                )
                continue

            target_relative = str(
                target.relative_to(root)
            ).replace(
                "\\",
                "/",
            )

            referenced_files.append(
                target_relative
            )

            if not target.is_file():
                failures.append(
                    f"{relative}: referenced file missing for '{key}': {target_relative}"
                )
                continue

            if target.stat().st_size <= 0:
                failures.append(
                    f"{relative}: referenced file is empty for '{key}': {target_relative}"
                )

        for speaker in raw_speakers or []:
            if not isinstance(
                speaker,
                str,
            ):
                continue

            embed = (
                config_path.parent /
                f"{speaker}.emb"
            ).resolve()

            if not inside_root(
                root,
                embed,
            ):
                failures.append(
                    f"{relative}: speaker embedding escapes root: {speaker}"
                )
                continue

            embed_relative = str(
                embed.relative_to(root)
            ).replace(
                "\\",
                "/",
            )

            referenced_files.append(
                embed_relative
            )

            if not embed.is_file():
                failures.append(
                    f"{relative}: missing speaker embedding: {embed_relative}"
                )
            elif embed.stat().st_size <= 0:
                failures.append(
                    f"{relative}: empty speaker embedding: {embed_relative}"
                )

    mandarin_assets = sorted({
        str(path.relative_to(root)).replace(
            "\\",
            "/",
        )
        for path in root.rglob("*")
        if (
            path.is_file()
            and (
                path.name.lower() ==
                "dsdict-zh.yaml"
                or
                "zh" in path.name.lower()
                and path.suffix.lower()
                in {
                    ".yaml",
                    ".yml",
                    ".json",
                    ".txt",
                }
            )
        )
    })

    character_yaml = (
        root /
        "character.yaml"
    )

    character_txt = (
        root /
        "character.txt"
    )

    if not character_yaml.is_file():
        warnings.append(
            "character.yaml is not present"
        )

    if not character_txt.is_file():
        warnings.append(
            "character.txt is not present"
        )

    if not mandarin_assets:
        warnings.append(
            "no obvious Mandarin dictionary/language asset was detected"
        )

    sample_rates = {}

    for relative, config in configs.items():
        sample_rate = config.get(
            "sample_rate"
        )

        if isinstance(
            sample_rate,
            int,
        ):
            sample_rates[
                relative
            ] = sample_rate

    result = {
        "voicebank": str(root),
        "valid":
            len(failures) == 0,
        "configsFound":
            sorted(
                configs.keys()
            ),
        "speakers":
            sorted(speakers),
        "mandarinAssets":
            mandarin_assets,
        "sampleRates":
            sample_rates,
        "referencedFiles":
            sorted(
                set(
                    referenced_files
                )
            ),
        "warnings":
            warnings,
        "failures":
            failures,
    }

    return result


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Validate the structural files expected by "
            "Harmonia's planned diffsinger-utau voicebank runtime."
        )
    )

    parser.add_argument(
        "voicebank",
        type=Path,
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON.",
    )

    args = parser.parse_args()

    result = validate_voicebank(
        args.voicebank
    )

    if args.json:
        print(
            json.dumps(
                result,
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print(
            f"voicebank={result['voicebank']}"
        )

        print(
            f"valid={result['valid']}"
        )

        print(
            "speakers=" +
            ",".join(
                result.get(
                    "speakers",
                    [],
                )
            )
        )

        for warning in result.get(
            "warnings",
            [],
        ):
            print(
                f"WARNING: {warning}"
            )

        for failure in result.get(
            "failures",
            [],
        ):
            print(
                f"ERROR: {failure}"
            )

    if not result["valid"]:
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
