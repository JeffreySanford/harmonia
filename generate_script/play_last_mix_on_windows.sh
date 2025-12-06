#!/bin/bash
# Find the most recent mixed song and copy to Windows host, then play
set -e
src_dir="$(dirname "$0")/../generated/songs"
dest_dir="$HOME/Music/HarmoniaSongs"
mkdir -p "$dest_dir"
last_mix=$(ls -t "$src_dir"/*mixed*.wav | head -1)
cp "$last_mix" "$dest_dir/"
echo "Copied to $dest_dir/$(basename "$last_mix")"
# Play using Windows default player (powershell)
powershell.exe -Command "Start-Process '$(wslpath -w "$dest_dir/$(basename "$last_mix")")'"
