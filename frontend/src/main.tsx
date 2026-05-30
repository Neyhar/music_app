import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { FileAudio, Loader2, Mic, Music2, Play, Square, Upload } from 'lucide-react';
import * as Soundfont from 'soundfont-player';
import './styles.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

type TrackRole = 'melody' | 'bass' | 'harmony' | 'rhythm';
type TakeSource = 'upload' | 'record';
type PlaybackInstrument = 'violin' | 'cello' | 'flute' | 'acoustic_grand_piano' | 'acoustic_bass';
type MidiNote = {
  midi: number;
  start: number;
  duration: number;
  velocity: number;
};

type Project = {
  id: string;
  name: string;
};

type Track = {
  id: string;
  project_id: string;
  name: string;
  role: TrackRole;
};

type TranscriptionJob = {
  id: string;
  track_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  audio_path: string;
  midi_path: string | null;
};

const roleLabels: Record<TrackRole, string> = {
  melody: 'Melody',
  bass: 'Bass',
  harmony: 'Harmony',
  rhythm: 'Rhythm',
};

const playbackInstrumentLabels: Record<PlaybackInstrument, string> = {
  violin: 'Violin',
  cello: 'Cello',
  flute: 'Flute',
  acoustic_grand_piano: 'Piano',
  acoustic_bass: 'Acoustic bass',
};

