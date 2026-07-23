import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Box, Button, Skeleton } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getEpisode } from '../utils/storage';
import AudioPlayer from '../components/AudioPlayer';
import Transcript from '../components/Transcript';

export default function EpisodeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [episode, setEpisode] = useState(undefined);

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

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <Link to="/library" className="muted mono" style={{ fontSize: 12 }}>← back to library</Link>
      <h2 style={{ margin: '10px 0 4px' }}>{title}</h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        {tone} · {length} · {dateLabel}
      </p>

      <AudioPlayer segments={segments} />

      <div className="panel" style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 14 }}>Transcript</h4>
        <Transcript segments={segments} />
      </div>
    </div>
  );
}
