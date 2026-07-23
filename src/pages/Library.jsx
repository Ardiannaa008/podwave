import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, Skeleton } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getEpisodes, deleteEpisode } from '../utils/storage';
import EpisodeTable from '../components/EpisodeTable';

export default function Library() {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // useEffect: load this user's episodes whenever the page mounts
  // (stands in for an API fetch — see utils/storage.js for the data layer,
  // easily swappable for an axios call to a real backend).
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setEpisodes(getEpisodes(user.username));
    setLoading(false);
  }, [user]);

  function handleDelete(id) {
    const updated = deleteEpisode(user.username, id);
    setEpisodes(updated);
  }

  if (loading) {
    return (
      <div className="page">
        <h2 style={{ marginBottom: 6 }}>Your library</h2>
        <Box sx={{ mt: 3 }}>
          <Skeleton variant="rounded" height={44} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={220} />
        </Box>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 style={{ marginBottom: 6 }}>Your library</h2>
      <p className="muted" style={{ marginBottom: 24 }}>
        {episodes.length} episode{episodes.length !== 1 ? 's' : ''} saved
      </p>

      {episodes.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p className="muted" style={{ marginBottom: 20 }}>
            No episodes yet — your first one is just a topic away.
          </p>
          <Button component={Link} to="/create" variant="contained">
            Generate your first episode →
          </Button>
        </div>
      ) : (
        <EpisodeTable episodes={episodes} onDelete={handleDelete} />
      )}
    </div>
  );
}
