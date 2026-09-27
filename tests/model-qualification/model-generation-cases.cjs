'use strict';

/*
 * Harmonia real-generation qualification cases.
 *
 * smoke:
 *   one representative real generation per runnable model tier.
 *
 * deep:
 *   smoke cases plus a second deliberately contrasting generation
 *   per tier to exercise more of each provider's conditioning surface.
 *
 * All lyrics below are original qualification text written for Harmonia.
 */

const cases = [
  // ============================================================
  // MUSICGEN SMALL
  // ============================================================

  {
    id: 'musicgen-small-granite-skyline',
    profile: 'smoke',
    modelId: 'musicgen-small',
    title: 'Granite Skyline',
    purpose:
      'Fast mono MusicGen baseline with rhythm, guitar, bass, drums and dynamic build.',
    parameters: {
      title: 'Granite Skyline',
      prompt:
        'driving alternative rock instrumental, 116 BPM, tight palm-muted electric guitar, warm melodic bass, punchy live drums, subtle analog synth undercurrent, restrained verse energy rising into a memorable instrumental hook, no vocals, clean modern production',
      duration: 12,
      genre: 'Alternative Rock',
      mood: 'Determined, energetic, open',
      bpm: 116,
      instruments: [
        'electric guitar',
        'bass',
        'drums',
        'analog synth',
      ],
      vocalsStyle: 'instrumental',
    },
    expect: {
      minDurationRatio: 0.9,
      sampleRate: 32000,
    },
  },

  {
    id: 'musicgen-small-paper-constellations',
    profile: 'deep',
    modelId: 'musicgen-small',
    title: 'Paper Constellations',
    purpose:
      'Contrasting sparse MusicGen prompt with acoustic and chamber-electronic texture.',
    parameters: {
      title: 'Paper Constellations',
      prompt:
        'delicate chamber electronic instrumental, 82 BPM, fingerpicked acoustic guitar, intimate felt piano, soft cello harmonics, brushed percussion, faint granular synthesizer, spacious pauses, fragile reflective mood, no vocals, minimal natural production',
      duration: 12,
      genre: 'Chamber Electronic',
      mood: 'Reflective, intimate, weightless',
      bpm: 82,
      instruments: [
        'acoustic guitar',
        'felt piano',
        'cello',
        'brushed percussion',
        'granular synth',
      ],
      vocalsStyle: 'instrumental',
    },
    expect: {
      minDurationRatio: 0.9,
      sampleRate: 32000,
    },
  },

  // ============================================================
  // MUSICGEN STEREO SMALL
  // ============================================================

  {
    id: 'musicgen-stereo-small-glass-horizon',
    profile: 'smoke',
    modelId: 'musicgen-stereo-small',
    title: 'Glass Horizon',
    purpose:
      'Explicit stereo placement and wide ambience qualification.',
    parameters: {
      title: 'Glass Horizon',
      prompt:
        'wide cinematic indie electronic instrumental, 108 BPM, shimmering electric guitar echoes spread left and right, analog synth pads across a broad stereo field, centered warm bass, restrained live drums, distant reverse textures, expansive night-drive atmosphere, no vocals, polished spacious stereo mix',
      duration: 12,
      genre: 'Indie Electronic',
      mood: 'Nocturnal, expansive, hopeful',
      bpm: 108,
      instruments: [
        'stereo electric guitars',
        'analog synth pads',
        'bass',
        'drums',
      ],
      vocalsStyle: 'instrumental',
    },
    expect: {
      minDurationRatio: 0.9,
      channels: 2,
      sampleRate: 32000,
    },
  },

  {
    id: 'musicgen-stereo-small-neon-river',
    profile: 'deep',
    modelId: 'musicgen-stereo-small',
    title: 'Neon River',
    purpose:
      'Contrasting rhythmic stereo case with explicit moving percussion and synth placement.',
    parameters: {
      title: 'Neon River',
      prompt:
        'stereo electro-funk instrumental, 124 BPM, syncopated electric bass centered, crisp kick and snare, percussion moving across the stereo field, bright clavinet on the left, answering synth plucks on the right, short brass-like synth accents, energetic but controlled, no vocals, detailed wide mix',
      duration: 12,
      genre: 'Electro Funk',
      mood: 'Agile, bright, playful',
      bpm: 124,
      instruments: [
        'electric bass',
        'drums',
        'percussion',
        'clavinet',
        'synth',
      ],
      vocalsStyle: 'instrumental',
    },
    expect: {
      minDurationRatio: 0.9,
      channels: 2,
      sampleRate: 32000,
    },
  },

  // ============================================================
  // DIFFSINGER + HIFIGAN
  // ============================================================

  {
    id: 'diffsinger-northbound-score',
    profile: 'smoke',
    modelId: 'diffsinger-acoustic-hifigan',
    title: 'Northbound Score',
    purpose:
      'Known-good OpenCpop word-level Mandarin score with rests and pitch movement.',
    parameters: {
      title: 'Northbound Score',
      text: 'SP向北走过长夜里SP晨光照亮前方路',
      notes:
        'rest|C4|C4|G4|G4|A4|A4|G4|rest|F4|F4|E4|E4|D4|D4|C4',
      notesDuration:
        '1|0.5|0.5|0.5|0.5|0.5|0.5|0.75|0.25|0.5|0.5|0.5|0.5|0.5|0.5|0.75',
      inputType: 'word',
    },
    expect: {
      minDurationRatio: 0.9,
    },
  },

  {
    id: 'diffsinger-starlight-score',
    profile: 'deep',
    modelId: 'diffsinger-acoustic-hifigan',
    title: 'Starlight Score',
    purpose:
      'Second score-native contour using the OpenCpop-style example text and longer held notes.',
    parameters: {
      title: 'Starlight Score',
      text: 'SP一闪一闪亮晶晶SP满天都是小星星',
      notes:
        'rest|C4|C4|G4|G4|A4|A4|G4|rest|F4|F4|E4|E4|D4|D4|C4',
      notesDuration:
        '0.75|0.4|0.4|0.55|0.55|0.55|0.55|0.9|0.25|0.45|0.45|0.45|0.45|0.55|0.55|1.0',
      inputType: 'word',
    },
    expect: {
      minDurationRatio: 0.9,
    },
  },

  {
    id: 'diffsinger-dusk-drums-opera',
    profile: 'manual',
    modelId: 'diffsinger-acoustic-hifigan',
    title: '暮鼓关山 / Dusk Drums at the Pass',
    purpose:
      'Manual 30-second Chinese-opera-inspired score experiment with long held phrases and dramatic contour. The pinned OpenCpop checkpoint has no speaker/age selector, so older-male timbre is intentionally not asserted.',
    parameters: {
      title: 'Dusk Drums at the Pass',
      text: 'SP暮鼓穿云过古城SP长风卷雪照关山',
      notes:
        'rest|C3|G3|A3|G3|E3|D3|C3|rest|D3|G3|A3|G3|E3|D3|C3',
      notesDuration:
        '1|1.5|2|2.5|2|2|2|2.5|0.5|1.5|2|2.5|2|2|2|2',
      inputType: 'word',
    },
    expect: {
      minDurationRatio: 0.9,
    },
  },
  // ============================================================
  // STABLE AUDIO 3 SMALL MUSIC
  // ============================================================

  {
    id: 'stable-audio-signal-bloom',
    profile: 'smoke',
    modelId: 'stable-audio-3-small-music',
    title: 'Signal Bloom',
    purpose:
      '44.1 kHz stereo float instrumental with gradual cinematic development.',
    parameters: {
      title: 'Signal Bloom',
      prompt:
        'cinematic electronic post-rock instrumental, 112 BPM, warm analog arpeggiator, deep rounded bass, atmospheric electric guitar swells, crisp restrained drums, subtle low strings, gradual build from sparse opening to luminous final section, no vocals, polished spacious stereo master',
      duration: 15,
      genre: 'Cinematic Electronic Post-Rock',
      mood: 'Luminous, patient, uplifting',
      bpm: 112,
      instruments: [
        'analog arpeggiator',
        'bass',
        'electric guitar',
        'drums',
        'strings',
      ],
      vocalsStyle: 'instrumental',
    },
    expect: {
      minDurationRatio: 0.9,
      channels: 2,
      sampleRate: 44100,
      audioFormat: 3,
    },
  },

  {
    id: 'stable-audio-foundry-snow',
    profile: 'deep',
    modelId: 'stable-audio-3-small-music',
    title: 'Foundry Snow',
    purpose:
      'Contrasting dark industrial ambient/percussive Stable Audio conditioning.',
    parameters: {
      title: 'Foundry Snow',
      prompt:
        'dark industrial ambient instrumental, 94 BPM, deep metallic percussion, distant machine pulses, bowed low strings, granular frozen textures, sparse sub bass, long cold reverberation, slowly increasing rhythmic density, no vocals, highly detailed wide stereo sound design',
      duration: 15,
      genre: 'Industrial Ambient',
      mood: 'Cold, mysterious, tense',
      bpm: 94,
      instruments: [
        'metallic percussion',
        'low strings',
        'granular textures',
        'sub bass',
      ],
      vocalsStyle: 'instrumental',
    },
    expect: {
      minDurationRatio: 0.9,
      channels: 2,
      sampleRate: 44100,
      audioFormat: 3,
    },
  },

  // ============================================================
  // ACE-STEP 1.5 TURBO + 0.6B LM
  // ============================================================

  {
    id: 'ace-step-miles-of-light',
    profile: 'smoke',
    modelId: 'acestep-v15-turbo-06b',
    title: 'Miles of Light',
    purpose:
      'English supplied-lyrics full-song qualification with explicit style, BPM and deterministic seed.',
    parameters: {
      title: 'Miles of Light',
      prompt:
        'uplifting alternative rock with Americana undertones, 116 BPM, warm clean lead vocal, electric guitar, acoustic guitar texture, melodic bass, steady live drums, subtle atmospheric synth, intimate verse opening into a broad memorable chorus, resilient rather than triumphant, polished modern stereo production',
      lyrics:
        '[Verse]\nMorning lays a line across the road\nQuiet miles beneath the weight we hold\nEvery marker fades behind our wheels\nStill we move by what the compass feels\n\n[Pre-Chorus]\nWhen the clouds erase the distant signs\nWe keep one steady bearing in our minds\n\n[Chorus]\nMiles of light are opening ahead\nPast the words we feared and never said\nKeep the true line running through the night\nWe are moving into miles of light',
      duration: 30,
      bpm: 116,
      vocalLanguage: 'en',
      seed: 26092601,
    },
    expect: {
      minDurationRatio: 0.9,
      lyricsPreserved: true,
    },
  },

  {
    id: 'ace-step-rumbo-al-norte',
    profile: 'deep',
    modelId: 'acestep-v15-turbo-06b',
    title: 'Rumbo al Norte',
    purpose:
      'Spanish supplied-lyrics case testing vocal-language conditioning and a different musical style.',
    parameters: {
      title: 'Rumbo al Norte',
      prompt:
        'warm modern Latin indie folk pop, 104 BPM, expressive clean Spanish vocal, nylon acoustic guitar, muted electric guitar, melodic bass, organic drums and hand percussion, subtle atmospheric synthesizer, intimate verses, open emotional chorus, natural spacious stereo production',
      lyrics:
        '[Verso]\nCruza la mañana sobre el campo gris\nGuardo una señal que sigue dentro de mí\nCada carretera cambia de color\nPero el norte queda firme alrededor\n\n[Pre-Coro]\nAunque el cielo esconda la dirección\nSigue viva nuestra orientación\n\n[Coro]\nRumbo al norte voy\nCon la luz detrás de mí\nRumbo al norte voy\nHay un camino por seguir',
      duration: 30,
      bpm: 104,
      vocalLanguage: 'es',
      seed: 26092602,
    },
    expect: {
      minDurationRatio: 0.9,
      lyricsPreserved: true,
    },
  },

  // ============================================================
  // DIFFRHYTHM v1.2 BASE
  // ============================================================

  {
    id: 'diffrhythm-northern-transmission',
    profile: 'smoke',
    modelId: 'diffrhythm-v12-base',
    title: 'Northern Transmission',
    purpose:
      '95-second lyric-conditioned DiffRhythm Base qualification with deterministic seed and staged GPU residency.',
    parameters: {
      title: 'Northern Transmission',
      prompt:
        'cinematic electronic rock, driving live drums, warm bass, bright synthesizers, spacious electric guitar, expressive clean vocal, expansive modern stereo production',
      lyrics:
        '[00:00.00] Northern signal crossing the open sky\n[00:48.00] Prairie lights carry the rhythm home',
      duration: 95,
      genre: 'Cinematic Electronic Rock',
      mood: 'Expansive, determined, luminous',
      bpm: 112,
      instruments: [
        'electric guitar',
        'bass',
        'drums',
        'synthesizer',
      ],
      vocalsStyle: 'clean',
      seed: 1607,
    },
    expect: {
      minDurationRatio: 0.99,
      channels: 2,
      sampleRate: 44100,
      audioFormat: 1,
      lyricsPreserved: true,
    },
  },

  {
    id: 'diffrhythm-midnight-current',
    profile: 'deep',
    modelId: 'diffrhythm-v12-base',
    title: 'Midnight Current',
    purpose:
      'Contrasting 95-second DiffRhythm Base case for resident-model reuse and different lyric/style conditioning.',
    parameters: {
      title: 'Midnight Current',
      prompt:
        'atmospheric synth rock, steady live drums, luminous pads, melodic bass, distant electric guitar, intimate clean vocal, nocturnal cinematic stereo production',
      lyrics:
        '[00:00.00] Midnight current moving through the plains\n[00:48.00] Distant towers answer in the rain',
      duration: 95,
      genre: 'Atmospheric Synth Rock',
      mood: 'Nocturnal, reflective, moving',
      bpm: 104,
      instruments: [
        'synth pads',
        'electric guitar',
        'bass',
        'drums',
      ],
      vocalsStyle: 'clean',
      seed: 1608,
    },
    expect: {
      minDurationRatio: 0.99,
      channels: 2,
      sampleRate: 44100,
      audioFormat: 1,
      lyricsPreserved: true,
    },
  },

];

module.exports = {
  cases,
};
