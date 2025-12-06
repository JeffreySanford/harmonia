import os


def test_dockerfile_worker_contains_expected_steps():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    df_path = os.path.join(repo_root, 'Dockerfile.worker')
    assert os.path.exists(df_path), f"Missing {df_path}"
    txt = open(df_path, 'r', encoding='utf-8').read()

    # Check for clone of DiffSinger and python install/pip
    assert 'DiffSinger' in txt or 'diffsinger' in txt.lower(), 'Dockerfile.worker should reference DiffSinger clone'
    assert 'python' in txt.lower(), 'Dockerfile.worker should install or reference Python'
    # Check for pip install or requirements install
    assert 'pip' in txt.lower() or 'requirements' in txt.lower(), 'Dockerfile.worker should install python packages (pip/requirements)'
    # Check for unzip/curl which we use for vocoder download
    assert 'unzip' in txt.lower() or 'curl' in txt.lower(), 'Dockerfile.worker should include unzip or curl for vocoder handling'
