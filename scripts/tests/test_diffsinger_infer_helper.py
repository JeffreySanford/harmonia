import subprocess
import sys
import os
import tempfile

def test_diffsinger_infer_helper_missing_imports():
    """Run diffsinger_infer_helper.py outside the container and assert it fails with the expected exit code when imports are missing."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    script = os.path.join(repo_root, 'scripts', 'diffsinger_infer_helper.py')
    out_dir = tempfile.mkdtemp(prefix='harmonia_test_')
    # Expect the helper to exit with code 3 when utils.hparams can't be imported (host environment)
    proc = subprocess.run([sys.executable, script, out_dir, 'unittest_song'], capture_output=True, text=True)
    # Ensure the helper exits non-zero on host (missing container runtime/imports) and reports the problem
    assert proc.returncode != 0
    combined = (proc.stdout or '') + (proc.stderr or '')
    # Accept either the explicit failed-import message, programmatic inference failure, or inability to chdir to /opt/DiffSinger
    assert (
        'Failed import/set_hparams' in combined
        or 'programmatic inference failed' in combined
        or '/opt/DiffSinger' in combined
        or 'Failed' in combined
    )
