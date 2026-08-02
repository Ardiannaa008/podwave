import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, TableSortLabel } from '@mui/material';

export default function EpisodeTable({ episodes, onDelete }) {
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // useMemo: avoid re-filtering/re-sorting the full episode list on every
  // unrelated re-render (e.g. theme toggle) — only recompute when inputs change.
  const rows = useMemo(() => {
    const episodeList = Array.isArray(episodes) ? episodes : [];

    const sorted = [...episodeList].sort((a, b) => {
      let av = a?.[sortKey];
      let bv = b?.[sortKey];
      if (sortKey === 'date') {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      }
      if (sortKey === 'wordCount') {
        av = Number(av) || 0;
        bv = Number(bv) || 0;
      }
      if (sortKey === 'title' || sortKey === 'topic') {
        av = typeof av === 'string' ? av : '';
        bv = typeof bv === 'string' ? bv : '';
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (!Number.isFinite(av)) av = 0;
      if (!Number.isFinite(bv)) bv = 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return sorted;
  }, [episodes, sortKey, sortDir]);

  function sortLabel(label, key) {
    return (
      <TableSortLabel
        active={sortKey === key}
        direction={sortKey === key ? sortDir : 'asc'}
        onClick={() => toggleSort(key)}
      >
        {label}
      </TableSortLabel>
    );
  }

  return (
    <div className="panel">
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No episodes match those filters.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th aria-sort={sortKey === 'title' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  {sortLabel('Title', 'title')}
                </th>
                <th aria-sort={sortKey === 'topic' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  {sortLabel('Topic', 'topic')}
                </th>
                <th aria-sort={sortKey === 'wordCount' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  {sortLabel('Length', 'wordCount')}
                </th>
                <th>Tags</th>
                <th aria-sort={sortKey === 'date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  {sortLabel('Created', 'date')}
                </th>
                <th aria-label="Episode actions"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ep, index) => {
                const id = typeof ep.id === 'string' ? ep.id : '';
                const title = typeof ep.title === 'string' && ep.title.trim() ? ep.title : 'Untitled episode';
                const topic = typeof ep.topic === 'string' && ep.topic.trim() ? ep.topic : 'No topic';
                const wordCount = Number(ep.wordCount) || 0;
                const tags = Array.isArray(ep.tags)
                  ? ep.tags.filter((tag) => typeof tag === 'string' && tag.trim())
                  : [];
                const date = new Date(ep.date);
                const dateLabel = Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();

                return (
                <tr key={id || `episode-${index}`}>
                  <td>{id ? <Link to={`/episode/${id}`}>{title}</Link> : title}</td>
                  <td className="muted">{topic}</td>
                  <td className="mono">{wordCount} words</td>
                  <td>
                    {tags.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {tags.map((tag) => (
                          <span key={tag} className="pill">{tag}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="mono muted">{dateLabel}</td>
                  <td>
                    <Button
                      onClick={() => onDelete(id)}
                      color="error"
                      size="small"
                      disabled={!id}
                      aria-label={`Delete ${title}`}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
