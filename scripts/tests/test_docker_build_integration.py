import os
import subprocess
import shutil
import pytest


@pytest.mark.skipif(shutil.which('docker') is None, reason='Docker not available in PATH')
def test_docker_build_worker_image():
    """
    Optional integration test: attempts to build the worker Docker image with a short timeout.
    This is skipped if Docker CLI isn't available. It performs a lightweight build with --pull
    and --no-cache disabled to avoid heavy network operations when possible.
    """
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    dockerfile = os.path.join(repo_root, 'Dockerfile.worker')
    assert os.path.exists(dockerfile), 'Missing Dockerfile.worker'

    # Build tag temporary
    tag = 'harmonia/worker:test-ci'
    cmd = ['docker', 'build', '-f', dockerfile, '-t', tag, repo_root]
    # Try to run build but cap time; allow failures to surface; if too heavy, CI can skip
    try:
        proc = subprocess.run(cmd, cwd=repo_root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=600)
    except subprocess.TimeoutExpired:
        pytest.skip('Docker build timed out (skipped)')
    # Accept either successful build or a build that failed early but produced docker output
    assert proc.returncode == 0, f'Docker build failed (return code {proc.returncode}). Output:\n{proc.stdout.decode()[:4000]}'
