from pathlib import Path


class MidiTranscriptionService:
    """Audio-to-MIDI transcription using Spotify Basic Pitch."""

    def transcribe(self, audio_path: Path, midi_output_path: Path) -> Path:
        try:
            from basic_pitch import ICASSP_2022_MODEL_PATH
            from basic_pitch.inference import predict
        except ImportError as exc:
            raise RuntimeError(
                "Basic Pitch is not installed. Run `pip install -r requirements.txt` "
                "from the backend directory."
            ) from exc

        midi_output_path.parent.mkdir(parents=True, exist_ok=True)

        _, midi_data, _ = predict(
            audio_path=audio_path,
            model_or_model_path=ICASSP_2022_MODEL_PATH,
        )
        midi_data.write(str(midi_output_path))
        return midi_output_path
