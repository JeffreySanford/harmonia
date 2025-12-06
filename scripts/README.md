# Song Generation Script

This script demonstrates the complete Harmonia song creation pipeline.

## Directory Structure

```bash
generated/
├── instruments/     # Individual instrument audio samples
│   ├── 2025-12-05T12-30-45_piano.wav
│   ├── 2025-12-05T12-30-50_guitar_acoustic.wav
│   └── ...
└── songs/          # Complete generated songs
    ├── 2025-12-05T12-30-45_Seagull_Serenade.wav
    └── ...
```

## Features

- **Timestamped Filenames**: Generated songs are saved with ISO timestamp prefixes (e.g., `2025-12-05T12-30-45_Seagull_Serenade.wav`)
- **Organized Storage**: Songs in `generated/songs/`, instruments in `generated/instruments/`
- **Secure Authentication**: Supports environment variables and command-line arguments
- **Comprehensive Logging**: Detailed progress tracking and error reporting
- **Docker Integration**: MusicGen audio generation via containerized services

## Scripts

### Song Generation

```bash
# Generate a complete song
node scripts/generate-and-play-song.js

# With custom parameters
node scripts/generate-and-play-song.js user@example.com password "A rock concert" 45 codellama:13b
```

### Bulk Instrument Generation

```bash
# Generate all supported instruments
node scripts/generate-instruments.js

# Show help
node scripts/generate-instruments.js --help
```

### Individual Instrument Generation

```bash
# Generate specific instrument via Docker
docker exec harmonia-worker bash -c "cd /workspace && python3 scripts/generate_musicgen_audio.py --instrument violin --duration 5"
```

## Security Notes

- Avoid passing passwords as command line arguments in production
- Use environment variables or secure credential management
- The script now supports both CLI args and environment variables for flexibility

## Debugging

MusicGen Docker process logs are now written to `logs/musicgen_*.log` files in the workspace for easier debugging.
