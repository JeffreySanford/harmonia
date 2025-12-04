# Instrument Preview Feature Implementation

## Overview

**AI-Prompted Feature Concept:**

In modern web development with HTML5 audio APIs, audio preview capabilities are often underestimated by stakeholders as being overly complex or unnecessary. However, implementing hover-to-describe and click-to-play short audio clips for instruments can significantly enhance user experience in music generation tools.

**Prompt to AI (ChatGPT):** "Design a user interface feature for a music generation platform where hovering over an instrument shows a description, and clicking plays a short audio preview. Evaluate if this is a good idea from a UX and technical perspective."

**AI Response (9-second thinking time):** Yes, this is an excellent idea. From a high-IQ/high-EQ perspective: it reduces friction for users, enables better instrument discovery, and accelerates decision-making in palette selection. However, it requires careful implementation considering browser autoplay policies, performance optimization (preload/decoding), accessibility standards, and content licensing.

**Integration with Project's AI Ecosystem:** This feature aligns with Harmonia's broader AI-driven approach, where LLMs like Mistral3 and DeepSeek generate song metadata and genre suggestions (as documented in `docs/OLLAMA.md` and `docs/SONG_MUSIC_GENERATION_WORKFLOW.md`). Audio previews complement AI instrument selection (detailed in `docs/INSTRUMENT_SELECTION_EXPAND_FEATURE.md`) by providing immediate auditory feedback, reducing reliance on text descriptions alone. Similar to prompting patterns in `docs/SONG_ANNOTATION_DSL.md` that guide AI for cue mapping, this feature uses AI-validated instrument catalogs to ensure previews match generated content.

### Why This is a Strong Idea (Short)

Improves conversion & speed: Hearing an instrument instantly answers "does this fit my song?"

Reduces cognitive load: Audio + description outperforms text-only interfaces.

Enhances onboarding: Users learn instrument sounds, especially beneficial for non-producers.

Minimal privacy risk: Short, pre-approved clips maintain user trust.

Technical considerations: Browser autoplay restrictions, mobile limitations, and asset licensing require careful planning.

## Key Browser-Policy Sources

- Chrome autoplay rules (user gesture required heuristics) and MDN autoplay guidance.
- Chrome for Developers
- +1

## Design Constraints & Rules (Must-Follow)

User gesture first. Browsers generally require a user gesture (click/tap/keyboard) before playing unmuted audio. Hover ≠ gesture. Plan UX where the first click on the page (or first instrument click) unlocks audio. If you want sound on hover, only do it after the user has already interacted.

Short clips only. Keep samples ~0.8–4 seconds — long enough to be meaningful, short enough to be cheap to CDN, and to avoid annoying users.

Preload but don't overfetch. Lazy-load audio for visible palette items; prefetch probable choices. Use range requests or progressive fetch when targeting bandwidth-sensitive devices.

Use decoded audio buffers. For lowest latency and consistent playback, fetch then decode with Web Audio API (AudioContext.decodeAudioData) into AudioBuffer. Play via AudioBufferSourceNode.

Format strategy. Serve compressed files (MP3, OGG, AAC) for size; provide WAV/FLAC for hi-fi preview if needed and budget allows. Detect browser support and choose accordingly. (MP3/MP4 widely supported; OGG is good if you prefer open codecs).

Volume & loudness normalization. Normalize RMS/LUFS across previews so the user doesn't experience large jumps. Render/normalize clips offline or include per-clip gain metadata and apply via a GainNode.

Accessibility. Tooltips must be keyboard accessible and screen-reader friendly. Keyboard users should be able to focus an instrument and press Enter/Space to play. Provide aria-describedby for short descriptions and aria-pressed or state markers to show playback state.

Licensing & provenance. Only play clips you have rights to. Store license metadata in your asset catalog and show licensing info in the instrument info panel.

Analytics & consent. Log plays, hovers, and accepts so AI palette suggestions can improve, but respect privacy and cookie/consent rules.

