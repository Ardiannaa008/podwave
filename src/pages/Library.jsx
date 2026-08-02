import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Skeleton, TextField } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getEpisodes, deleteEpisode } from '../utils/storage';
import EpisodeTable from '../components/EpisodeTable';

export default function Library() {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState([]);
  const [topicQuery, setTopicQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
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

  const allTags = useMemo(() => {
    const tagsByKey = new Map();
    episodes.forEach((episode) => {
      const tags = Array.isArray(episode.tags) ? episode.tags : [];
      tags.forEach((tag) => {
        if (typeof tag !== 'string' || !tag.trim()) return;
        const cleanTag = tag.trim();
        const key = cleanTag.toLowerCase();
        if (!tagsByKey.has(key)) tagsByKey.set(key, cleanTag);
      });
    });
    return [...tagsByKey.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ key, label }));
  }, [episodes]);

  const filteredEpisodes = useMemo(() => {
    const normalizedQuery = topicQuery.trim().toLowerCase();
    return episodes.filter((episode) => {
      const topic = typeof episode.topic === 'string' ? episode.topic.toLowerCase() : '';
      const episodeTags = Array.isArray(episode.tags)
        ? episode.tags.map((tag) => String(tag).trim().toLowerCase())
        : [];

      const matchesTopic = !normalizedQuery || topic.includes(normalizedQuery);
      const matchesTags = selectedTags.every((tag) => episodeTags.includes(tag));
      return matchesTopic && matchesTags;
    });
  }, [episodes, selectedTags, topicQuery]);

  function toggleTag(tagKey) {
    setSelectedTags((current) =>
      current.includes(tagKey)
        ? current.filter((tag) => tag !== tagKey)
        : [...current, tagKey]
    );
  }

  if (loading) {
    return (
      <div className="page">
        <LibraryHeader />
        <div style={{ display: 'grid', gap: 16 }}>
          <Skeleton variant="rounded" height={52} />
          <Skeleton variant="rounded" height={220} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <LibraryHeader count={episodes.length} />

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
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="panel">
            <TextField
              label="Search topics"
              placeholder="Filter by topic..."
              value={topicQuery}
              onChange={(e) => setTopicQuery(e.target.value)}
              size="small"
              fullWidth
            />
            {allTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {allTags.map((tag) => {
                  const active = selectedTags.includes(tag.key);
                  return (
                    <button
                      key={tag.key}
                      type="button"
                      className="pill"
                      onClick={() => toggleTag(tag.key)}
                      style={{
                        cursor: 'pointer',
                        background: active ? 'var(--gold-dim)' : 'transparent',
                        color: active ? 'var(--gold)' : 'var(--text-muted)',
                      }}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <EpisodeTable episodes={filteredEpisodes} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}

function LibraryHeader({ count }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="waveform" style={{ height: 40, marginBottom: 12 }} aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <h2 style={{ marginBottom: 6 }}>Your library</h2>
      <p className="muted" style={{ margin: 0 }}>
        {typeof count === 'number'
          ? `${count} episode${count !== 1 ? 's' : ''} saved`
          : 'Loading saved episodes'}
      </p>
    </div>
  );
}
