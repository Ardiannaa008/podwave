import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@mui/material';
import AudioPlayer from '../components/AudioPlayer';
import Transcript from '../components/Transcript';

const MAX_SHARE_DATA_LENGTH = 120000;

export default function SharedEpisode() {
  const [searchParams] = useSearchParams();
  const data = searchParams.get('data') || '';
  const episode = decodeSharedEpisode(data);

  if (!episode) {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h2 style={{ marginBottom: 10 }}>This link couldn't be read</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            The shared episode link may be incomplete, expired, or too large for the browser to open.
          </p>
          <Button component={Link} to="/" variant="contained">
            Go to Podwave
          </Button>
        </div>
      </div>
    );
  }

  const title = episode.topic || 'Shared Podwave episode';

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <Link to="/" className="muted mono" style={{ fontSize: 12 }}>Podwave shared episode</Link>
      <h2 style={{ margin: '10px 0 4px' }}>{title}</h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        {episode.tone || 'podcast'} episode
      </p>

      <AudioPlayer
        segments={episode.segments}
        hosts={episode.hosts}
        hostPersonaId={episode.hostPersonaId}
      />

      <div className="panel" style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 14 }}>Transcript</h4>
        <Transcript segments={episode.segments} />
      </div>
    </div>
  );
}

function decodeSharedEpisode(data) {
  try {
    if (!data || data.length > MAX_SHARE_DATA_LENGTH) return null;

    const binary = atob(data);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const segments = normalizeSegments(parsed?.segments);

    if (segments.length === 0) return null;

    return {
      topic: typeof parsed.topic === 'string' ? parsed.topic : 'Shared Podwave episode',
      tone: typeof parsed.tone === 'string' ? parsed.tone : '',
      hosts: Array.isArray(parsed.hosts) ? parsed.hosts : undefined,
      hostPersonaId: typeof parsed.hostPersonaId === 'string' ? parsed.hostPersonaId : undefined,
      segments,
    };
  } catch {
    return null;
  }
}

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];

  return segments
    .map((segment) => ({
      speaker: typeof segment?.speaker === 'string' && segment.speaker.trim() ? segment.speaker.trim() : 'Host',
      text: typeof segment?.text === 'string' ? segment.text.trim() : '',
    }))
    .filter((segment) => segment.text);
}
