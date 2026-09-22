import os


def test_generic_worker_excludes_provider_specific_diffsinger_runtime():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    worker_path = os.path.join(repo_root, 'Dockerfile.worker')
    diffsinger_path = os.path.join(repo_root, 'Dockerfile.diffsinger')

    assert os.path.exists(worker_path), f"Missing {worker_path}"
    assert os.path.exists(diffsinger_path), f"Missing {diffsinger_path}"

    worker = open(worker_path, 'r', encoding='utf-8').read()
    diffsinger = open(diffsinger_path, 'r', encoding='utf-8').read()

    assert 'openvpi/DiffSinger' not in worker
    assert 'HiFi-GAN' not in worker
    assert 'requirements.worker.txt' in worker

    assert 'openvpi/DiffSinger' in diffsinger
    assert 'entrypoint.diffsinger.sh' in diffsinger
    assert 'torch' in diffsinger.lower()
