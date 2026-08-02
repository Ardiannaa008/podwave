import axios from 'axios';

const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VALID_TONES = ['casual', 'formal', 'comedic', 'dramatic'];
const VALID_LENGTHS = ['short', 'medium', 'long'];
const MAX_TOPIC_LENGTH = 180;
const MAX_SEGMENTS = 120;
const EXCHANGE_TARGETS = { short: 14, medium: 26, long: 42 };
const MAX_TOKENS_BY_LENGTH = { short: 1500, medium: 2800, long: 4200 };

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
  [
    (t) => `A personal example helps here: I remember first running into ${t} and realizing the easy answer was missing half the story.`,
    (t) => `That's the kind of moment where the topic stops being abstract and starts feeling practical.`,
  ],
  [
    (t) => `Here's the counterexample, though: sometimes ${t} gets worse when people try to optimize it too early.`,
    (t) => `I agree, and that's a good reminder that more effort is not always the same as better judgment.`,
  ],
  [
    (t) => `Let's zoom out for a second, because ${t} is really connected to incentives, habits, and how people make tradeoffs.`,
    (t) => `Exactly. The bigger pattern matters as much as the individual decision.`,
  ],
  [
    (t) => `If a listener asked where to start with ${t}, I would tell them to notice the first point where things feel confusing.`,
    (t) => `That's useful because confusion usually points to the assumption that needs to be made visible.`,
  ],
  [
    (t) => `One underrated part of ${t} is knowing what not to do.`,
    (t) => `Yes, avoiding the common traps can move you forward faster than chasing every advanced trick.`,
  ],
  [
    (t) => `The practical test for ${t} is whether it changes what someone actually does tomorrow.`,
    (t) => `That's a high bar, but it keeps the conversation grounded instead of theoretical.`,
  ],
  [
    (t) => `I want to push back slightly, because ${t} can sound neat in theory and still get messy in real life.`,
    (t) => `That's true. The messy version is usually where the most useful lessons are hiding.`,
  ],
  [
    (t) => `Another angle is the emotional side of ${t}, because people rarely make these choices like spreadsheets.`,
    (t) => `Right, there is usually anxiety, pride, curiosity, or pressure mixed into the decision.`,
  ],
  [
    (t) => `A useful way to explain ${t} is to separate the signal from the noise.`,
    (t) => `And once you do that, the next step usually becomes much easier to see.`,
  ],
  [
    (t) => `The part of ${t} that deserves more attention is the boring middle, where consistency matters more than insight.`,
    (t) => `That is where most people either build momentum or quietly drift away from the goal.`,
  ],
  [
    (t) => `There is also a timing question with ${t}: when do you act, and when do you keep learning?`,
    (t) => `That tension is real, because waiting too long and moving too fast can both create problems.`,
  ],
  [
    (t) => `One question I would leave people with is what ${t} looks like when it is done well, not perfectly.`,
    (t) => `That distinction matters. Perfect is intimidating, but well-done is something people can actually aim for.`,
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

function pickExchangeTemplates(exchangeCount) {
  const selected = [];

  while (selected.length < exchangeCount) {
    const batch = [...EXCHANGE_TEMPLATES].sort(() => Math.random() - 0.5);
    if (selected.length > 0 && batch[0] === selected[selected.length - 1]) {
      batch.push(batch.shift());
    }
    selected.push(...batch);
  }

  return selected.slice(0, exchangeCount);
}

function fallbackDialogue(topic, tone, length) {
  const exchangeCount = { short: 7, medium: 13, long: 21 }[length] || 13;
  const shuffled = pickExchangeTemplates(exchangeCount);
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

export function estimateDurationMinutes(length) {
  const safeLength = VALID_LENGTHS.includes(length) ? length : 'medium';
  const estimatedMinutes = (EXCHANGE_TARGETS[safeLength] * 18) / 130;
  const lower = Math.max(1, Math.round(estimatedMinutes));
  const upper = Math.max(lower + 1, Math.ceil(estimatedMinutes + 1));

  return `~${lower}-${upper} min`;
}

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

  const exchangeTarget = EXCHANGE_TARGETS[length] || EXCHANGE_TARGETS.medium;
  const maxTokens = MAX_TOKENS_BY_LENGTH[length] || MAX_TOKENS_BY_LENGTH.medium;

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
            `The conversation must contain at least ${exchangeTarget} lines total - do not stop early. ` +
            'Build a clear intro, then 2-3 distinct sub-topics, then a wrap-up. ' +
            'Make the content substantive and specific, with concrete examples, a brief mini-anecdote, ' +
            'a counterpoint or disagreement between the hosts, and practical takeaways instead of repetitive filler. ' +
            'Each "text" value must be plain spoken words only — no stage directions, no sound cues like [music], ' +
            'no asterisks, no markdown, no emoji. Make it sound like a natural back-and-forth conversation, ' +
            'with each host reacting to what the other just said, not just alternating monologues.',
        },
        {
          role: 'user',
          content: `Write a ${tone} two-host podcast conversation about "${cleanTopic}" with at least ${exchangeTarget} total lines of dialogue.`,
        },
      ],
      max_tokens: maxTokens,
    },
    {
      timeout: 45000,
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
