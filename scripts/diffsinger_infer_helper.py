#!/usr/bin/env python3
import os
import sys
import json
import pathlib
import subprocess
from typing import TYPE_CHECKING, Any, Callable, cast

# reuse helper utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))
try:
    from scripts.diffsinger_helper import find_first_ckpt, copy_ckpt_to_dir, copy_companion_configs, convert_yaml_to_json_if_present
except Exception:
    # If imports fail (running outside expected environment), fall back to local logic already present below
    find_first_ckpt = None
    copy_ckpt_to_dir = None
    copy_companion_configs = None
    convert_yaml_to_json_if_present = None

# args: out_dir, title
if len(sys.argv) < 3:
    print('Usage: diffsinger_infer_helper.py <out_dir> <title>')
    sys.exit(2)

out_dir = sys.argv[1]
title = sys.argv[2]

# ensure repo import path
sys.path.insert(0, '/opt/DiffSinger')

# run from repo root so includes resolve
os.chdir('/opt/DiffSinger')

if TYPE_CHECKING:
    # For type checkers (Pylance) import the names so diagnostics are satisfied.
    # These modules are available at runtime when running inside the worker container.
    from utils.hparams import set_hparams, hparams  # type: ignore
try:
    # Runtime import; may fail on host (outside container) which is handled below.
    from utils.hparams import set_hparams, hparams  # type: ignore
except Exception as e:
    print('Failed import/set_hparams:', e)
    sys.exit(3)

# load checkpoint config
cfg_path = '/opt/DiffSinger/checkpoints/0102_xiaoma_pe/config.yaml'
try:
    set_hparams(config=cfg_path, exp_name='0102_xiaoma_pe', hparams_str='')
except Exception as e:
    print('set_hparams failed:', e)
    # continue; hparams may be partially set

# map legacy vocoder name
if 'vocoder' in hparams and hparams['vocoder'] == 'pwg':
    hparams['vocoder'] = 'NsfHifiGAN'

