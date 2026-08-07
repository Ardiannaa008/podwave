import axios from 'axios';
import { HOST_PERSONAS } from './scriptGenerator';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
];
const SAMPLE_RATE = 24000;
const CHANNEL_COUNT = 1;
const BYTES_PER_SAMPLE = 2;
const GEMINI_TTS_TIMEOUT_MS = 90000;

const GEMINI_VOICES = {
  female: ['Aoede', 'Leda', 'Laomedeia', 'Autonoe', 'Achernar', 'Vindemiatrix'],
  male: ['Charon', 'Orus', 'Iapetus', 'Algenib', 'Rasalgethi', 'Alnilam'],
  neutral: ['Puck', 'Kore', 'Zephyr', 'Achird', 'Sulafat', 'Schedar'],
};

const TONE_STYLE = {
  casual: 'Keep the read warm, conversational, relaxed, and naturally paced.',
  formal: 'Use precise articulation, measured pacing, and restrained reactions.',
  comedic: 'Bring playful timing, dry asides, and a visible smile in the delivery without sounding cartoonish.',
  dramatic: 'Build tension and contrast, with more weight on reveals and reflective turns.',
};

export async function generateEpisodeAudio({ segments, hosts, tone, hostPersonaId, signal } = {}) {
  if (!GEMINI_API_KEY) {
    throw createTtsError('Gemini API key is not configured.', 'NO_API_KEY');
  }

  const cleanSegments = normalizeSegments(segments);
  if (cleanSegments.length === 0) {
    throw createTtsError('There is no episode transcript to narrate.', 'EMPTY_TRANSCRIPT');
  }

  const speakerNames = resolveSpeakerNames(cleanSegments, hosts);
  if (speakerNames.length < 2) {
    throw createTtsError('Gemini multi-speaker narration needs two speakers.', 'INVALID_SPEAKERS');
  }

  const hostPersona = resolveHostPersona(speakerNames, hostPersonaId);
  const prompt = buildTtsPrompt({
    segments: cleanSegments,
    speakerNames,
    tone,
    hostPersona,
  });

  try {
    let lastError = null;

    for (const model of GEMINI_TTS_MODELS) {
      try {
        const response = await axios.post(
          buildGeminiTtsUrl(model),
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: buildSpeakerVoiceConfigs(speakerNames, hostPersona),
                },
              },
            },
          },
          {
            timeout: GEMINI_TTS_TIMEOUT_MS,
            signal,
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_API_KEY,
            },
          }
        );

        const pcmBase64 = extractAudioData(response.data);
        if (!pcmBase64) {
          throw createTtsError('Gemini returned no audio data.', 'EMPTY_RESPONSE');
        }

        const blob = pcmBase64ToWavBlob(pcmBase64);
        return { blob, objectUrl: URL.createObjectURL(blob), model };
      } catch (error) {
        if (isTerminalTtsError(error)) throw error;
        lastError = error;
      }
    }

    throw normalizeGeminiError(lastError);
  } catch (error) {
    if (error?.isPodwaveTtsError) throw error;
    throw normalizeGeminiError(error);
  }
}

function buildGeminiTtsUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function isTerminalTtsError(error) {
  return (
    error?.isPodwaveTtsError ||
    axios.isCancel?.(error) ||
    error?.code === 'ERR_CANCELED' ||
    error?.response?.status === 401 ||
    error?.response?.status === 403
  );
}

function normalizeGeminiError(error) {
  if (error?.isPodwaveTtsError) return error;
  if (axios.isCancel?.(error) || error?.code === 'ERR_CANCELED') {
    return createTtsError('Gemini narration was cancelled.', 'CANCELED');
  }
  if (error?.code === 'ECONNABORTED') {
    return createTtsError('Gemini narration took too long.', 'TIMEOUT');
  }

  const status = error?.response?.status;
  if (status === 401 || status === 403) {
    return createTtsError('Gemini API key was rejected.', 'AUTH');
  }
  if (status === 429) {
    return createTtsError('Gemini voice quota reached.', 'RATE_LIMIT');
  }

  return createTtsError('Could not reach Gemini narration.', 'NETWORK');
}

