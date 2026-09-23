import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[2] / "tests" / "env_tests" / "smoke_check.py"
SPEC = importlib.util.spec_from_file_location("harmonia_smoke_check", MODULE_PATH)
smoke = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(smoke)


def test_normalize_windows_artifact_path_for_linux_workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(smoke, "ROOT", tmp_path)

    resolved = smoke.normalize_artifact_path(
        r"C:\repos\harmonia\models\facebook\musicgen\weights.bin"
    )

    assert resolved == (
        tmp_path / "models" / "facebook" / "musicgen" / "weights.bin"
    ).resolve()


def test_empty_lightweight_workspace_is_successful_skip(tmp_path, monkeypatch):
    models = tmp_path / "models"
    datasets = tmp_path / "datasets"
    reports = tmp_path / "reports"

    monkeypatch.setattr(smoke, "ROOT", tmp_path)
    monkeypatch.setattr(smoke, "MODELS_DIR", models)
    monkeypatch.setattr(smoke, "DATASETS_DIR", datasets)
    monkeypatch.setattr(smoke, "CHECKSUMS_FILE", models / "checksums.sha256")
    monkeypatch.setattr(smoke, "REPORT_DIR", reports)

    assert smoke.main() == 0

    generated = list(reports.glob("smoke_report_*.json"))
    assert len(generated) == 1

    payload = __import__("json").loads(generated[0].read_text(encoding="utf-8"))
    assert payload["summary"]["skipped"] is True
    assert payload["summary"]["total_files"] == 0
    assert payload["summary"]["has_recorded_checksums"] is False