function App() {
  const [projectName, setProjectName] = useState('Test Project');
  const [trackName, setTrackName] = useState('Violin Melody');
  const [trackRole, setTrackRole] = useState<TrackRole>('melody');
  const [project, setProject] = useState<Project | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [takeSource, setTakeSource] = useState<TakeSource>('upload');
  const [playbackInstrument, setPlaybackInstrument] = useState<PlaybackInstrument>('violin');
  const [isRecording, setIsRecording] = useState(false);
  const [isMidiPlaying, setIsMidiPlaying] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('Create a project and track, then upload a sung take.');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const midiAudioContextRef = useRef<AudioContext | null>(null);
  const midiTimeoutsRef = useRef<number[]>([]);
  const soundfontPlayerRef = useRef<Soundfont.Player | null>(null);

  const canUpload = useMemo(() => track !== null && audioFile !== null && !isBusy, [audioFile, isBusy, track]);

  useEffect(() => {
    if (audioFile === null) {
      setAudioPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(audioFile);
    setAudioPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [audioFile]);

  useEffect(() => {
    return () => {
      stopMicrophoneStream();
      stopMidiPlayback();
    };
  }, []);

  useEffect(() => {
    if (job === null || job.status === 'completed' || job.status === 'failed') {
      return;
    }

    const pollJob = window.setInterval(async () => {
      try {
        const nextJob = await apiRequest<TranscriptionJob>(`/api/jobs/${job.id}`);
        setJob(nextJob);
        if (nextJob.status === 'completed') {
          setMessage(`MIDI ready: ${nextJob.midi_path}`);
          window.clearInterval(pollJob);
        }
        if (nextJob.status === 'failed') {
          setMessage('Transcription failed. Check the backend logs for the Basic Pitch error.');
          window.clearInterval(pollJob);
        }
      } catch (error) {
        setMessage(errorMessage(error));
      }
    }, 2000);

    return () => window.clearInterval(pollJob);
  }, [job]);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage('Creating project...');

    try {
      const createdProject = await apiRequest<Project>('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName }),
      });
      setProject(createdProject);
      setTrack(null);
      setJob(null);
      setMessage('Project created. Add a track next.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (project === null) {
      setMessage('Create a project first.');
      return;
    }

    setIsBusy(true);
    setMessage('Creating track...');

    try {
      const createdTrack = await apiRequest<Track>('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          name: trackName,
          role: trackRole,
        }),
      });
      setTrack(createdTrack);
      setJob(null);
      setMessage(`${roleLabels[createdTrack.role]} track created.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUploadTake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (track === null || audioFile === null) {
      setMessage('Choose a track and audio file first.');
      return;
    }

    setIsBusy(true);
    setMessage('Uploading take...');

    try {
      const formData = new FormData();
      formData.append('audio_file', audioFile);

      const createdJob = await apiRequest<TranscriptionJob>(`/api/tracks/${track.id}/takes`, {
        method: 'POST',
        body: formData,
      });
      setJob(createdJob);
      setMessage('Take uploaded. Waiting for transcription...');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStartRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('This browser does not support microphone recording.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      streamRef.current = stream;
      recordingChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', () => {
        const recordingBlob = new Blob(recordingChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        const recordedFile = new File([recordingBlob], `recorded-take-${Date.now()}.webm`, {
          type: recordingBlob.type,
        });

        setAudioFile(recordedFile);
        setIsRecording(false);
        setMessage('Recording captured. Upload the take when you are ready.');
        stopMicrophoneStream();
      });

      mediaRecorder.start();
      setAudioFile(null);
      setIsRecording(true);
      setMessage('Recording... sing the part, then stop recording.');
    } catch (error) {
      setMessage(errorMessage(error));
      stopMicrophoneStream();
      setIsRecording(false);
    }
  }

  function handleStopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  function handleTakeSourceChange(nextSource: TakeSource) {
    if (isRecording) {
      handleStopRecording();
    }
    setTakeSource(nextSource);
    setAudioFile(null);
    setMessage(nextSource === 'upload' ? 'Choose an audio file to upload.' : 'Record a sung take in the browser.');
  }

  async function handlePlayMidi() {
    if (job?.status !== 'completed') {
      setMessage('MIDI is not ready yet.');
      return;
    }

    try {
      stopMidiPlayback();
      const audioContext = new AudioContext();
      midiAudioContextRef.current = audioContext;
      await audioContext.resume();

      setMessage('Loading MIDI preview...');

      const response = await fetch(`${API_BASE_URL}/api/jobs/${job.id}/midi`);
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Request failed with ${response.status}`);
      }

      const notes = parseMidiNotes(await response.arrayBuffer());
      if (notes.length === 0) {
        setMessage('MIDI file loaded, but no playable notes were found.');
        return;
      }

      const playbackMode = await playMidiNotes(audioContext, notes, playbackInstrument, () => {
        setIsMidiPlaying(false);
        setMessage('MIDI preview finished.');
      });
      setIsMidiPlaying(true);
      setMessage(
        playbackMode === 'samples'
          ? `Playing ${playbackInstrumentLabels[playbackInstrument]} preview with ${notes.length} notes.`
          : 'SoundFont samples could not load, so synth preview is playing instead.',
      );
    } catch (error) {
      setIsMidiPlaying(false);
      setMessage(errorMessage(error));
    }
  }

  function handleStopMidi() {
    stopMidiPlayback();
    setIsMidiPlaying(false);
    setMessage('MIDI preview stopped.');
  }

  async function playMidiNotes(
    audioContext: AudioContext,
    notes: MidiNote[],
    instrumentName: PlaybackInstrument,
    onDone: () => void,
  ): Promise<'samples' | 'synth'> {
    const now = audioContext.currentTime + 0.08;
    let playbackMode: 'samples' | 'synth' = 'samples';

    try {
      const player = await Soundfont.instrument(audioContext, instrumentName, {
        soundfont: 'FluidR3_GM',
        format: 'mp3',
        destination: audioContext.destination,
        gain: 1.2,
      });
      soundfontPlayerRef.current = player;

      notes.forEach((note) => {
        player.play(note.midi as never, now + note.start, {
          duration: Math.max(note.duration, 0.1),
          gain: Math.max(0.08, Math.min(note.velocity / 127, 1)),
        });
      });
    } catch {
      playbackMode = 'synth';
      playSynthFallback(notes, audioContext, now);
    }

    const finalNoteEnd = Math.max(...notes.map((note) => note.start + note.duration));
    const doneTimeout = window.setTimeout(onDone, (finalNoteEnd + 0.65) * 1000);
    midiTimeoutsRef.current.push(doneTimeout);
    return playbackMode;
  }

  function playSynthFallback(notes: MidiNote[], audioContext: AudioContext, now: number) {
    notes.forEach((note) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startTime = now + note.start;
      const endTime = startTime + Math.max(note.duration, 0.08);
      const peakGain = Math.max(0.03, Math.min(note.velocity / 127, 1) * 0.16);

      oscillator.type = 'triangle';
      oscillator.frequency.value = midiToFrequency(note.midi);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.02);
    });
  }

  function stopMidiPlayback() {
    midiTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    midiTimeoutsRef.current = [];
    soundfontPlayerRef.current?.stop();
    soundfontPlayerRef.current = null;
    midiAudioContextRef.current?.close();
    midiAudioContextRef.current = null;
  }

  function stopMicrophoneStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Music App</h1>
            <p>Test the Basic Pitch sung-audio to MIDI backend flow.</p>
          </div>
          <span className={`status-pill ${job?.status ?? 'idle'}`}>{job?.status ?? 'idle'}</span>
        </header>

        <section className="recording-panel" aria-label="Transcription test flow">
          <div className="recording-copy">
            <span className="section-label">Basic Pitch test</span>
            <h2>Upload a sung melody and generate MIDI</h2>
            <p>{message}</p>
          </div>
          <div className="transport" aria-hidden="true">
            {job?.status === 'queued' || job?.status === 'processing' ? (
              <Loader2 className="spin" size={34} />
            ) : (
              <Mic size={34} />
            )}
          </div>
        </section>

        <section className="test-grid" aria-label="Backend test controls">
          <form className="test-panel" onSubmit={handleCreateProject}>
            <div>
              <span className="section-label">Step 1</span>
              <h2>Project</h2>
            </div>
            <label>
              Name
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <button className="primary-action" disabled={isBusy}>
              Create project
            </button>
            {project ? <p className="muted">Project ID: {project.id}</p> : null}
          </form>

          <form className="test-panel" onSubmit={handleCreateTrack}>
            <div>
              <span className="section-label">Step 2</span>
              <h2>Track</h2>
            </div>
            <label>
              Name
              <input value={trackName} onChange={(event) => setTrackName(event.target.value)} />
            </label>
            <label>
              Role
              <select value={trackRole} onChange={(event) => setTrackRole(event.target.value as TrackRole)}>
                <option value="melody">Melody</option>
                <option value="bass">Bass</option>
                <option value="harmony">Harmony</option>
                <option value="rhythm">Rhythm</option>
              </select>
            </label>
            <button className="primary-action" disabled={isBusy || project === null}>
              Create track
            </button>
            {track ? <p className="muted">Track ID: {track.id}</p> : null}
          </form>

          <form className="test-panel" onSubmit={handleUploadTake}>
            <div>
              <span className="section-label">Step 3</span>
              <h2>Take</h2>
            </div>
            <div className="mode-switch" aria-label="Take source">
              <button
                type="button"
                className={takeSource === 'upload' ? 'selected' : ''}
                onClick={() => handleTakeSourceChange('upload')}
              >
                <Upload size={16} aria-hidden="true" />
                Upload
              </button>
              <button
                type="button"
                className={takeSource === 'record' ? 'selected' : ''}
                onClick={() => handleTakeSourceChange('record')}
              >
                <Mic size={16} aria-hidden="true" />
                Record
              </button>
            </div>

            {takeSource === 'upload' ? (
              <label>
                Audio
                <input
                  accept="audio/*"
                  type="file"
                  onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <div className="record-control">
                <span>Microphone</span>
                <button
                  type="button"
                  className={isRecording ? 'recording-action stop' : 'recording-action'}
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                >
                  {isRecording ? <Square size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
                  {isRecording ? 'Stop recording' : 'Start recording'}
                </button>
              </div>
            )}

            {audioPreviewUrl ? (
              <audio className="audio-preview" controls src={audioPreviewUrl} aria-label="Take preview" />
            ) : null}

            <button className="primary-action" disabled={!canUpload}>
              <Upload size={18} aria-hidden="true" />
              Upload take
            </button>
            {audioFile ? <p className="muted">File: {audioFile.name}</p> : null}
          </form>
        </section>

        <section className="track-list" aria-label="Latest transcription job">
          <div className="section-heading">
            <h2>Latest job</h2>
            {job?.status === 'completed' ? (
              <div className="midi-actions">
                <label>
                  Instrument
                  <select
                    value={playbackInstrument}
                    onChange={(event) => setPlaybackInstrument(event.target.value as PlaybackInstrument)}
                    disabled={isMidiPlaying}
                  >
                    <option value="violin">Violin</option>
                    <option value="cello">Cello</option>
                    <option value="flute">Flute</option>
                    <option value="acoustic_grand_piano">Piano</option>
                    <option value="acoustic_bass">Acoustic bass</option>
                  </select>
                </label>
                <button type="button" onClick={isMidiPlaying ? handleStopMidi : handlePlayMidi}>
                  {isMidiPlaying ? <Square size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                  {isMidiPlaying ? 'Stop MIDI' : 'Play MIDI'}
                </button>
              </div>
            ) : null}
          </div>
          <article className="track-row">
            <div className="track-icon">
              {job?.midi_path ? <Music2 size={20} aria-hidden="true" /> : <FileAudio size={20} aria-hidden="true" />}
            </div>
            <div>
              <h3>{track?.name ?? 'No track yet'}</h3>
              <p>{job?.midi_path ?? job?.audio_path ?? 'Create a track and upload audio.'}</p>
            </div>
            <span className="track-status">{job?.status ?? 'Waiting'}</span>
          </article>
        </section>
      </section>
    </main>
  );
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function parseMidiNotes(arrayBuffer: ArrayBuffer): MidiNote[] {
  const reader = new MidiReader(arrayBuffer);
  if (reader.readString(4) !== 'MThd') {
    throw new Error('Invalid MIDI file.');
  }

  const headerLength = reader.readUint32();
  const format = reader.readUint16();
  const trackCount = reader.readUint16();
  const ticksPerQuarter = reader.readUint16();
  reader.skip(headerLength - 6);

  if ((ticksPerQuarter & 0x8000) !== 0) {
    throw new Error('SMPTE MIDI timing is not supported in the preview player.');
  }
  if (format > 1) {
    throw new Error('Only MIDI format 0 and 1 are supported in the preview player.');
  }

  const tempoEvents = [{ tick: 0, secondsPerTick: 0.5 / ticksPerQuarter }];
  const rawNotes: Array<{ midi: number; startTick: number; endTick: number; velocity: number }> = [];

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    if (reader.readString(4) !== 'MTrk') {
      throw new Error('Invalid MIDI track chunk.');
    }

    const trackLength = reader.readUint32();
    const trackEnd = reader.position + trackLength;
    const activeNotes = new Map<string, Array<{ startTick: number; velocity: number }>>();
    let tick = 0;
    let runningStatus = 0;

    while (reader.position < trackEnd) {
      tick += reader.readVarLength();
      let status = reader.readUint8();

      if (status < 0x80) {
        reader.rewind(1);
        status = runningStatus;
      } else {
        runningStatus = status;
      }

      if (status === 0xff) {
        const metaType = reader.readUint8();
        const length = reader.readVarLength();
        if (metaType === 0x51 && length === 3) {
          const microsecondsPerQuarter = reader.readUint24();
          tempoEvents.push({
            tick,
            secondsPerTick: microsecondsPerQuarter / 1_000_000 / ticksPerQuarter,
          });
        } else {
          reader.skip(length);
        }
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        reader.skip(reader.readVarLength());
        continue;
      }

      const command = status & 0xf0;
      const channel = status & 0x0f;
      const dataLength = command === 0xc0 || command === 0xd0 ? 1 : 2;
      const data1 = reader.readUint8();
      const data2 = dataLength === 2 ? reader.readUint8() : 0;

      if (command !== 0x90 && command !== 0x80) {
        continue;
      }

      const noteKey = `${channel}:${data1}`;
      const noteStack = activeNotes.get(noteKey) ?? [];
      const isNoteOn = command === 0x90 && data2 > 0;

      if (isNoteOn) {
        noteStack.push({ startTick: tick, velocity: data2 });
        activeNotes.set(noteKey, noteStack);
        continue;
      }

      const activeNote = noteStack.shift();
      if (noteStack.length === 0) {
        activeNotes.delete(noteKey);
      }
      if (activeNote && tick > activeNote.startTick) {
        rawNotes.push({
          midi: data1,
          startTick: activeNote.startTick,
          endTick: tick,
          velocity: activeNote.velocity,
        });
      }
    }

    reader.position = trackEnd;
  }

  tempoEvents.sort((a, b) => a.tick - b.tick);

  return rawNotes
    .map((note) => ({
      midi: note.midi,
      start: midiTickToSeconds(note.startTick, tempoEvents),
      duration: midiTickToSeconds(note.endTick, tempoEvents) - midiTickToSeconds(note.startTick, tempoEvents),
      velocity: note.velocity,
    }))
    .sort((a, b) => a.start - b.start);
}

