// Reusable across Create.jsx and EpisodeDetail.jsx — renders a two-host
// dialogue as an alternating chat-style transcript, and optionally
// highlights whichever line is currently being spoken.
const SPEAKER_COLORS = ['var(--gold)', 'var(--teal)'];

export default function Transcript({ segments, activeIndex = -1 }) {
  const speakerOrder = [];
  segments.forEach((s) => {
    if (!speakerOrder.includes(s.speaker)) speakerOrder.push(s.speaker);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {segments.map((seg, i) => {
        const speakerIndex = speakerOrder.indexOf(seg.speaker) % SPEAKER_COLORS.length;
        const isActive = i === activeIndex;
        return (
          <div
            key={i}
            style={{
              alignSelf: speakerIndex === 0 ? 'flex-start' : 'flex-end',
              maxWidth: '80%',
              background: isActive ? 'var(--panel-hover)' : 'var(--panel)',
              border: `1px solid ${isActive ? SPEAKER_COLORS[speakerIndex] : 'var(--border)'}`,
              borderRadius: 12,
              padding: '10px 14px',
            }}
          >
            <div
              className="mono"
              style={{ fontSize: 11, color: SPEAKER_COLORS[speakerIndex], marginBottom: 4 }}
            >
              {seg.speaker}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{seg.text}</div>
          </div>
        );
      })}
    </div>
  );
}
