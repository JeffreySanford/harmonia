import os
import json
from scripts.diffsinger_helper import find_first_ckpt, copy_ckpt_to_dir, copy_companion_configs, convert_yaml_to_json_if_present


def test_find_first_ckpt_and_copy(tmp_path):
    # create a fake workspace structure
    p = tmp_path / 'models' / 'hifigan'
    p.mkdir(parents=True)
    ck = p / 'model_ckpt_steps_12345.ckpt'
    ck.write_text('fakeckpt')

    found = find_first_ckpt([str(p)])
    assert found is not None and found.endswith('.ckpt')

    dest = tmp_path / 'repo' / 'checkpoints' / 'hifigan'
    dest_path = copy_ckpt_to_dir(found, str(dest))
    assert os.path.exists(dest_path)
    assert os.path.basename(dest_path) == 'model_ckpt_steps_12345.ckpt'


def test_copy_companion_configs_and_convert(tmp_path):
    src = tmp_path / 'models' / 'hifigan'
    src.mkdir(parents=True)
    cfg = src / 'config.yaml'
    cfg.write_text('k: v')

    dest = tmp_path / 'repo' / 'checkpoints' / 'hifigan'
    copied = copy_companion_configs(str(src), str(dest))
    # config.yaml should have been copied
    assert any('config.yaml' in x for x in copied)

    # convert YAML to JSON
    created = convert_yaml_to_json_if_present(str(dest))
    # conversion may depend on pyyaml; if pyyaml not present, created can be None
    if created:
        assert os.path.exists(created)
        with open(created, 'r', encoding='utf-8') as f:
            data = json.load(f)
        assert 'k' in data
