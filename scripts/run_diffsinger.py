#!/usr/bin/env python3
"""
Simple DiffSinger wrapper for Harmonia.
Usage: python3 scripts/run_diffsinger.py <meta_json_path> <output_wav_path>

This script attempts to import DiffSinger and run a minimal inference.
If DiffSinger isn't available, it writes a placeholder WAV file with the lyrics text encoded as bytes.
"""
import json
import sys
import os
from pathlib import Path

def write_placeholder_wav(out_path, text):
    # Create a small placeholder binary file (not a valid WAV) but helps debugging
    with open(out_path, 'wb') as f:
        f.write(b"HARMONIA_DIFFSINGER_PLACEHOLDER\n")
        f.write(text.encode('utf-8'))


def run_diffsinger(meta_path, out_path):
    try:
        # Do not attempt to import heavy ML packages here; prefer invoking the
        # upstream `infer.py` script in /opt/DiffSinger when available.

        # Load metadata
        with open(meta_path, 'r', encoding='utf-8') as mf:
            meta = json.load(mf)

        lyrics = meta.get('lyrics', '')
        title = meta.get('title', 'song')

        # If the upstream cloned repo's infer script exists, prefer invoking it (best-effort).
        infer_script = '/opt/DiffSinger/scripts/infer.py'
        if os.path.isfile(infer_script):
            try:
                # If there are checkpoints in the workspace (models/diffsinger/*),
                # copy them into the cloned repo's checkpoints folder so infer.py
                # can find them by --exp.
                try:
                    import glob
                    workspace_ckpts = sorted(glob.glob('/workspace/models/diffsinger/*'))
                    if workspace_ckpts:
                        chk_dest_root = '/opt/DiffSinger/checkpoints'
                        os.makedirs(chk_dest_root, exist_ok=True)
                        import shutil
                        for src in workspace_ckpts:
                            base = os.path.basename(src.rstrip('/'))
                            dest = os.path.join(chk_dest_root, base)
                            if not os.path.exists(dest):
                                try:
                                    shutil.copytree(src, dest)
                                    print(f'Copied checkpoint {src} -> {dest}')
                                except Exception as e:
                                    print(f'Warning: failed to copy checkpoint {src} -> {dest}: {e}')
                except Exception as _:
                    pass

                # If the metadata provides an explicit command, run that. Otherwise run a dry-run help command to ensure infer is callable.
                import subprocess
                if meta.get('diffsinger_cmd'):
                    cmd = meta['diffsinger_cmd']
                    print('Running user-provided DiffSinger command:', cmd)
                    res = subprocess.run(cmd, shell=True)
                    if res.returncode == 0:
                        print('DiffSinger external command completed successfully.')
                        write_placeholder_wav(out_path, f'DiffSinger external command completed for: {title}\n\n(see container logs)')
                        return 0
                    else:
                        print('DiffSinger external command failed, falling back to placeholder.')
                else:
                    # Try calling infer.py acoustic with any checkpoint we copied. Use a sample .ds file
                    # from the cloned repo as an input to get a realistic exercise of the pipeline.
                    sample_ds = '/opt/DiffSinger/samples/03_撒娇八连.ds'
                    out_dir = os.path.dirname(out_path) or '/workspace/generated/songs'
                    # Prefer programmatic invocation to avoid CLI parsing differences.
                    try:
                        # Pre-migrate any old-format checkpoint found in the embedded folder.
                        ckpt_dir = '/opt/DiffSinger/checkpoints/0102_xiaoma_pe'
                        orig_ckpt = None
                        migrated_ckpt = None
                        try:
                            import glob
                            found = glob.glob(ckpt_dir + '/model_ckpt_steps_*.ckpt')
                            if found:
                                orig_ckpt = sorted(found)[-1]
                                migrated_ckpt = orig_ckpt.replace('.ckpt', '.migrated.ckpt')
                                if not os.path.exists(migrated_ckpt):
                                    print('Migrating checkpoint', orig_ckpt, '->', migrated_ckpt)
                                    try:
                                        subprocess.run(['python3', '/workspace/scripts/migrate_checkpoint.py', orig_ckpt, migrated_ckpt], check=True)
                                        print('Migration finished')
                                    except Exception as e:
                                        print('Checkpoint migration failed:', e)
                        except Exception:
                            pass

                        # Use a helper script (workspace) to run programmatic DiffSinger invocation
                        cmd = ['python3', '/workspace/scripts/diffsinger_infer_helper.py', out_dir, title]
                        print('Running programmatic DiffSinger helper:', cmd)
                        import time
                        ts = time.strftime('%Y%m%dT%H%M%S')
                        log_dir = '/workspace/generate_script/debug'
                        try:
                            os.makedirs(log_dir, exist_ok=True)
                        except Exception:
                            pass
                        log_file = os.path.join(log_dir, f'diffsinger_{ts}.log')
                        import shutil
                        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                        out, _ = proc.communicate()
                        try:
                            with open(log_file, 'wb') as lf:
                                lf.write(out or b'')
                        except Exception:
                            pass
                        res = proc
                        stdout = (out.decode('utf-8', errors='replace') if out else '')
                        stderr = ''
                        print('Program log saved to', log_file)
                        print('programmatic infer exit', res.returncode)
                        if res.returncode == 0:
                            try:
                                import glob
                                candidates = glob.glob(os.path.join(out_dir, '*.wav'))
                                if candidates:
                                    chosen = sorted(candidates)[-1]
                                    shutil.copy(chosen, out_path)
                                    print('DiffSinger: copied generated wav', chosen, '->', out_path)
                                    return 0
                            except Exception as e:
                                print('Error copying generated wav:', e)
                            write_placeholder_wav(out_path, f'DiffSinger ran but no output found. stdout:\n{stdout}\nstderr:\n{stderr}')
                            return 0
                        else:
                            print('Programmatic DiffSinger run failed. See log:', log_file)
                            print(stdout)
                    except Exception as e:
                        print('Programmatic DiffSinger invocation error:', e)
            except Exception as e:
                print('Error while attempting to run upstream infer.py:', e)

        # NOTE: This block is a placeholder. Real DiffSinger integration requires model checkpoints and proper API calls.
        write_placeholder_wav(out_path, f'DiffSinger synthesized (placeholder) for: {title}\n\n{lyrics}')
        print('DiffSinger: placeholder written to', out_path)
        return 0

    except Exception as e:
        print('Error running DiffSinger wrapper:', e)
        write_placeholder_wav(out_path, 'Error running DiffSinger: ' + str(e))
        return 2


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: run_diffsinger.py <meta_json_path> <output_wav_path>')
        sys.exit(3)
    meta_path = sys.argv[1]
    out_path = sys.argv[2]
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    code = run_diffsinger(meta_path, out_path)
    sys.exit(code)
