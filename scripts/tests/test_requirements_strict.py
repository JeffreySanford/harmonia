import os

REQUIRED = ['torch', 'numpy', 'soundfile', 'librosa', 'lightning', 'pyyaml', 'requests', 'scipy']


def _read_lines(path):
    with open(path, 'r', encoding='utf-8') as f:
        return [l.strip() for l in f if l.strip() and not l.strip().startswith('#')]


def test_requirements_include_required():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    req_path = os.path.join(repo_root, 'requirements.txt')
    assert os.path.exists(req_path), f"Missing {req_path}"
    lines = _read_lines(req_path)
    lower = '\n'.join(lines).lower()
    missing = [p for p in REQUIRED if p.lower() not in lower]
    assert not missing, f"The following expected packages are missing from requirements.txt: {missing}"
