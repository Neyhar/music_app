from pathlib import Path


class MidiTranscriptionService:
    """Monophonic vocal melody transcription using torchcrepe pitch tracking."""

    sample_rate = 16_000
    hop_length = 160
    fmin = 65.0
    fmax = 1_050.0
    periodicity_threshold = 0.55
    min_note_duration_seconds = 0.08
    merge_gap_seconds = 0.06
    instrument_program = 40  # General MIDI violin.

    def transcribe(self, audio_path: Path, midi_output_path: Path) -> Path:
        try:
            import librosa
            import numpy as np
            import pretty_midi
            import torch
            import torchcrepe
        except ImportError as exc:
            raise RuntimeError(
                "torchcrepe transcription dependencies are not installed. "
                "Run `pip install -r requirements.txt` "
                "from the backend directory."
            ) from exc

        midi_output_path.parent.mkdir(parents=True, exist_ok=True)

        audio, _ = librosa.load(
            audio_path,
            sr=self.sample_rate,
            mono=True,
        )
        if audio.size == 0:
            raise RuntimeError("Uploaded audio is empty.")

        device = "cuda" if torch.cuda.is_available() else "cpu"
        audio_tensor = torch.tensor(audio, dtype=torch.float32, device=device).unsqueeze(0)

        with torch.no_grad():
            pitch, periodicity = torchcrepe.predict(
                audio_tensor,
                self.sample_rate,
                self.hop_length,
                self.fmin,
                self.fmax,
                "full",
                batch_size=2048,
                device=device,
                return_periodicity=True,
            )

        pitch_hz = pitch.squeeze(0).detach().cpu().numpy()
        confidence = periodicity.squeeze(0).detach().cpu().numpy()
        midi_contour = self._pitch_hz_to_midi(pitch_hz, np)
        midi_contour[confidence < self.periodicity_threshold] = np.nan
        smoothed_midi = self._nanmedian_filter(midi_contour, window_size=7, np=np)
        midi_notes = self._segment_melody(smoothed_midi, confidence, np)

        midi_data = pretty_midi.PrettyMIDI(initial_tempo=120)
        instrument = pretty_midi.Instrument(program=self.instrument_program, name="Violin")
        for note in midi_notes:
            instrument.notes.append(
                pretty_midi.Note(
                    velocity=note["velocity"],
                    pitch=note["pitch"],
                    start=note["start"],
                    end=note["end"],
                )
            )
        midi_data.instruments.append(instrument)
        midi_data.write(str(midi_output_path))
        return midi_output_path

    def _pitch_hz_to_midi(self, pitch_hz, np):
        midi = np.full_like(pitch_hz, np.nan, dtype=np.float32)
        voiced = pitch_hz > 0
        midi[voiced] = 69 + 12 * np.log2(pitch_hz[voiced] / 440.0)
        return midi

    def _nanmedian_filter(self, values, window_size: int, np):
        if window_size <= 1:
            return values

        radius = window_size // 2
        filtered = values.copy()
        for index in range(values.shape[0]):
            start = max(0, index - radius)
            end = min(values.shape[0], index + radius + 1)
            window = values[start:end]
            if not np.all(np.isnan(window)):
                filtered[index] = np.nanmedian(window)
        return filtered

    def _segment_melody(self, midi_contour, confidence, np) -> list[dict[str, int | float]]:
        rounded_notes = np.where(np.isnan(midi_contour), np.nan, np.rint(midi_contour))
        frame_seconds = self.hop_length / self.sample_rate
        raw_notes = []
        active_pitch = None
        start_frame = 0
        velocity_values = []

        for frame_index, value in enumerate(rounded_notes):
            pitch = None if np.isnan(value) else int(np.clip(value, 0, 127))

            if pitch == active_pitch:
                if pitch is not None:
                    velocity_values.append(confidence[frame_index])
                continue

            if active_pitch is not None:
                raw_notes.append(
                    self._make_note(
                        active_pitch,
                        start_frame,
                        frame_index,
                        velocity_values,
                        frame_seconds,
                        np,
                    )
                )

            active_pitch = pitch
            start_frame = frame_index
            velocity_values = [confidence[frame_index]] if pitch is not None else []

        if active_pitch is not None:
            raw_notes.append(
                self._make_note(
                    active_pitch,
                    start_frame,
                    len(rounded_notes),
                    velocity_values,
                    frame_seconds,
                    np,
                )
            )

        kept_notes = [
            note
            for note in raw_notes
            if note["end"] - note["start"] >= self.min_note_duration_seconds
        ]
        return self._merge_adjacent_notes(kept_notes)

    def _make_note(self, pitch, start_frame, end_frame, velocity_values, frame_seconds, np):
        confidence = float(np.mean(velocity_values)) if velocity_values else 0.7
        velocity = int(np.clip(45 + confidence * 70, 45, 115))
        return {
            "pitch": pitch,
            "start": start_frame * frame_seconds,
            "end": end_frame * frame_seconds,
            "velocity": velocity,
        }

    def _merge_adjacent_notes(self, notes: list[dict[str, int | float]]):
        if not notes:
            return notes

        merged = [notes[0]]
        for note in notes[1:]:
            previous = merged[-1]
            gap = note["start"] - previous["end"]
            if note["pitch"] == previous["pitch"] and gap <= self.merge_gap_seconds:
                previous["end"] = note["end"]
                previous["velocity"] = max(previous["velocity"], note["velocity"])
            else:
                merged.append(note)

        return merged
        midi_data.write(str(midi_output_path))
        return midi_output_path