# resolve vocoder ckpt path
vck = hparams.get('vocoder_ckpt', None)
if vck:
    candidate = os.path.join('/opt/DiffSinger/checkpoints', vck) if not os.path.isabs(vck) else vck
    print('Resolving vocoder candidate path:', candidate)
    try:
        exists = os.path.exists(candidate)
    except Exception as e:
        exists = False
        print('os.path.exists threw:', e)
    print('Candidate exists:', exists)
    if exists:
        try:
            st = os.stat(candidate)
            print('Candidate size:', st.st_size)
        except Exception as e:
            print('Failed to stat candidate:', e)
        # ensure absolute path is used by hparams (avoid relative ambiguity)
        if not os.path.isabs(vck):
            hparams['vocoder_ckpt'] = candidate
            print('Overwrote hparams["vocoder_ckpt"] with absolute path:', hparams['vocoder_ckpt'])
            # verify companion config exists in the checkpoints/hifigan dir; if missing, try workspace fallbacks/download
            dest_dir = os.path.join('/opt/DiffSinger/checkpoints', 'hifigan')
            cfg_found = False
            for cfg_name in ('config.json', 'config.yaml', 'config.yml', 'model_config.json', 'generator_config.json'):
                if os.path.exists(os.path.join(dest_dir, cfg_name)):
                    cfg_found = True
                    break
            if not cfg_found:
                print('Vocoder companion config not found in', dest_dir, '; attempting to find/download configs into /workspace/models/hifigan')
                try:
                    os.makedirs('/workspace/models/hifigan', exist_ok=True)
                    VOC_URL = 'https://github.com/MoonInTheRiver/DiffSinger/releases/download/pretrain-model/0109_hifigan_bigpopcs_hop128.zip'
                    zip_path = '/workspace/models/hifigan/0109_hifigan_bigpopcs_hop128.zip'
                    cmd = f"curl -L -o {zip_path} {VOC_URL} && unzip -o {zip_path} -d /workspace/models/hifigan"
                    print('Downloading vocoder into workspace models via shell:', cmd)
                    subprocess.run(cmd, shell=True, check=True)
                    # copy any config files from extracted area into dest_dir
                    for cfg_glob in ('config.json', 'config.yaml', 'config.yml', 'model_config.json', 'generator_config.json'):
                        for src_cfg in sorted(pathlib.Path('/workspace/models/hifigan').rglob(cfg_glob)):
                            try:
                                dst_cfg = os.path.join(dest_dir, os.path.basename(str(src_cfg)))
                                import shutil
                                if not os.path.exists(dst_cfg):
                                    shutil.copy(str(src_cfg), dst_cfg)
                                    print('Copied extracted vocoder config', src_cfg, '->', dst_cfg)
                                    cfg_found = True
                            except Exception:
                                pass
                    if cfg_found:
                        print('Successfully obtained vocoder companion config')
                except Exception as e:
                    print('Failed to download/extract vocoder configs:', e)
                # If only YAML config exists, create a JSON copy for loaders expecting config.json
                try:
                    dest_cfg_yaml = os.path.join(dest_dir, 'config.yaml')
                    dest_cfg_json = os.path.join(dest_dir, 'config.json')
                    if (not os.path.exists(dest_cfg_json)) and os.path.exists(dest_cfg_yaml):
                        try:
                            import yaml
                            with open(dest_cfg_yaml, 'r', encoding='utf-8') as yf:
                                ydata = yaml.safe_load(yf)
                            with open(dest_cfg_json, 'w', encoding='utf-8') as jf:
                                json.dump(ydata, jf)
                            print('Converted', dest_cfg_yaml, '->', dest_cfg_json)
                            cfg_found = True
                        except Exception as e:
                            print('Failed to convert YAML->JSON for vocoder config:', e)
                except Exception:
                    pass
    if not os.path.exists(candidate):
        print('Vocoder ckpt not found at', candidate, '— searching fallbacks...')
        found = None
        # prefer helper if available
        if find_first_ckpt is not None:
            found = find_first_ckpt(['/workspace/models/hifigan', '/workspace/models'])
        else:
            for root in ('/workspace/models/hifigan', '/workspace/models'):
                if os.path.isdir(root):
                    for p in sorted(pathlib.Path(root).rglob('*.ckpt')):
                        found = str(p)
                        break
                if found:
                    break
        if found:
            print('Using fallback vocoder checkpoint at', found)
            # Copy fallback into the cloned repo checkpoints location expected by hparams
            try:
                dest_dir = '/opt/DiffSinger/checkpoints/hifigan'
                os.makedirs(dest_dir, exist_ok=True)
                if copy_ckpt_to_dir is not None:
                    dest_path = copy_ckpt_to_dir(found, dest_dir)
                else:
                    dest_path = os.path.join(dest_dir, os.path.basename(found))
                    if not os.path.exists(dest_path):
                        import shutil
                        shutil.copy(found, dest_path)
                        print('Copied fallback vocoder ckpt to', dest_path)
                # copy companion configs
                try:
                    if copy_companion_configs is not None:
                        copied = copy_companion_configs(os.path.dirname(found), dest_dir)
                        if copied:
                            print('Copied companion configs:', copied)
                    else:
                        try:
                            src_dir = os.path.dirname(found)
                            for cfg_glob in ('config.json', 'config.yaml', 'config.yml', 'model_config.json'):
                                src_cfg = os.path.join(src_dir, cfg_glob)
                                if os.path.exists(src_cfg):
                                    dst_cfg = os.path.join(dest_dir, os.path.basename(src_cfg))
                                    if not os.path.exists(dst_cfg):
                                        import shutil
                                        shutil.copy(src_cfg, dst_cfg)
                                        print('Copied vocoder config', src_cfg, '->', dst_cfg)
                        except Exception:
                            pass
                except Exception as _:
                    pass
                # Point hparams to the absolute path inside the repo checkpoints
                hparams['vocoder_ckpt'] = dest_path
                print('Set hparams["vocoder_ckpt"] to absolute path:', hparams['vocoder_ckpt'])
            except Exception as e:
                print('Failed to copy fallback vocoder ckpt into repo checkpoints:', e)
        else:
            print('No fallback vocoder checkpoint found in /workspace/models; attempting runtime download into /workspace/models/hifigan...')
            try:
                os.makedirs('/workspace/models/hifigan', exist_ok=True)
                VOC_URL = 'https://github.com/MoonInTheRiver/DiffSinger/releases/download/pretrain-model/0109_hifigan_bigpopcs_hop128.zip'
                zip_path = '/workspace/models/hifigan/0109_hifigan_bigpopcs_hop128.zip'
                cmd = f"curl -L -o {zip_path} {VOC_URL} && unzip -o {zip_path} -d /workspace/models/hifigan"
                print('Downloading vocoder into workspace models via shell:', cmd)
                subprocess.run(cmd, shell=True, check=True)
                for p in sorted(pathlib.Path('/workspace/models/hifigan').rglob('*.ckpt')):
                    try:
                        # copy to repo checkpoints location as well for compatibility
                        dest_dir = '/opt/DiffSinger/checkpoints/hifigan'
                        os.makedirs(dest_dir, exist_ok=True)
                        import shutil
                        dest_path = os.path.join(dest_dir, os.path.basename(str(p)))
                        if not os.path.exists(dest_path):
                            shutil.copy(str(p), dest_path)
                            print('Copied downloaded vocoder ckpt to', dest_path)
                            # copy any companion config files that were extracted alongside the ckpt
                            try:
                                if copy_companion_configs is not None:
                                    copied = copy_companion_configs(os.path.dirname(str(p)), dest_dir)
                                    if copied:
                                        print('Copied downloaded companion configs:', copied)
                                else:
                                    src_dir = os.path.dirname(str(p))
                                    for cfg_glob in ('config.json', 'config.yaml', 'config.yml', 'model_config.json'):
                                        src_cfg = os.path.join(src_dir, cfg_glob)
                                        if os.path.exists(src_cfg):
                                            dst_cfg = os.path.join(dest_dir, os.path.basename(src_cfg))
                                            if not os.path.exists(dst_cfg):
                                                shutil.copy(src_cfg, dst_cfg)
                                                print('Copied downloaded vocoder config', src_cfg, '->', dst_cfg)
                            except Exception:
                                pass
                            # Use absolute path to avoid ambiguity in loaders
                            hparams['vocoder_ckpt'] = dest_path
                            print('Downloaded and using vocoder ckpt (absolute):', hparams['vocoder_ckpt'])
                    except Exception as _:
                        hparams['vocoder_ckpt'] = str(p)
                        print('Downloaded and using vocoder ckpt (abs):', hparams['vocoder_ckpt'])
                    break
            except Exception as e:
                print('Runtime vocoder download into workspace/models failed:', e)

