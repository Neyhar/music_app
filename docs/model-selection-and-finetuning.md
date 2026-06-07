# Voice-Directed Track Generation: Model Selection and Fine-Tuning Plan

## Product Target

The app should support prompts like:

- "The violin goes ..." followed by a sung melody.
- "The drums go ..." followed by beatboxing, tapping, or spoken rhythm.
- "The bass goes ..." followed by a hummed bassline.

The output is not just "audio to MIDI." It is an arranged MIDI track with:

- an inferred instrument or role
- a transcription mode
- note or drum events
- MIDI program/channel metadata

## Recommended Architecture

Use a router plus specialized transcription models.

```text
voice/audio input
  -> intent parser
  -> transcription mode router
  -> melody model OR drum/rhythm model
  -> post-processing
  -> instrument-mapped MIDI
```

### Intent Parser

Purpose: extract the requested track target from text or speech.

Examples:

```json
{
  "instrument": "violin",
  "role": "melody",
  "mode": "pitched_melody"
}
```

```json
{
  "instrument": "drums",
  "role": "rhythm",
  "mode": "drum_rhythm"
}
```

This can begin as a small rules-based parser and later be replaced with an LLM or classifier.

## Model Choice

### Phase 1: Use Baseline Models Before Fine-Tuning

Start with inference-first integration. This gives the app a working loop and creates corrected examples for training.

For sung melody:

- Use Spotify Basic Pitch first.
- It is lightweight, Python-installable, and designed for audio-to-MIDI transcription.
- It outputs MIDI and pitch bends, which helps preserve vocal expression.

Source: https://github.com/spotify/basic-pitch

For multi-instrument transcription research:

- Track YourMT3 / YourMT3+ as the likely fine-tuning direction if we later need multi-track transcription.
- It is built around multi-instrument music transcription and has reproducible code/datasets.

Sources:

- https://github.com/mimbres/YourMT3
- https://arxiv.org/abs/2407.04822

For the original transformer transcription baseline:

- MT3 is the research reference for sequence-to-sequence multi-task music transcription.
- It is useful conceptually, but heavier to operate and fine-tune than Basic Pitch.

Source: https://arxiv.org/abs/2111.03017

### Phase 2: Fine-Tune Specialized Models

Do not fine-tune one universal model first. Fine-tune separate task models:

1. Vocal melody to note events.
2. Beatbox/tap rhythm to drum events.
3. Optional later: polyphonic/harmony input to multi-note MIDI.

## Data Strategy

Fine-tuning requires paired examples:

```text
input audio: user sings or beatboxes
target MIDI: corrected MIDI track
metadata: requested instrument, mode, tempo, key, quantization setting
```

The product should save:

- original uploaded/recorded audio
- model-generated MIDI
- user-corrected MIDI
- prompt text
- parsed intent
- transcription settings

This creates the highest-value dataset because it matches the app's actual input style.

## Public Datasets To Investigate

### Singing / Melody

- VocalSet: monophonic professional singing audio.
  - https://zenodo.org/records/1442513
- Annotated-VocalSet: adds pitch, onset, offset, MIDI pitch, and lyric-style annotations.
  - https://www.mdpi.com/2076-3417/12/18/9257
- MIR-ST500: singing pitch to music-note conversion.
  - https://mirlab.org/dataSet/public/

### Drums / Rhythm

- Expanded Groove MIDI Dataset: large drum audio/MIDI dataset.
  - https://magenta.withgoogle.com/datasets/groove
  - https://arxiv.org/abs/2004.00188
- Beatbox datasets:
  - https://huggingface.co/datasets/maxardito/beatbox

## Fine-Tuning Path

### Melody Model

Start with Basic Pitch inference. If quality is not good enough:

1. Build a correction UI so generated MIDI can be edited.
2. Save pairs of `audio -> corrected_midi`.
3. Convert MIDI to frame/onset/pitch labels.
4. Fine-tune a melody transcription model on user-style singing.
5. Evaluate against note-level precision, recall, F1, onset accuracy, and pitch accuracy.

Expected helpful augmentations:

- pitch shifting
- time stretching
- background noise/reverb
- microphone EQ variations
- different vowels and syllables

### Drum Model

Start with onset detection plus simple event classification:

- low/boomy sounds -> kick
- sharp consonants/claps -> snare
- noisy high-frequency syllables -> hi-hat

Then fine-tune when enough examples exist:

1. Collect beatbox/tap audio.
2. Ask user to correct the drum MIDI.
3. Train an onset classifier over drum classes.
4. Evaluate event F1 within timing tolerances.

## Backend Contract

The transcription service should accept:

```python
TranscriptionRequest(
    audio_path=Path(...),
    midi_output_path=Path(...),
    mode="pitched_melody" | "drum_rhythm",
    instrument="violin" | "drums" | "bass" | ...
)
```

The service should return:

```python
TranscriptionResult(
    midi_path=Path(...),
    detected_mode=str,
    instrument=str,
    confidence=float | None,
    diagnostics=dict
)
```

## Recommendation

Build the first version with:

1. Rules-based intent parsing.
2. Basic Pitch for sung melody.
3. A simple onset-based drum prototype.
4. MIDI post-processing and instrument mapping.
5. Data capture for corrected outputs.

Fine-tuning should begin only after the app can produce, edit, and save at least a few hundred corrected examples per mode.

## Current Basic Pitch Backend Flow

The first pitched-track transcription path is now:

1. `POST /api/tracks/{track_id}/takes` uploads an audio file.
2. The API creates a queued `TranscriptionJob`.
3. The uploaded audio is saved to `storage/audio/{job_id}.{ext}`.
4. A FastAPI background task calls `process_transcription_job`.
5. Melody, bass, and harmony tracks run through Basic Pitch.
6. The generated MIDI is saved to `storage/midi/{job_id}.mid`.
7. The job is marked `completed` and `midi_path` is populated.

Rhythm tracks are intentionally marked failed for now because drums/beatboxing need a separate rhythm transcription pipeline.

## Torchcrepe Branch Notes

Branch `torchcrepe-transcription` replaces Basic Pitch with a monophonic vocal melody pipeline:

```text
audio file
  -> librosa mono 16 kHz load
  -> torchcrepe pitch + periodicity tracking
  -> confidence filtering
  -> median smoothing
  -> semitone note segmentation
  -> pretty_midi MIDI writing
```

This is intended for clean sung or hummed melody takes. It should be easier to tune than Basic Pitch because thresholds, smoothing, note splitting, minimum note length, and note merging are all controlled in `MidiTranscriptionService`.

The first torchcrepe transcription in a fresh process can be slow while the model initializes. Later calls should be faster.
