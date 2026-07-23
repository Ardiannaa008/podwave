import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  FormControl,
  MenuItem,
  Select,
  Slider,
  TextField,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { generateScript } from '../utils/scriptGenerator';
import { saveEpisode } from '../utils/storage';
import FieldGroup from '../components/FieldGroup';
import AudioPlayer from '../components/AudioPlayer';
import Transcript from '../components/Transcript';

const TONES = ['casual', 'formal', 'comedic', 'dramatic'];
const LENGTHS = ['short', 'medium', 'long'];

function makeId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Create() {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('casual');
  const [length, setLength] = useState('medium');
  const [voiceRate, setVoiceRate] = useState(1);
  const [segments, setSegments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleGenerate(e) {
    e.preventDefault();
    if (topic.trim().length < 3) {
      setError('Give it a topic with at least 3 characters.');
      return;
    }
    setError('');
    setLoading(true);
    setSegments(null);
    try {
      const result = await generateScript({ topic, tone, length });
      setSegments(result);
    } catch (err) {
      setError(err?.message || 'Script generation failed. Check your connection or API key.');
    } finally {
      setLoading(false);
    }
  }

  // Function passed down as a prop-like callback used by the save button.
  function handleSaveEpisode() {
    if (!user) {
      navigate('/login');
      return;
    }
    const combinedScript = segments.map((s) => `${s.speaker}: ${s.text}`).join(' ');
    const episode = {
      id: makeId(),
      title: topic.slice(0, 60),
      topic,
      tone,
      length,
      segments,
      script: combinedScript,
      wordCount: segments.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0),
      date: new Date().toISOString(),
    };
    saveEpisode(user.username, episode);
    navigate('/library');
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <h2>Create an episode</h2>
      <p className="muted" style={{ marginBottom: 24 }}>
        Describe a topic, pick a tone and length, and Podwave writes a two-host
        conversation about it and reads it aloud with two different voices.
      </p>

      <form onSubmit={handleGenerate} className="panel">
        <FieldGroup label="TOPIC">
          <TextField
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. why junior devs overuse useEffect"
            size="small"
            fullWidth
            inputProps={{ maxLength: 180, 'aria-label': 'Topic' }}
          />
        </FieldGroup>

        <FieldGroup label="TONE">
          <FormControl size="small" fullWidth>
            <Select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              inputProps={{ 'aria-label': 'Tone' }}
            >
              {TONES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
        </FieldGroup>

        <FieldGroup label="LENGTH">
          <FormControl size="small" fullWidth>
            <Select
              value={length}
              onChange={(e) => setLength(e.target.value)}
              inputProps={{ 'aria-label': 'Length' }}
            >
              {LENGTHS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </Select>
          </FormControl>
        </FieldGroup>

        <FieldGroup label={`VOICE SPEED — ${voiceRate.toFixed(1)}x`}>
          <Slider
            min={0.6}
            max={1.6}
            step={0.1}
            value={voiceRate}
            onChange={(_, value) => setVoiceRate(value)}
            valueLabelDisplay="auto"
            aria-label="Voice speed"
          />
        </FieldGroup>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Button
          type="submit"
          disabled={loading}
          variant="contained"
          className="mobile-full-button"
        >
          {loading ? 'Writing conversation...' : '✦ Generate episode'}
        </Button>
      </form>

      {loading && (
        <div
          className="panel"
          role="status"
          aria-live="polite"
          style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <span className="waveform" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </span>
          <span className="muted">Podwave is writing the conversation...</span>
        </div>
      )}

      {segments && !loading && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <h4 style={{ marginBottom: 14 }}>Transcript preview</h4>
            <Transcript segments={segments} />
          </div>
          <AudioPlayer segments={segments} voiceRate={voiceRate} />
          <Button
            onClick={handleSaveEpisode}
            variant="contained"
            color="secondary"
            className="mobile-full-button"
            sx={{ alignSelf: 'flex-start' }}
          >
            Save to library
          </Button>
        </div>
      )}
    </div>
  );
}
