from pathlib import Path


class MidiTranscriptionService:
    """Boundary for the future audio-to-MIDI model pipeline."""

    def transcribe(self, audio_path: Path, midi_output_path: Path) -> Path:
        raise NotImplementedError(
            "Wire an audio-to-MIDI model here once the model choice is finalized."
        )