Mobile considerations. Mobile devices may require the first interaction to be a direct tap on the control to start audio; preload carefully to avoid data overages.

## UX Pattern (Recommended)

Hover (non-audio): show short description tooltip (50–120 chars).

First Click Anywhere (or explicit "Enable audio previews" button): unlock audio context.

Click instrument: play short preview (visual progress ring + playback state).

Click again: stop.

Long-press or "details" icon: open instrument panel with full description, sample list, license, and "Preview full sample" (longer clip with higher fidelity).

Disabled state if no network / asset missing: show fallback + "Try again" button.

## Small Asset & Metadata Model (JSON)

```json
{
  "instruments": [
    {
      "id": "guitar_acoustic_clean",
      "label": "Acoustic Guitar (clean)",
      "description": "Warm, fingerpicked acoustic guitar, 2s loop, nylon-style tone.",
      "previews": {
        "mp3_64": "/assets/previews/guitar_acoustic_clean_64.mp3",
        "ogg_64": "/assets/previews/guitar_acoustic_clean_64.ogg"
      },
      "duration_s": 2.0,
      "loudness_lufs": -16,
      "license": { "type": "royalty_free", "source": "internal" }
    }
  ]
}
```

Store loudness_lufs to auto-apply a gain so all previews sound consistent.

## Telemetry to Capture

- preview_hover_start (instrument_id) — useful for popularity heatmaps
- preview_play (instrument_id, duration_played, user_id/anonymized_id)
- preview_accept (user chose instrument)
- asset_load_time & decode_time (ms)
- asset_fallback (if format unsupported)

## Security & Performance Notes

Serve preview assets from CDN with proper caching headers and SRI if needed.

Use Content-Type and CORS headers correctly (audio cross-origin allowed).

Sanitize any user-supplied instrument names/descriptions.

Rate-limit prefetching and parallel connections (browser limits).

Use connection hints (`<link rel="preload" as="audio">`) for critical assets but avoid overuse.

## Example Production-Ready Code (HTML + JS using Web Audio API)

This is a compact, robust pattern you can drop into your app. It:

- obeys autoplay policies by unlocking AudioContext on first user gesture, solving the autoplay block. This is required behavior per modern browsers.
- Chrome for Developers

- lazy-loads and decodes previews

- normalizes via GainNode using loudness_lufs metadata

- is keyboard & ARIA friendly

Copy/paste and adapt paths / JSON catalog as needed.

