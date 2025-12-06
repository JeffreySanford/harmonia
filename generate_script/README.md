# Harmonia Generation Script System

This folder contains modular scripts for each phase of the Harmonia song generation pipeline. Each script is responsible for a single phase and logs detailed debug information about its inputs and outputs.

## Structure

- `main_generate.js`: Orchestrates the full pipeline, reading a metadata `.txt` file and calling each phase script in order.
- `phase_*.js`: Each phase (lyrics, vocals, instrumental, mixing, etc.) is a separate script.
- `debug/`: All debug logs and intermediate outputs are stored here for traceability.

## Usage

Run the main script with a metadata file:

```bash
node generate_script/main_generate.js path/to/metadata.txt
```

## Phases

- Lyrics Generation
- Vocal Synthesis
- Instrumental Generation
- Mixing
- Playback

Each phase logs its input, output, and any errors to `debug/` for easy debugging and reproducibility.
