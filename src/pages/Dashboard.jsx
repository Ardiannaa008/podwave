import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, Skeleton } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getEpisodes } from '../utils/storage';

export default function Dashboard() {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setEpisodes(getEpisodes(user.username));
    setLoading(false);
  }, [user]);

  // useMemo: this aggregation would get more expensive as the library grows,
  // so only recompute when the episode list actually changes.
  const stats = useMemo(() => {
    if (episodes.length === 0) return null;

    const totalWords = episodes.reduce((sum, episode) => sum + (Number(episode.wordCount) || 0), 0);
    const avgWords = Math.round(totalWords / episodes.length);

    const toneCounts = episodes.reduce((acc, episode) => {
      const tone = typeof episode.tone === 'string' && episode.tone ? episode.tone : 'unknown';
      acc[tone] = (acc[tone] || 0) + 1;
      return acc;
    }, {});
    const topTone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0][0];

    return { total: episodes.length, avgWords, topTone, toneCounts };
  }, [episodes]);

  if (loading) {
    return (
      <div className="page">
        <h2 style={{ marginBottom: 24 }}>Dashboard</h2>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
          <Skeleton variant="rounded" height={90} />
          <Skeleton variant="rounded" height={90} />
          <Skeleton variant="rounded" height={90} />
          <Skeleton variant="rounded" height={90} />
        </Box>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 style={{ marginBottom: 24 }}>Dashboard</h2>

      {!stats ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p className="muted" style={{ marginBottom: 20 }}>
            Generate a few episodes to see your stats here.
          </p>
          <Button component={Link} to="/create" variant="contained">
            Generate your first episode →
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <StatCard label="Total episodes" value={stats.total} />
          <StatCard label="Avg. length" value={`${stats.avgWords} words`} />
          <StatCard label="Favorite tone" value={stats.topTone} />
          <div className="panel">
            <h4 style={{ marginBottom: 10, fontSize: 13 }} className="mono muted">TONE BREAKDOWN</h4>
            {Object.entries(stats.toneCounts).map(([tone, count]) => (
              <div key={tone} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span>{tone}</span>
                <span className="mono muted">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="panel">
      <div className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--gold)' }}>{value}</div>
    </div>
  );
}
