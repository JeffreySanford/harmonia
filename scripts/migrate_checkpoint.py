#!/usr/bin/env python3
"""
Simple checkpoint migration helper for Harmonia DiffSinger checkpoint compatibility.
Usage: python3 scripts/migrate_checkpoint.py <input_ckpt> <output_ckpt>

If the input checkpoint appears to be an "old-style" state dict, this script
wraps it into the newer format expected by DiffSinger (adds 'category' and
ensures the state is under 'state_dict').
"""
import sys
import torch
from pathlib import Path


def migrate(input_path: Path, output_path: Path):
    ckpt = torch.load(input_path, map_location='cpu')
    # Heuristics: if it already has keys 'state_dict' and maybe 'category', assume new format
    if isinstance(ckpt, dict) and ('state_dict' in ckpt or 'model' in ckpt):
        print('Checkpoint already appears to be in new format; copying to output path')
        torch.save(ckpt, output_path)
        return 0

    # Otherwise assume it's a raw state_dict -> wrap
    print('Wrapping raw state_dict into new checkpoint format')
    wrapped = {
        'category': 'acoustic',
        'state_dict': ckpt if isinstance(ckpt, dict) else {},
        'meta': {'migrated_by': 'harmonia/migrate_checkpoint.py'}
    }
    torch.save(wrapped, output_path)
    print(f'Wrote migrated checkpoint to {output_path}')
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: migrate_checkpoint.py <input_ckpt> <output_ckpt>')
        sys.exit(2)
    inp = Path(sys.argv[1])
    out = Path(sys.argv[2])
    if not inp.exists():
        print('Input checkpoint not found:', inp)
        sys.exit(3)
    out.parent.mkdir(parents=True, exist_ok=True)
    sys.exit(migrate(inp, out))