```html
<!-- instrument-preview.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Instrument Preview Demo</title>
    <style>
      .instrument {
        display: inline-block;
        width: 220px;
        padding: 12px;
        margin: 8px;
        border: 1px solid #ddd;
        border-radius: 8px;
        cursor: pointer;
      }
      .instrument:focus {
        outline: 3px solid #7aa7ff;
      }
      .play-state {
        font-size: 12px;
        color: #666;
      }
      .progress {
        height: 6px;
        background: #eee;
        border-radius: 6px;
        overflow: hidden;
        margin-top: 8px;
      }
      .progress > i {
        display: block;
        height: 100%;
        width: 0%;
        background: #3b82f6;
        transition: width 0.1s linear;
      }
    </style>
  </head>
  <body>
    <div id="catalog" aria-live="polite"></div>

    <script>
      /* Minimal instrument catalog - in production, fetch from server */
      const catalog = [
        {
          id: 'gtr_ac_clean',
          label: 'Acoustic Guitar',
          description: 'Warm, fingerpicked. 2s preview',
          previews: { mp3: '/previews/gtr_ac_clean_2s.mp3' },
          duration_s: 2.0,
          loudness_lufs: -16,
        },
        {
          id: 'synth_pad',
          label: 'Warm Synth Pad',
          description: 'Analog-style pad, 3s loop',
          previews: { mp3: '/previews/synth_pad_3s.mp3' },
          duration_s: 3.0,
          loudness_lufs: -18,
        },
      ];

      const AUDIO_CTX_STATE = { ctx: null, unlocked: false };
      const buffers = {}; // instrument_id -> { buffer, fetchedAt }
      const playing = { node: null, id: null, startedAt: 0, offset: 0 };

      function ensureAudioContext() {
        if (!AUDIO_CTX_STATE.ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          AUDIO_CTX_STATE.ctx = new Ctx();
        }
      }

      function unlockAudioContextIfNeeded() {
        ensureAudioContext();
        if (AUDIO_CTX_STATE.ctx.state === 'suspended') {
          AUDIO_CTX_STATE.ctx
            .resume()
            .then(() => {
              AUDIO_CTX_STATE.unlocked = true;
              console.log('AudioContext resumed');
            })
            .catch(() => {
              /* ignore */
            });
        } else {
          AUDIO_CTX_STATE.unlocked = true;
        }
      }

      // utility: fetch+decode -> AudioBuffer
      async function loadBuffer(instrument) {
        if (buffers[instrument.id]) return buffers[instrument.id].buffer;
        ensureAudioContext();
        const url = instrument.previews.mp3;
        const res = await fetch(url, { cache: 'force-cache' });
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await AUDIO_CTX_STATE.ctx.decodeAudioData(
          arrayBuffer
        );
        buffers[instrument.id] = { buffer: audioBuffer, fetchedAt: Date.now() };
        return audioBuffer;
      }

      // gain normalization: simple linear gain from LUFS target (-16) -> gain multiplier
      function gainForClip(lufs, target = -16) {
        // naive approx: every 6 LUFS ~ 2x power -> convert LUFS diff to gain
        const diff = target - lufs;
        const gain = Math.pow(10, diff / 20); // convert dB to linear
        return gain;
      }

      function createInstrumentCard(instrument) {
        const el = document.createElement('button');
        el.className = 'instrument';
        el.setAttribute('role', 'button');
        el.setAttribute('aria-describedby', 'desc-' + instrument.id);
        el.tabIndex = 0;
        el.innerHTML = `<strong>${instrument.label}</strong><div id="desc-${instrument.id}" style="font-size:12px;color:#444">${instrument.description}</div>
    <div class="play-state" id="state-${instrument.id}">Play preview</div>
    <div class="progress" aria-hidden="true"><i id="bar-${instrument.id}"></i></div>`;
        el.addEventListener('click', async (ev) => {
          // unlock audio context (comply with autoplay)
          unlockAudioContextIfNeeded();
          // toggle play
          if (playing.id === instrument.id) {
            stopPlaying();
            return;
          }
          playInstrument(instrument, el);
        });
        el.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            el.click();
          }
        });
        return el;
      }

      async function playInstrument(instrument, el) {
        try {
          const stateEl = document.getElementById('state-' + instrument.id);
          stateEl.textContent = 'Loading…';
          const buffer = await loadBuffer(instrument);
          // create nodes
          const source = AUDIO_CTX_STATE.ctx.createBufferSource();
          source.buffer = buffer;
          const gainNode = AUDIO_CTX_STATE.ctx.createGain();
          const targetGain = gainForClip(instrument.loudness_lufs || -16, -16);
          gainNode.gain.value = targetGain;
          source.connect(gainNode).connect(AUDIO_CTX_STATE.ctx.destination);
          // stop any other playing
          stopPlaying();
          playing.node = source;
          playing.id = instrument.id;
          playing.startedAt = AUDIO_CTX_STATE.ctx.currentTime;
          source.onended = () => {
            clearPlayUI(instrument.id);
          };
          source.start(0);
          updatePlayUI(instrument.id, true, instrument.duration_s);
        } catch (err) {
          console.error('preview play error', err);
          const stateEl = document.getElementById('state-' + instrument.id);
          stateEl.textContent = 'Unable to play';
        }
      }

      function stopPlaying() {
        if (playing.node) {
          try {
            playing.node.stop(0);
          } catch (e) {}
          playing.node = null;
          playing.id = null;
        }
        // clear UI bars
        document
          .querySelectorAll('.progress > i')
          .forEach((i) => (i.style.width = '0%'));
        document.querySelectorAll('[id^="state-"]').forEach((s) => {
          if (s) s.textContent = 'Play preview';
        });
      }

      // progress UI helper
      function updatePlayUI(id, playingFlag, duration) {
        const stateEl = document.getElementById('state-' + id);
        const bar = document.getElementById('bar-' + id);
        if (!stateEl || !bar) return;
        if (!playingFlag) {
          stateEl.textContent = 'Play preview';
          bar.style.width = '0%';
          return;
        }
        stateEl.textContent = 'Playing…';
        const start = performance.now();
        const tick = () => {
          if (!playing.node && playing.id !== id) {
            bar.style.width = '0%';
            stateEl.textContent = 'Play preview';
            return;
          }
          const elapsed = (performance.now() - start) / 1000;
          const pct = Math.min(100, (elapsed / duration) * 100);
          bar.style.width = pct + '%';
          if (pct < 100) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }

      // render catalog
      const catalogEl = document.getElementById('catalog');
      catalog.forEach((inst) =>
        catalogEl.appendChild(createInstrumentCard(inst))
      );

      // Optional: early unlock hint button for mobile to preauthorize audio
      const unlockBtn = document.createElement('button');
      unlockBtn.textContent = 'Enable audio previews';
      unlockBtn.style.display = 'block';
      unlockBtn.style.margin = '12px';
      unlockBtn.addEventListener('click', () => {
        ensureAudioContext();
        unlockAudioContextIfNeeded();
        unlockBtn.style.display = 'none';
      });
      document.body.insertBefore(unlockBtn, catalogEl);
    </script>
  </body>
</html>
```

