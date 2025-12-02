import subprocess
import json
import sys


def test_list_models():
    res = subprocess.run([sys.executable, 'scripts/musicgen_cli.py', 'list'], capture_output=True, text=True)
    assert res.returncode == 0
    out = res.stdout.strip()
    data = json.loads(out)
    assert 'models' in data
