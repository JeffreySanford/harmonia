import os


def test_generic_worker_excludes_provider_specific_model_runtimes():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    worker_path = os.path.join(repo_root, 'Dockerfile.worker')
    diffsinger_path = os.path.join(repo_root, 'Dockerfile.diffsinger')
    musicgen_path = os.path.join(repo_root, 'Dockerfile.musicgen')

    for path in (worker_path, diffsinger_path, musicgen_path):
        assert os.path.exists(path), f"Missing {path}"

    worker = open(worker_path, 'r', encoding='utf-8').read()
    diffsinger = open(diffsinger_path, 'r', encoding='utf-8').read()
    musicgen = open(musicgen_path, 'r', encoding='utf-8').read()

    assert 'openvpi/DiffSinger' not in worker
    assert 'HiFi-GAN' not in worker
    assert 'audiocraft' not in worker.lower()
    assert 'torch' not in worker.lower()
    assert 'torchaudio' not in worker.lower()
    assert 'requirements.worker.txt' in worker

    assert 'openvpi/DiffSinger' in diffsinger
    assert 'entrypoint.diffsinger.sh' in diffsinger
    assert 'torch' in diffsinger.lower()

    assert 'python3.9' in musicgen
    assert 'torch==2.1.0' in musicgen
    assert 'audiocraft==1.3.0' in musicgen
    assert 'entrypoint.musicgen.sh' in musicgen