function midiTickToSeconds(tick: number, tempoEvents: Array<{ tick: number; secondsPerTick: number }>) {
  let seconds = 0;

  for (let index = 0; index < tempoEvents.length; index += 1) {
    const current = tempoEvents[index];
    const next = tempoEvents[index + 1];
    const segmentEndTick = next ? Math.min(tick, next.tick) : tick;

    if (segmentEndTick > current.tick) {
      seconds += (segmentEndTick - current.tick) * current.secondsPerTick;
    }
    if (!next || tick < next.tick) {
      break;
    }
  }

  return seconds;
}

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

class MidiReader {
  private readonly view: DataView;

  position = 0;

  constructor(arrayBuffer: ArrayBuffer) {
    this.view = new DataView(arrayBuffer);
  }

  readString(length: number) {
    let value = '';
    for (let index = 0; index < length; index += 1) {
      value += String.fromCharCode(this.readUint8());
    }
    return value;
  }

  readUint8() {
    const value = this.view.getUint8(this.position);
    this.position += 1;
    return value;
  }

  readUint16() {
    const value = this.view.getUint16(this.position);
    this.position += 2;
    return value;
  }

  readUint24() {
    const value = (this.readUint8() << 16) | (this.readUint8() << 8) | this.readUint8();
    return value;
  }

  readUint32() {
    const value = this.view.getUint32(this.position);
    this.position += 4;
    return value;
  }

  readVarLength() {
    let value = 0;
    let byte = 0;

    do {
      byte = this.readUint8();
      value = (value << 7) | (byte & 0x7f);
    } while ((byte & 0x80) !== 0);

    return value;
  }

  rewind(length: number) {
    this.position -= length;
  }

  skip(length: number) {
    this.position += length;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