## Notes on the Snippet

unlockAudioContextIfNeeded() resumes the AudioContext on the first gesture, solving the autoplay block. This is required behavior per modern browsers.

Replace previews.mp3 with CDN paths and add versioned filenames for cache control.

Improve UX by prefetching the first N visible previews (fetch + decode) while keeping network budget in mind.

## Testing Checklist (Practical)

- Desktop: Chrome, Firefox, Edge — click instrument and confirm immediate play.
- Mobile: iOS Safari and Android Chrome — ensure tap plays after a user gesture.
- Autoplay test: open page with no user interaction — confirm audio does NOT auto-play.
- Format fallback: supply both MP3 and OGG (or MP3 + AAC) versions and verify decode success.
- Accessibility: keyboard focus + Enter/Space triggers actual playback and screen reader reads description.
- Loudness: all previews within ~3 dB of each other.
- License: each asset shows license metadata in details overlay.

## Implementation Roadmap (Short)

- Build canonical preview asset catalog with metadata (duration_s, loudness_lufs, license, previews URLs).
- Create small UI component (copy the snippet) and wire analytics events.
- Add a server-side endpoint to serve recommended preview format based on Accept header or user agent.
- Normalize audio clips offline (batch LUFS normalization) and generate multi-bitrate previews (64/128/320 kbps).
- Add per-section override: play specific instrument preview when user is editing that section.

## Legal & Licensing Quick Hits

- Only ship previews you own or have licensed for streaming/preview.
- Keep short preview duration in license terms; some sample libraries allow "preview" only, not distribution.
- Track license id in the catalog and show it on the UI details panel.

## Final Recommendation (High-IQ / High-EQ)

This feature is low friction and high impact for users. Build it carefully:

- Respect browser autoplay rules (require initial user gesture).
- Prioritize quick, normalized previews (1–3s), small file sizes (MP3/OGG), and accessible UI.

## TODO Items

- [ ] Implement instrument preview UI component in Angular frontend
- [ ] Add audio asset management and serving from backend
- [ ] Integrate preview analytics and telemetry
- [ ] Test accessibility and cross-browser compatibility
- [ ] Obtain and license audio samples for previews