export function pcmBase64ToWavBlob(base64Data, sampleRate = SAMPLE_RATE) {
  const pcm = base64ToUint8Array(base64Data);
  const wavBuffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(wavBuffer);
  const bytes = new Uint8Array(wavBuffer);
  const byteRate = sampleRate * CHANNEL_COUNT * BYTES_PER_SAMPLE;
  const blockAlign = CHANNEL_COUNT * BYTES_PER_SAMPLE;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNEL_COUNT, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcm.length, true);
  bytes.set(pcm, 44);

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function buildSpeakerVoiceConfigs(speakerNames, hostPersona) {
  const usedVoices = new Set();

  return speakerNames.slice(0, 2).map((speaker, index) => {
    const voiceName = pickGeminiVoice(hostPersona?.voiceProfile?.[index]?.gender, usedVoices, index);
    usedVoices.add(voiceName);

    return {
      speaker,
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName },
      },
    };
  });
}

function pickGeminiVoice(gender = 'neutral', usedVoices, index) {
  const preferredVoices = GEMINI_VOICES[gender] || GEMINI_VOICES.neutral;
  const voice = preferredVoices.find((candidate) => !usedVoices.has(candidate));
  if (voice) return voice;

  const fallbackVoices = [...GEMINI_VOICES.neutral, ...GEMINI_VOICES.female, ...GEMINI_VOICES.male];
  return fallbackVoices.find((candidate) => !usedVoices.has(candidate)) || fallbackVoices[index % fallbackVoices.length];
}

function buildTtsPrompt({ segments, speakerNames, tone, hostPersona }) {
  const transcript = segments.map((segment) => `${segment.speaker}: ${segment.text}`).join('\n');
  const styleLines = buildStyleLines(speakerNames, tone, hostPersona);

  return [
    `TTS the following two-host podcast conversation between ${speakerNames[0]} and ${speakerNames[1]}.`,
    ...styleLines,
    'Read the transcript exactly as written. Preserve the speaker turns and make it sound like a polished broadcast conversation.',
    '',
    transcript,
  ].join('\n');
}

function buildStyleLines(speakerNames, tone, hostPersona) {
  const toneLine = TONE_STYLE[tone] || TONE_STYLE.casual;
  if (!hostPersona) {
    return [`Overall tone: ${toneLine}`];
  }

  const [firstHost, secondHost] = speakerNames;
  return [
    `Overall tone: ${toneLine}`,
    `Host dynamic: ${hostPersona.dynamic}`,
    `${firstHost} sounds ${describeHostVoice(hostPersona, 0)}.`,
    `${secondHost} sounds ${describeHostVoice(hostPersona, 1)}.`,
  ];
}

function describeHostVoice(hostPersona, index) {
  const role = index === 0 ? hostPersona.firstRole : hostPersona.secondRole;
  const voiceTrait = hostPersona.voiceProfile?.[index];
  const genderHint =
    voiceTrait?.gender === 'female'
      ? 'with a clear feminine-coded presence'
      : voiceTrait?.gender === 'male'
        ? 'with a clear masculine-coded presence'
        : 'with a natural, characterful presence';

  return `${role}, ${genderHint}, matching the written personality and the episode tone`;
}

function resolveHostPersona(speakerNames, hostPersonaId) {
  if (hostPersonaId) {
    const byId = HOST_PERSONAS.find((persona) => persona.id === hostPersonaId);
    if (byId) return byId;
  }

  return HOST_PERSONAS.find(
    (persona) => persona.names[0] === speakerNames[0] && persona.names[1] === speakerNames[1]
  );
}

function resolveSpeakerNames(segments, hosts) {
  if (Array.isArray(hosts) && hosts.length >= 2) {
    return hosts.slice(0, 2).map((host) => String(host).trim()).filter(Boolean);
  }

  return [...new Set(segments.map((segment) => segment.speaker))].slice(0, 2);
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

function extractAudioData(responseData) {
  const parts = responseData?.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  return audioPart?.inlineData?.data || audioPart?.inline_data?.data || '';
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function createTtsError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.isPodwaveTtsError = true;
  return error;
}
