#!/usr/bin/env python3
"""
MusicGen Audio Generation Script for Harmonia

This script generates audio for a specific instrument using MusicGen.
It takes instrument name, output file path, and duration as parameters.
"""
import argparse
import os
import sys
from pathlib import Path
from datetime import datetime

# Set temporary directory to avoid Windows path issues
os.environ['TMPDIR'] = '/tmp'
os.environ['TEMP'] = '/tmp'
os.environ['TMP'] = '/tmp'

# Monkey patch ALL temp file functions BEFORE importing audiocraft
import tempfile
original_named_temp = tempfile.NamedTemporaryFile
original_temp = tempfile.TemporaryFile
original_mkstemp = tempfile.mkstemp
original_mkdtemp = tempfile.mkdtemp

def patched_named_temp(*args, **kwargs):
    if 'dir' not in kwargs:
        kwargs['dir'] = '/tmp'
    return original_named_temp(*args, **kwargs)

def patched_temp(*args, **kwargs):
    if 'dir' not in kwargs:
        kwargs['dir'] = '/tmp'
    return original_temp(*args, **kwargs)

def patched_mkstemp(*args, **kwargs):
    if 'dir' not in kwargs:
        kwargs['dir'] = '/tmp'
    return original_mkstemp(*args, **kwargs)

def patched_mkdtemp(*args, **kwargs):
    if 'prefix' not in args and 'prefix' not in kwargs:
        kwargs['prefix'] = '/tmp/'
    return original_mkdtemp(*args, **kwargs)

# Monkey patch subprocess to fix ffmpeg calls
import subprocess
original_call = subprocess.call
original_run = subprocess.run
original_popen = subprocess.Popen

def patched_call(cmd, *args, **kwargs):
    print(f"Intercepted call: {cmd}")
    # Fix Windows paths in ffmpeg commands
    if isinstance(cmd, list) and len(cmd) > 0 and 'ffmpeg' in cmd[0]:
        print(f"Original ffmpeg cmd: {cmd}")
        cmd = [arg.replace('C:/Users/Sanford/AppData/Local/Temp/', '/tmp/') if isinstance(arg, str) else arg for arg in cmd]
        print(f"Patched ffmpeg cmd: {cmd}")
    return original_call(cmd, *args, **kwargs)

def patched_run(cmd, *args, **kwargs):
    if isinstance(cmd, list) and len(cmd) > 0 and 'ffmpeg' in cmd[0]:
        cmd = [arg.replace('C:/Users/Sanford/AppData/Local/Temp/', '/tmp/') if isinstance(arg, str) else arg for arg in cmd]
    return original_run(cmd, *args, **kwargs)

def patched_popen(cmd, *args, **kwargs):
    if isinstance(cmd, list) and len(cmd) > 0 and 'ffmpeg' in cmd[0]:
        cmd = [arg.replace('C:/Users/Sanford/AppData/Local/Temp/', '/tmp/') if isinstance(arg, str) else arg for arg in cmd]
    return original_popen(cmd, *args, **kwargs)

subprocess.call = patched_call
subprocess.run = patched_run
subprocess.Popen = patched_popen

# Now import audiocraft after the patch
from audiocraft.models import MusicGen
from audiocraft.data.audio import audio_write
import torch

