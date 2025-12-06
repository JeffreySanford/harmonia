import os


def _read_lines(path):
    with open(path, 'r', encoding='utf-8') as f:
        return [l.strip() for l in f if l.strip() and not l.strip().startswith('#')]


def test_requirements_contains_common_ml_packages():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    req_path = os.path.join(repo_root, 'requirements.txt')
    assert os.path.exists(req_path), f"Missing {req_path}"
    lines = _read_lines(req_path)

    # Check for likely required packages. These are heuristics — test ensures the file isn't empty
    assert len(lines) > 0, 'requirements.txt appears empty'
    # Look for a few important packages (torch, numpy, soundfile) but don't fail hard if absent
    hints = ['torch', 'numpy', 'soundfile', 'librosa', 'scipy']
    present = [h for h in hints if any(h in ln.lower() for ln in lines)]
    assert present, f'None of expected packages {hints} found in requirements.txt; found: {lines[:10]}'
