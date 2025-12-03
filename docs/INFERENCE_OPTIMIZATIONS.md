# Inference Optimization Strategies (Low-VRAM & Local Hardware)

Context
Target hardware: consumer workstation (i9 24-core, 32GB RAM, GPU with ~10GB VRAM). Heavy model inference requires strategies to reduce memory, compute, and latency.

Strategies

1. Model variant selection
   - Prefer smaller variants or distilled checkpoints for local runs.
   - Keep canonical large variants for offline/production but use quantized versions locally.

2. Quantization
   - 8-bit and 4-bit quantization (PTQ or QAT) can reduce GPU memory usage significantly.
   - Use libraries like bitsandbytes or native PyTorch quantization where available.

3. Half-precision & mixed precision
   - Use FP16 where supported. Combine with gradient/activation checkpointing only if training.

4. Model sharding & streaming
   - Load only parts of the model on-demand where architecture permits (e.g., splitting encoder/decoder responsibilities).

5. CPU-GPU offload
   - Move non-critical layers to CPU, keep attention/key modules on GPU. Use libraries that support offloading (accelerate, vLLM-style approaches).

6. Preprocessing and caching
   - Precompute expensive audio encodings and cache them to disk to avoid repeated encoding steps.
   - Use short intermediate representations (latent encodings) for rapid iteration.

7. Prompt / latent conditioning reduction
   - Pre-process user prompts via NGRX reducers and centralized LLM step to produce compact conditioning vectors.
   - Cache and reuse conditioning vectors when user parameters don't change.

8. Mixed pipeline decomposition
   - Decompose pipeline into fast shallow models for interactive previews and heavy models for final renders.
   - Example: use a small model to generate a 10s preview, then run large model for final 60s render.

9. Deterministic seeding and reproducibility
   - Use explicit RNG seeds and document them in artifact metadata to enable reproducible runs.

10. Profiling and telemetry

- Add simple timing and memory telemetry to worker scripts to identify hotspots and guide optimizations.

Recommendations for Harmonia

- Ship small quantized models for local dev and testing in `models/variants/quantized/*`.
- Implement CPU-GPU offload options in worker scripts behind flags.
- Add caching layers for encodings and prompt conditioning artifacts.

---
End of inference optimizations.
