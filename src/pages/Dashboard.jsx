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
    const recentEpisodes = [...episodes]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    const toneCounts = episodes.reduce((acc, episode) => {
      const tone = typeof episode.tone === 'string' && episode.tone ? episode.tone : 'unknown';
      acc[tone] = (acc[tone] || 0) + 1;
      return acc;
    }, {});
    const topTone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0][0];
    const maxToneCount = Math.max(...Object.values(toneCounts));

    return { total: episodes.length, avgWords, topTone, toneCounts, maxToneCount, recentEpisodes };
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
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <StatCard label="Total episodes" value={stats.total} />
            <StatCard label="Avg. length" value={`${stats.avgWords} words`} />
            <StatCard label="Favorite tone" value={stats.topTone} />
            {stats.total <= 2 && (
              <div className="panel">
                <h4 style={{ marginBottom: 8, fontSize: 13 }} className="mono muted">KEEP GOING</h4>
                <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                  Your console is warming up. Generate a few more episodes to make the trends more useful.
                </p>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div className="panel">
              <h4 style={{ marginBottom: 14, fontSize: 13 }} className="mono muted">TONE BREAKDOWN</h4>
              <div style={{ display: 'grid', gap: 12 }}>
                {Object.entries(stats.toneCounts).map(([tone, count]) => (
                  <div key={tone}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span>{tone}</span>
                      <span className="mono muted">{count}</span>
                    </div>
                    <div
                      aria-hidden="true"
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: 'var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(10, (count / stats.maxToneCount) * 100)}%`,
                          height: '100%',
                          background: 'var(--teal)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h4 style={{ marginBottom: 14, fontSize: 13 }} className="mono muted">RECENT ACTIVITY</h4>
              <div style={{ display: 'grid', gap: 12 }}>
                {stats.recentEpisodes.map((episode, index) => {
                  const id = typeof episode.id === 'string' ? episode.id : '';
                  const title =
                    typeof episode.title === 'string' && episode.title.trim()
                      ? episode.title
                      : 'Untitled episode';
                  const topic =
                    typeof episode.topic === 'string' && episode.topic.trim()
                      ? episode.topic
                      : 'No topic';

                  return (
                    <Link
                      key={id || `recent-${index}`}
                      to={id ? `/episode/${id}` : '/library'}
                      style={{
                        display: 'grid',
                        gap: 4,
                        textDecoration: 'none',
                        paddingBottom: 12,
                        borderBottom:
                          index === stats.recentEpisodes.length - 1 ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                        {title}
                      </span>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {topic}
                      </span>
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        {formatRelativeDate(episode.date)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown date';

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return '1 week ago';
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths <= 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;

  const diffYears = Math.floor(diffDays / 365);
  return diffYears <= 1 ? '1 year ago' : `${diffYears} years ago`;
}

function StatCard({ label, value }) {
  return (
    <div className="panel">
      <div className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--gold)' }}>{value}</div>
    </div>
  );
}
