// Main Orchestrator Script (TXT input)
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const phases = [
  'phase_lyrics.js',
  'phase_vocals.js',
  'phase_instrumental.js',
  'phase_mixing.js',
];

function logPhase(phase, status) {
  console.log(`[${new Date().toISOString()}] ${phase}: ${status}`);
}

function runPhase(phaseScript, metaFile) {
  logPhase(phaseScript, 'START');
  const result = spawnSync(
    'node',
    [path.join(__dirname, phaseScript), metaFile],
    {
      stdio: 'inherit',
    }
  );
  if (result.status !== 0) {
    logPhase(phaseScript, 'FAILED');
    process.exit(result.status);
  }
  logPhase(phaseScript, 'COMPLETE');
}

function parseTxtFile(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8').trim();
}

if (require.main === module) {
  // Usage: node main_generate_txt.js --narrative narrative.txt --lyrics lyrics.txt [--genre genre] [--duration seconds] [--vocalModel model]
  const args = process.argv.slice(2);
  let narrativeFile = '',
    lyricsFile = '',
    genre = 'pop',
    duration = 30,
    vocalModel = 'tts';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--narrative') narrativeFile = args[++i];
    else if (args[i] === '--lyrics') lyricsFile = args[++i];
    else if (args[i] === '--genre') genre = args[++i];
    else if (args[i] === '--duration') duration = parseInt(args[++i]);
    else if (args[i] === '--vocalModel') vocalModel = args[++i];
  }
  if (!narrativeFile || !lyricsFile)
    throw new Error('Must provide --narrative and --lyrics .txt files');
  const narrative = parseTxtFile(narrativeFile);
  const lyrics = parseTxtFile(lyricsFile);
  const metadata = {
    title: path.basename(lyricsFile, path.extname(lyricsFile)),
    narrative,
    lyrics,
    genre,
    duration,
    vocalSynthesisModel: vocalModel,
  };
  const tempMetaPath = path.join(__dirname, 'temp_metadata.json');
  fs.writeFileSync(tempMetaPath, JSON.stringify(metadata, null, 2));
  phases.forEach((phase) => runPhase(phase, tempMetaPath));
  console.log('All phases complete. See debug/ for details.');

  // List generated songs and sizes for debugging
  const songsDir = path.resolve(__dirname, '../generated/songs');
  try {
    if (fs.existsSync(songsDir)) {
      const all = fs
        .readdirSync(songsDir)
        .map((f) => {
          const p = path.join(songsDir, f);
          const stat = fs.statSync(p);
          return { file: f, size: stat.size, mtime: stat.mtime };
        })
        .sort((a, b) => b.mtime - a.mtime);
      console.log('Generated songs:');
      all.forEach((it) => console.log(` - ${it.file} (${it.size} bytes)`));
    } else {
      console.log('No generated songs directory found:', songsDir);
    }
  } catch (err) {
    console.log('Error listing generated songs:', err);
  }

  // Find and copy the most recent mixed song to Windows host
  let lastMix = null;
  try {
    const files = fs.existsSync(songsDir)
      ? fs
          .readdirSync(songsDir)
          .filter((f) => f.includes('mixed') && f.endsWith('.wav'))
          .map((f) => ({
            name: f,
            time: fs.statSync(path.join(songsDir, f)).mtime.getTime(),
          }))
          .sort((a, b) => b.time - a.time)
      : [];
    if (files.length > 0) {
      lastMix = path.join(songsDir, files[0].name);
      const winMusicDir = path.join(
        process.env.HOME || process.env.USERPROFILE,
        'Music',
        'HarmoniaSongs'
      );
      if (!fs.existsSync(winMusicDir))
        fs.mkdirSync(winMusicDir, { recursive: true });
      const destPath = path.join(winMusicDir, path.basename(lastMix));
      fs.copyFileSync(lastMix, destPath);
      console.log('Copied to', destPath);
      // Play using Windows default player (PowerShell)
      const winPath = destPath.replace(/\//g, '\\');
      spawnSync('powershell.exe', ['-Command', `Start-Process '${winPath}'`], {
        stdio: 'inherit',
      });
    } else {
      console.log('No mixed song found in', songsDir);
    }
  } catch (err) {
    console.log('Error copying or playing song:', err);
  }
  // Attempt to play the final audio (assume output path)
  const finalAudio = path.join(__dirname, 'debug', 'final_mix.wav');
  if (fs.existsSync(finalAudio)) {
    console.log('Playing final audio...');
    spawnSync('ffplay', ['-nodisp', '-autoexit', finalAudio], {
      stdio: 'inherit',
    });
  } else {
    console.log('Final audio file not found:', finalAudio);
  }
}
