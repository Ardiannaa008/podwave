import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Box, Button, Skeleton } from '@mui/material';
import { compressToEncodedURIComponent } from 'lz-string';
import { useAuth } from '../context/AuthContext';
import { estimateDurationMinutes } from '../utils/scriptGenerator';
import { getEpisode } from '../utils/storage';
import AudioPlayer from '../components/AudioPlayer';
import Transcript from '../components/Transcript';

export default function EpisodeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [episode, setEpisode] = useState(undefined);
  const [shareStatus, setShareStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user) setEpisode(getEpisode(user.username, id) || null);
  }, [user, id]);

  if (episode === undefined) {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <Skeleton variant="text" width="35%" height={24} />
        <Skeleton variant="text" width="80%" height={54} />
        <Skeleton variant="rounded" height={120} sx={{ mt: 2 }} />
        <Skeleton variant="rounded" height={220} sx={{ mt: 2 }} />
      </div>
    );
  }
  if (episode === null) {
    return (
      <div className="page">
        <Box className="panel" sx={{ textAlign: 'center' }}>
          <p>Episode not found or its link is invalid.</p>
          <Button component={Link} to="/library" variant="contained">
            Back to library
          </Button>
        </Box>
      </div>
    );
  }

  const title =
    typeof episode.title === 'string' && episode.title.trim()
      ? episode.title
      : 'Untitled episode';
  const tone = typeof episode.tone === 'string' && episode.tone ? episode.tone : 'unknown tone';
  const length = typeof episode.length === 'string' && episode.length ? episode.length : 'unknown length';
  const date = new Date(episode.date);
  const dateLabel = Number.isNaN(date.getTime()) ? 'unknown date' : date.toLocaleString();

  // Episodes saved before dialogue support only have a flat `script` string —
  // wrap it as a single-speaker segment so old library entries still render
  // and play correctly instead of breaking.
  const segments = Array.isArray(episode.segments) && episode.segments.length > 0
    ? episode.segments
    : [{ speaker: 'Narrator', text: typeof episode.script === 'string' ? episode.script : '' }];
  const tags = Array.isArray(episode.tags)
    ? episode.tags.filter((tag) => typeof tag === 'string' && tag.trim())
    : [];
  const meterCards = buildMeterCards(segments, length);

  function handleRemix() {
    navigate('/create', {
      state: {
        prefill: {
          topic: episode.topic,
          tone: episode.tone,
          length: episode.length,
          hosts: episode.hosts,
          hostPersonaId: episode.hostPersonaId,
          tags,
        },
      },
    });
  }

  function handleExportTranscript() {
    const transcript = segments.map((seg) => `${seg.speaker}: ${seg.text}`).join('\n');
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'podwave-transcript';

    link.href = url;
    link.download = `${safeTitle}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleCopyShareLink() {
    try {
      const payload = {
        topic: episode.topic,
        tone: episode.tone,
        hosts: episode.hosts,
        hostPersonaId: episode.hostPersonaId,
        segments,
      };
      const encoded = encodeSharePayload(payload);
      if (encoded.length > 120000) {
        setShareStatus('This episode is too large to fit into a share link.');
        return;
      }

      const shareUrl = `${window.location.origin}/shared?data=${encoded}`;
      await copyToClipboard(shareUrl);
      setShareStatus('Share link copied.');
    } catch {
      setShareStatus('Could not create a share link for this episode.');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <Link to="/library" className="muted mono" style={{ fontSize: 12 }}>← back to library</Link>
      <h2 style={{ margin: '10px 0 4px' }}>{title}</h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        {tone} · {length} · {dateLabel}
      </p>

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {tags.map((tag) => (
            <span key={tag} className="pill">{tag}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <Button onClick={handleRemix} variant="contained">
          Remix
        </Button>
        <Button onClick={handleExportTranscript} variant="outlined">
          Export transcript
        </Button>
        <Button onClick={handleCopyShareLink} variant="outlined">
          Copy share link
        </Button>
      </div>
      {shareStatus && (
        <p className="mono muted" style={{ marginTop: -8, marginBottom: 20, fontSize: 12 }}>
          {shareStatus}
        </p>
      )}

      {meterCards.length > 0 && (
        <div className="meter-grid">
          {meterCards.map((meter) => (
            <MeterCard key={meter.id} {...meter} />
          ))}
        </div>
      )}

      <AudioPlayer
        segments={segments}
        hosts={episode.hosts}
        hostPersonaId={episode.hostPersonaId}
        tone={episode.tone}
      />

      <div className="panel" style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 14 }}>Transcript</h4>
        <Transcript segments={segments} />
      </div>
    </div>
  );
}

function encodeSharePayload(payload) {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function MeterCard({ label, value, percent, color }) {
  return (
    <div className="meter-card">
      <div className="meter-label mono muted">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="meter-track" aria-hidden="true">
        <div
          className="meter-fill"
          style={{
            width: `${Math.max(3, Math.min(100, percent))}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function buildMeterCards(segments, length) {
  const cleanSegments = Array.isArray(segments)
    ? segments.filter((segment) => typeof segment?.text === 'string' && segment.text.trim())
    : [];
  if (cleanSegments.length === 0) return [];

  const wordCountsBySpeaker = new Map();
  let totalWords = 0;
  let switches = 0;
  let previousSpeaker = null;

  cleanSegments.forEach((segment) => {
    const speaker = typeof segment.speaker === 'string' && segment.speaker.trim() ? segment.speaker.trim() : 'Host';
    const wordCount = countWords(segment.text);
    if (wordCount <= 0) return;

    totalWords += wordCount;
    wordCountsBySpeaker.set(speaker, (wordCountsBySpeaker.get(speaker) || 0) + wordCount);

    if (previousSpeaker && speaker !== previousSpeaker) switches += 1;
    previousSpeaker = speaker;
  });

  if (totalWords <= 0) return [];

  const speakerMeters = [...wordCountsBySpeaker.entries()].slice(0, 2).map(([speaker, words], index) => ({
    id: `host-${speaker}`,
    label: speaker.toUpperCase(),
    value: `${Math.round((words / totalWords) * 100)}%`,
    percent: (words / totalWords) * 100,
    color: index === 0 ? 'var(--gold)' : 'var(--teal)',
  }));

  const paceMeter = buildPaceMeter(totalWords, length);
  const exchangeMeter =
    cleanSegments.length > 1
      ? {
          id: 'back-and-forth',
          label: 'BACK-AND-FORTH',
          value: `${switches} exchanges`,
          percent: (switches / cleanSegments.length) * 100,
          color: 'var(--gold)',
        }
      : null;

  return [...speakerMeters, paceMeter, exchangeMeter].filter(Boolean);
}

function buildPaceMeter(totalWords, length) {
  if (!['short', 'medium', 'long'].includes(length)) return null;

  const duration = parseDurationEstimate(length);
  if (!duration) return null;

  const wpm = Math.round(totalWords / duration);
  if (!Number.isFinite(wpm) || wpm <= 0) return null;

  const minWpm = 90;
  const maxWpm = 190;
  return {
    id: 'pace',
    label: 'PACE',
    value: `${wpm} wpm`,
    percent: ((wpm - minWpm) / (maxWpm - minWpm)) * 100,
    color: 'var(--teal)',
  };
}

function parseDurationEstimate(length) {
  const estimate = estimateDurationMinutes(length);
  const values = estimate.match(/\d+/g)?.map(Number).filter((value) => Number.isFinite(value) && value > 0) || [];
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countWords(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}
