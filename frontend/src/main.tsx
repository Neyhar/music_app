import React from 'react';
import ReactDOM from 'react-dom/client';
import { Mic, Music2, Play, Upload } from 'lucide-react';
import './styles.css';

type TrackPart = {
  id: string;
  name: string;
  role: 'Melody' | 'Bass' | 'Harmony' | 'Rhythm';
  status: 'Ready' | 'Recording' | 'Queued' | 'MIDI drafted';
};

const seedTracks: TrackPart[] = [
  { id: 'melody', name: 'Lead idea', role: 'Melody', status: 'Ready' },
  { id: 'bass', name: 'Low vocal line', role: 'Bass', status: 'Queued' },
  { id: 'harmony', name: 'Stacked thirds', role: 'Harmony', status: 'MIDI drafted' },
];

function App() {
  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Music App</h1>
            <p>Record sung parts, queue transcription, and shape MIDI tracks.</p>
          </div>
          <button className="primary-action">
            <Upload size={18} aria-hidden="true" />
            Import audio
          </button>
        </header>

        <section className="recording-panel" aria-label="Recording controls">
          <div className="recording-copy">
            <span className="section-label">Current part</span>
            <h2>Sing a melody line</h2>
            <p>Capture one focused idea at a time, then send the take through the MIDI transcription job queue.</p>
          </div>
          <div className="transport">
            <button className="record-button" aria-label="Start recording">
              <Mic size={28} aria-hidden="true" />
            </button>
            <button className="icon-button" aria-label="Play latest take">
              <Play size={22} aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="track-list" aria-label="Project tracks">
          <div className="section-heading">
            <h2>Parts</h2>
            <button>New part</button>
          </div>
          {seedTracks.map((track) => (
            <article className="track-row" key={track.id}>
              <div className="track-icon">
                <Music2 size={20} aria-hidden="true" />
              </div>
              <div>
                <h3>{track.name}</h3>
                <p>{track.role}</p>
              </div>
              <span className="track-status">{track.status}</span>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
