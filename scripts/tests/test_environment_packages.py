import os
import pytest

# This test attempts to import runtime packages. It is skipped by default unless
# the environment variable RUN_ENV_IMPORTS is set (set to '1' to enable).
RUNTIME_PACKAGES = ['torch', 'numpy', 'soundfile', 'librosa', 'scipy', 'yaml', 'requests']


@pytest.mark.skipif(os.environ.get('RUN_ENV_IMPORTS') != '1', reason='Enable by setting RUN_ENV_IMPORTS=1')
def test_runtime_packages_importable():
    missing = []
    for p in RUNTIME_PACKAGES:
        try:
            __import__(p)
        except Exception:
            missing.append(p)
    assert not missing, f"Missing runtime imports: {missing}"