# prepare params from sample project
proj = '/opt/DiffSinger/samples/03_撒娇八连.ds'
params = []
try:
    with open(proj, 'r', encoding='utf-8') as f:
        params = json.load(f)
    if not isinstance(params, list):
        params = [params]
except Exception as e:
    print('Failed to load sample ds project:', e)
    sys.exit(4)

# safety monkeypatches
try:
    # basics.base_module is only present in the cloned DiffSinger repo at runtime.
    import basics.base_module as bm  # type: ignore
    def _patched_check_category(self, category):
        if category is None:
            print('Warning: checkpoint category missing; proceeding with old-format checkpoint.')
            return
        if category != self.category:
            raise RuntimeError('Category mismatches!')
    bm.CategorizedModule.check_category = _patched_check_category
except Exception as e:
    print('Failed to monkeypatch CategorizedModule:', e)

try:
    import importlib
    utils_mod = importlib.import_module('utils')  # type: ignore
    orig_load = getattr(utils_mod, 'load_ckpt', None)
    if orig_load is not None:
        # Cast to a callable to satisfy static checkers
        orig_load_fn = cast(Callable[..., Any], orig_load)
        def _loose_load_ckpt(cur_model, ckpt_base_dir, ckpt_steps=None, prefix_in_ckpt='model', strict=True, device='cpu'):
            return orig_load_fn(cur_model, ckpt_base_dir, ckpt_steps=ckpt_steps, prefix_in_ckpt=prefix_in_ckpt, strict=False, device=device)
        # Assign via setattr to avoid ModuleType attribute diagnostics
        setattr(utils_mod, 'load_ckpt', _loose_load_ckpt)
except Exception as e:
    print('Failed to monkeypatch load_ckpt:', e)

# run inference
try:
    # Importing inference.ds_acoustic is only possible inside the cloned DiffSinger repo at runtime.
    from inference.ds_acoustic import DiffSingerAcousticInfer  # type: ignore
    infer_ins = DiffSingerAcousticInfer(load_vocoder=True, ckpt_steps=None)
    infer_ins.run_inference(params, out_dir=pathlib.Path(out_dir), title=title, num_runs=1)
except Exception as e:
    print('DiffSinger programmatic inference failed:', e)
    sys.exit(5)

print('DiffSinger inference completed successfully')
sys.exit(0)
