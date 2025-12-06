import os
import shutil
import pathlib
import json
from typing import List, Optional

KNOWN_CONFIG_NAMES = ('config.json', 'config.yaml', 'config.yml', 'model_config.json', 'generator_config.json')


def find_first_ckpt(search_paths: List[str]) -> Optional[str]:
    """Search the provided paths for the first *.ckpt file and return its absolute path."""
    for root in search_paths:
        if not root:
            continue
        p = pathlib.Path(root)
        if not p.exists():
            continue
        for ck in sorted(p.rglob('*.ckpt')):
            return str(ck)
    return None


def copy_ckpt_to_dir(src_ckpt: str, dest_dir: str) -> str:
    """Copy a checkpoint file to dest_dir and return the dest path."""
    os.makedirs(dest_dir, exist_ok=True)
    dst = os.path.join(dest_dir, os.path.basename(src_ckpt))
    if os.path.abspath(src_ckpt) != os.path.abspath(dst):
        shutil.copy(src_ckpt, dst)
    return dst


def copy_companion_configs(src_dir: str, dest_dir: str) -> List[str]:
    """Copy known companion config files from src_dir into dest_dir. Returns list of copied files."""
    shipped = []
    if not os.path.isdir(src_dir):
        return shipped
    os.makedirs(dest_dir, exist_ok=True)
    for name in KNOWN_CONFIG_NAMES:
        src = os.path.join(src_dir, name)
        if os.path.exists(src):
            dst = os.path.join(dest_dir, os.path.basename(src))
            if not os.path.exists(dst):
                shutil.copy(src, dst)
            shipped.append(dst)
    return shipped


def convert_yaml_to_json_if_present(dest_dir: str) -> Optional[str]:
    """If a YAML config exists in dest_dir and no config.json exists, attempt to convert it to JSON and
    write config.json. Returns path to created json or None."""
    yaml_path = os.path.join(dest_dir, 'config.yaml')
    json_path = os.path.join(dest_dir, 'config.json')
    if os.path.exists(json_path):
        return json_path
    if os.path.exists(yaml_path):
        try:
            import yaml
            with open(yaml_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f)
            return json_path
        except Exception:
            return None
    return None
