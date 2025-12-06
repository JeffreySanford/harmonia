#!/usr/bin/env python3
import json
import sys

out = {}
try:
    import torch
    out['torch'] = getattr(torch, '__version__', str(torch))
except Exception as e:
    out['torch_error'] = str(e)

try:
    import utils
    out['utils'] = 'ok'
except Exception as e:
    out['utils_error'] = str(e)

try:
    from utils.hparams import set_hparams, hparams
    cfg = '/opt/DiffSinger/checkpoints/0102_xiaoma_pe/config.yaml'
    try:
        set_hparams(config=cfg, exp_name='0102_xiaoma_pe', hparams_str='')
        out['hparams_sample'] = list(hparams.keys())[:10]
    except Exception as e:
        out['hparams_error'] = str(e)
except Exception as e:
    out['hparams_import_error'] = str(e)

print(json.dumps(out))
if any(k.endswith('_error') for k in out):
    sys.exit(1)
