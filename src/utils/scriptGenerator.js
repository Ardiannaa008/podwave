import axios from 'axios';

const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VALID_TONES = ['casual', 'formal', 'comedic', 'dramatic'];
const VALID_LENGTHS = ['short', 'medium', 'long'];
const MAX_TOPIC_LENGTH = 180;
const MAX_SEGMENTS = 60;

// A generated episode is always an array of segments:
// [{ speaker: 'Alex' | 'Jamie', text: '...' }, ...]
// This shape is what both the transcript view and the two-voice player consume.

function cleanLine(text) {
  return text
    .replace(/\[[^\]]*\]/g, '')  // [music plays], [pause], etc.
    .replace(/\([^)]*\)/g, '')   // (laughs), (sighs), etc.
    .replace(/\*\*?/g, '')       // stray markdown asterisks
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Offline fallback: alternating two-host template ----------

const HOSTS = ['Alex', 'Jamie'];

const OPENERS = [
  (t) => `Welcome back to Podwave. Today we're getting into ${t}.`,
  (t) => `Alright, let's talk about ${t} — this one's been on my mind.`,
  (t) => `So today's episode is all about ${t}. Should be a good one.`,
];

const REPLIES_TO_OPENER = [
  (t) => `Yeah, I've been wanting to dig into ${t} for a while now.`,
  (t) => `Honestly, ${t} is more interesting than people give it credit for.`,
  (t) => `I'm glad we're finally covering ${t}.`,
];

const EXCHANGE_TEMPLATES = [
  [
    (t, tone) => `One thing that stands out about ${t} is how differently people approach it from a ${tone} angle.`,
    (t) => `That's fair. What do you think trips people up the most?`,
  ],
  [
    (t) => `A lot of the confusion around ${t} comes from skipping the basics.`,
    (t) => `Right, everyone wants the advanced version before they've nailed the fundamentals.`,
  ],
  [
    (t) => `If you've ever struggled with ${t}, you're definitely not alone.`,
    (t) => `It trips up way more people than you'd think, honestly.`,
  ],
  [
    (t) => `Here's something most people miss about ${t}: it's usually simpler than it looks.`,
    (t) => `It's just explained badly most of the time.`,
  ],
  [
    (t) => `There's a common myth about ${t} that really needs to be retired.`,
    (t) => `Which one are you thinking of?`,
  ],
  [
    (t) => `What's interesting is how much ${t} has changed in the last couple of years.`,
    (t) => `Yeah, it barely resembles what it used to be.`,
  ],
];

const CLOSERS = [
  [
    (t) => `That's the episode on ${t} for today.`,
    () => `Thanks for listening to Podwave — catch you next time.`,
  ],
  [
    (t) => `And that wraps up ${t}.`,
    () => `If this one helped, share it with someone who needs to hear it.`,
  ],
];

function fallbackDialogue(topic, tone, length) {
  const exchangeCount = { short: 2, medium: 4, long: 6 }[length] || 4;
  const shuffled = [...EXCHANGE_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, exchangeCount);
  const closer = CLOSERS[Math.floor(Math.random() * CLOSERS.length)];

  const segments = [
    { speaker: HOSTS[0], text: OPENERS[0](topic) },
    { speaker: HOSTS[1], text: REPLIES_TO_OPENER[0](topic) },
  ];

  shuffled.forEach(([a, b]) => {
    segments.push({ speaker: HOSTS[0], text: a(topic, tone) });
    segments.push({ speaker: HOSTS[1], text: b(topic, tone) });
  });

  segments.push({ speaker: HOSTS[0], text: closer[0](topic) });
  segments.push({ speaker: HOSTS[1], text: closer[1](topic) });

  return segments;
}

// ---------- Real AI generation via Groq, returned as JSON segments ----------

export async function generateScript({ topic, tone, length }) {
  const cleanTopic = typeof topic === 'string' ? topic.trim() : '';
  if (cleanTopic.length < 3) {
    throw new Error('A topic with at least 3 characters is required.');
  }
  if (cleanTopic.length > MAX_TOPIC_LENGTH) {
    throw new Error(`The topic must be ${MAX_TOPIC_LENGTH} characters or fewer.`);
  }
  if (!VALID_TONES.includes(tone) || !VALID_LENGTHS.includes(length)) {
    throw new Error('The selected tone or length is not valid.');
  }

  if (!GROQ_API_KEY) {
    // Simulate network delay so loading states are demoable.
    await new Promise((r) => setTimeout(r, 900));
    return fallbackDialogue(cleanTopic, tone, length);
  }

  const exchangeTarget = { short: 6, medium: 12, long: 20 }[length] || 12;

  const response = await axios.post(
    GROQ_URL,
    {
      model: 'llama-3.1-8b-instant',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You write two-host podcast dialogue that gets fed directly into a text-to-speech engine, one line at a time. ' +
            'Respond with ONLY valid JSON, no markdown fences, no explanation text before or after. ' +
            'Use exactly this shape, with the key "segments" at the top level: ' +
            '{"segments":[{"speaker":"Alex","text":"Welcome back to the show."},{"speaker":"Jamie","text":"Glad to be here."}]}. ' +
            'Always alternate between exactly two speakers named "Alex" and "Jamie", starting with Alex. ' +
            'Each "text" value must be plain spoken words only — no stage directions, no sound cues like [music], ' +
            'no asterisks, no markdown, no emoji. Make it sound like a natural back-and-forth conversation, ' +
            'with each host reacting to what the other just said, not just alternating monologues.',
        },
        {
          role: 'user',
          content: `Write a ${tone} two-host podcast conversation about "${cleanTopic}" with roughly ${exchangeTarget} total lines of dialogue.`,
        },
      ],
    },
    {
      timeout: 25000,
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const raw = response.data?.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') {
    throw new Error('The AI service returned an unexpected response.');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('Groq response was not valid JSON:', raw);
    throw new Error('The AI service returned a response that could not be read as dialogue.');
  }

  const rawSegments = extractSegmentArray(parsed);
  const segments = rawSegments
    .map((seg) => ({
      speaker: extractField(seg, ['speaker', 'name', 'host']) || 'Host',
      text: cleanLine(extractField(seg, ['text', 'line', 'content', 'message']) || ''),
    }))
    .filter((seg) => seg.text.length > 0)
    .slice(0, MAX_SEGMENTS);

  if (segments.length === 0) {
    // Log the raw parsed shape so it's actually debuggable from devtools
    // instead of just failing silently with a generic message.
    console.error('Groq returned JSON but no usable dialogue segments were found:', parsed);
    throw new Error(
      'The AI service returned a conversation in an unexpected format. Check the browser console for the raw response, or try again.'
    );
  }

  return segments;
}

// Groq sometimes wraps the array under a different key than "segments"
// (e.g. "dialogue", "conversation"), or occasionally returns the array
// directly with no wrapper object at all. Try the shapes we've actually
// seen before giving up.
function extractSegmentArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];

  for (const key of ['segments', 'dialogue', 'conversation', 'script', 'lines']) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }

  // Last resort: use the first array value found anywhere on the object.
  const firstArrayValue = Object.values(parsed).find((v) => Array.isArray(v));
  return firstArrayValue || [];
}

function extractField(obj, keys) {
  for (const key of keys) {
    if (typeof obj?.[key] === 'string' && obj[key].trim()) return obj[key].trim();
  }
  return '';
}