def generate_instrument_audio(instrument: str, output_path: str, duration: int = 5) -> bool:
    print(f"DEBUG: generate_instrument_audio called with instrument='{instrument}', output_path='{output_path}', duration={duration}")
    try:
        print(f"Loading MusicGen model for {instrument}...")

        # Load a pre-trained MusicGen model (small for speed)
        model = MusicGen.get_pretrained('facebook/musicgen-small')

        # Set generation parameters
        model.set_generation_params(
            duration=duration,  # seconds
            temperature=1.0,
            top_k=250,
            top_p=0.0,
            cfg_coef=3.0,
            use_sampling=True,
        )

        # Create a descriptive prompt based on the instrument
        # Check if this is a vocal prompt (contains lyrics or singing)
        if 'vocal' in instrument.lower() or 'singing' in instrument.lower() or 'voice' in instrument.lower():
            # For vocals, use the instrument string directly as the prompt
            prompt = instrument
        else:
            # For instruments, look up in the dictionary
            instrument_prompts = {
                'piano': 'solo piano melody, classical, clean recording',
                'guitar_acoustic': 'acoustic guitar strumming, folk music, warm tones',
                'guitar_electric': 'electric guitar solo, rock music, distorted',
                'bass': 'upright bass walking line, jazz, warm and woody',
                'drums': 'drum kit groove, rock beat, energetic',
                'violin': 'violin solo, classical, expressive',
                'cello': 'cello solo, orchestral, rich and deep',
                'flute': 'flute melody, classical, pure and clear',
                'trumpet': 'trumpet solo, jazz, bright and brassy',
                'saxophone': 'saxophone solo, jazz, smooth and mellow',
                'clarinet': 'clarinet solo, classical, warm and reedy',
                'trombone': 'trombone solo, orchestral, powerful',
                'horn': 'french horn solo, orchestral, noble',
                'tuba': 'tuba solo, orchestral, deep and resonant',
                'cymbals': 'cymbal crashes, orchestral, shimmering',
                'timpani': 'timpani rolls, orchestral, thunderous',
                'bass_drum': 'bass drum hits, orchestral, powerful',
                'organ': 'pipe organ, classical, grand and resonant',
                'accordion': 'accordion melody, folk, lively',
                'celesta': 'celesta glissando, classical, tinkling',
                'marimba': 'marimba solo, contemporary, wooden tones',
                'male_voice': 'male vocal solo, classical, operatic',
                'female_voice': 'female vocal solo, classical, lyrical',
                'choir': 'choir singing, classical, harmonious',
                'synth_lead': 'synthesizer lead, electronic, bright',
                'synth_pad': 'synthesizer pad, ambient, lush',
                'bass_synth': 'synthesizer bass, electronic, deep',
                'drum_machine': 'electronic drum machine, techno, mechanical'
            }

            # Get the prompt for this instrument, or use a generic one
            prompt = instrument_prompts.get(instrument, f'{instrument} solo, musical instrument')

        print(f"Generating {duration}s of audio for {instrument} with prompt: '{prompt}'")

        # Generate the audio
        wav = model.generate([prompt], progress=True)

        print(f"Generated wav type: {type(wav)}, length: {len(wav)}")
        print(f"wav[0] type: {type(wav[0])}, shape: {wav[0].shape}, dtype: {wav[0].dtype}")

        # Save the audio directly using soundfile
        import soundfile as sf
        import numpy as np

        # Get the audio tensor and convert to numpy
        audio_tensor = wav[0]
        if hasattr(audio_tensor, 'cpu'):
            audio_tensor = audio_tensor.cpu()

        print(f"audio_tensor shape after cpu: {audio_tensor.shape}")

        # Convert to numpy array and ensure correct shape
        audio_data = audio_tensor.numpy()
        print(f"audio_data shape: {audio_data.shape}, dtype: {audio_data.dtype}")

        if len(audio_data.shape) == 1:
            audio_data = audio_data.reshape(1, -1)  # Add channel dimension if mono
        elif len(audio_data.shape) > 2:
            audio_data = audio_data.squeeze()  # Remove extra dimensions

        # Ensure it's 2D (channels, samples)
        if len(audio_data.shape) == 1:
            audio_data = audio_data.reshape(1, -1)

        print(f"audio_data final shape: {audio_data.shape}")

        # Normalize
        max_val = np.max(np.abs(audio_data))
        if max_val > 0:
            audio_data = audio_data / max_val

        # Convert to int16 for WAV format
        audio_data = (audio_data * 32767).astype(np.int16)

        # Transpose to (samples, channels) for soundfile
        audio_data = audio_data.T

        print(f"About to call sf.write with path: {repr(output_path)}")
        print(f"Current working directory: {os.getcwd()}")
        print(f"Absolute path: {os.path.abspath(output_path)}")

        # Write to a safe temp location first
        temp_path = f"/tmp/audio_{os.path.basename(output_path)}"
        print(f"Writing to safe temp path: {temp_path}")
        sf.write(temp_path, audio_data, model.sample_rate)

        if os.path.exists(temp_path):
            print(f"Temp file created successfully, size: {os.path.getsize(temp_path)}")
        else:
            print("Temp file was not created!")
            return False

        # Now copy to final location using shell command
        import subprocess
        try:
            result = subprocess.run(['cp', temp_path, output_path], check=True, capture_output=True, text=True)
            print(f"Shell copy completed successfully")
        except subprocess.CalledProcessError as e:
            print(f"Shell copy failed: {e}")
            print(f"stderr: {e.stderr}")
            return False

        # Verify the final file exists
        if os.path.exists(output_path):
            print(f"Final file created successfully, size: {os.path.getsize(output_path)}")
        else:
            print("Final file does not exist after copy!")
            return False

        print(f"Successfully generated audio for {instrument} at {output_path}")
        return True

    except Exception as e:
        print(f"Error generating audio for {instrument}: {e}", file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description="Generate instrument audio using MusicGen")
    parser.add_argument('--instrument', help='Instrument name')
    parser.add_argument('--instrument-file', help='File containing instrument name/description')
    parser.add_argument('--output', required=False, help='Output WAV file path (default: generated/instruments/)')
    parser.add_argument('--duration', type=int, default=5, help='Duration in seconds')

    args = parser.parse_args()

    # Ensure exactly one of --instrument or --instrument-file is provided
    if not args.instrument and not args.instrument_file:
        parser.error("Either --instrument or --instrument-file must be provided")
    if args.instrument and args.instrument_file:
        parser.error("Cannot specify both --instrument and --instrument-file")

    # Read instrument from file if specified
    if args.instrument_file:
        try:
            with open(args.instrument_file, 'r') as f:
                args.instrument = f.read().strip()
        except Exception as e:
            print(f"Error reading instrument file {args.instrument_file}: {e}", file=sys.stderr)
            return False

    print(f"Raw args.output: {repr(args.output)}")
    print(f"Current working directory: {os.getcwd()}")

    # Set default output path if not provided
    if not args.output:
        timestamp = datetime.now().strftime('%Y-%m-%dT%H-%M-%S')
        args.output = f'/workspace/generated/instruments/{timestamp}_{args.instrument}.wav'

    print(f"Final args.output: {repr(args.output)}")

    # Ensure output directory exists - force Linux path
    output_dir = os.path.dirname(args.output)
    print(f"os.path.dirname result: {repr(output_dir)}")

    if output_dir and output_dir != '/' and output_dir != '.':
        print(f"Attempting to create directory: {output_dir}")
        try:
            os.makedirs(output_dir, exist_ok=True)
            print(f"Directory creation successful")
        except Exception as e:
            print(f"Directory creation failed: {e}")
            # Try with absolute path
            abs_output_dir = os.path.abspath(output_dir)
            print(f"Trying absolute path: {abs_output_dir}")
            try:
                os.makedirs(abs_output_dir, exist_ok=True)
                args.output = os.path.join(abs_output_dir, os.path.basename(args.output))
                print(f"Used absolute path, new output: {args.output}")
            except Exception as e2:
                print(f"Absolute path creation also failed: {e2}")
    else:
        print(f"No directory creation needed for: {output_dir}")

    success = generate_instrument_audio(args.instrument, args.output, args.duration)

    if success:
        print(f"Audio generation completed: {args.output}")
        sys.exit(0)
    else:
        print(f"Audio generation failed for {args.instrument}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()