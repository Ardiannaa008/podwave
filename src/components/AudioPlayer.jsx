import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { HOST_VOICE_PROFILES } from '../utils/scriptGenerator';
import { generateEpisodeAudio } from '../utils/ttsGemini';

const GEMINI_QUOTA_COOLDOWN_KEY = 'podwave_gemini_quota_cooldown_until';
const GEMINI_QUOTA_COOLDOWN_MS = 10 * 60 * 1000;

// Splits one segment's text into small chunks, because some browsers stop a
// single SpeechSynthesisUtterance before a long passage has finished.
function splitIntoSpeechChunks(text, maxLength = 220) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const chunks = [];

  sentences.forEach((sentence) => {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) return;

    if (cleanSentence.length <= maxLength) {
      chunks.push(cleanSentence);
      return;
    }

    const words = cleanSentence.split(/\s+/);
    let chunk = '';
    words.forEach((word) => {
      if (`${chunk} ${word}`.trim().length > maxLength && chunk) {
        chunks.push(chunk);
        chunk = word;
      } else {
        chunk = `${chunk} ${word}`.trim();
      }
    });
    if (chunk) chunks.push(chunk);
  });

  return chunks;
}

// Picks up to two distinct voices for two speakers, and gives each speaker a
// distinct base pitch too — even when the OS only has one usable voice,
// pitch alone makes two hosts sound noticeably different from each other.
const SPEAKER_BASE_PITCH = [1.0, 1.18];
const SPEAKER_BASE_RATE = [1.0, 1.0];
const VOICE_GENDER_MATCHERS = {
  female: [
    'female',
    'zira',
    'samantha',
    'victoria',
    'karen',
    'susan',
    'linda',
    'moira',
    'tessa',
    'fiona',
    'google us english',
    'hazel',
  ],
  male: [
    'male',
    'david',
    'mark',
    'alex',
    'daniel',
    'fred',
    'george',
    'james',
  ],
};

function stableHash(value) {
  return String(value)
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function getHostVoiceProfile({ hosts, hostPersonaId }) {
  if (hostPersonaId && HOST_VOICE_PROFILES[hostPersonaId]) {
    return HOST_VOICE_PROFILES[hostPersonaId];
  }

  if (Array.isArray(hosts) && hosts.length >= 2) {
    const key = hosts.slice(0, 2).map((name) => String(name).trim()).join('|');
    return HOST_VOICE_PROFILES[key] || null;
  }

  return null;
}

function isEnglishVoice(voice) {
  return voice.lang?.toLowerCase().startsWith('en');
}

function getVoiceGender(voice) {
  const name = voice.name?.toLowerCase() || '';

  if (VOICE_GENDER_MATCHERS.female.some((matcher) => name.includes(matcher))) {
    return 'female';
  }
  if (VOICE_GENDER_MATCHERS.male.some((matcher) => name.includes(matcher))) {
    return 'male';
  }

  return 'neutral';
}

function rotateByOffset(items, offset) {
  if (items.length <= 1) return items;
  const start = offset % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function pickUnusedVoice(candidates, usedVoices) {
  return candidates.find((voice) => !usedVoices.has(voice)) || null;
}

function pickVoiceForGender(gender, allVoices, fallbackPool, voiceOffset, usedVoices) {
  if (gender !== 'female' && gender !== 'male') return null;

  const genderMatches = allVoices.filter((voice) => getVoiceGender(voice) === gender);
  const englishMatches = genderMatches.filter(isEnglishVoice);
  const preferredMatches = englishMatches.length > 0 ? englishMatches : genderMatches;
  const matchedVoice = pickUnusedVoice(rotateByOffset(preferredMatches, voiceOffset), usedVoices);

  if (matchedVoice) return matchedVoice;

  return pickUnusedVoice(rotateByOffset(fallbackPool, voiceOffset), usedVoices);
}

function pickFallbackVoice(pool, voiceOffset, voiceIndex, usedVoices) {
  if (pool.length === 0) return null;

  const orderedPool = rotateByOffset(pool, voiceOffset + voiceIndex);
  return pickUnusedVoice(orderedPool, usedVoices) || orderedPool[0];
}

function nudgePitchForGender(pitch, gender, hasGenderMatchedVoice) {
  if (hasGenderMatchedVoice) return pitch;
  if (gender === 'female') return Math.max(1.15, Math.min(1.35, pitch));
  if (gender === 'male') return Math.min(0.95, Math.max(0.75, pitch));
  return pitch;
}

function pickVoicesForSpeakers(speakerNames, availableVoices, hostContext = {}) {
  const english = availableVoices.filter(isEnglishVoice);
  const pool = english.length >= 2 ? english : availableVoices;
  const personaProfile = getHostVoiceProfile(hostContext);
  const voiceOffset =
    personaProfile && pool.length > 0
      ? stableHash(personaProfile.id || personaProfile.names.join('|')) % pool.length
      : 0;

  const map = {};
  const usedVoices = new Set();
  speakerNames.forEach((name, i) => {
    const personaIndex = personaProfile?.names.indexOf(name) ?? -1;
    const voiceIndex = personaIndex >= 0 ? personaIndex : i;
    const voiceTraits = personaIndex >= 0 ? personaProfile.voiceProfile[personaIndex] : null;
    const gender = voiceTraits?.gender || 'neutral';
    const genderVoice = pickVoiceForGender(gender, availableVoices, pool, voiceOffset, usedVoices);
    const fallbackVoice = genderVoice || pickFallbackVoice(pool, voiceOffset, voiceIndex, usedVoices);
    const hasGenderMatchedVoice = Boolean(genderVoice && getVoiceGender(genderVoice) === gender);
    const basePitch = voiceTraits?.pitch ?? SPEAKER_BASE_PITCH[i % SPEAKER_BASE_PITCH.length];

    if (fallbackVoice) usedVoices.add(fallbackVoice);

    map[name] = {
      voice: fallbackVoice,
      basePitch: nudgePitchForGender(basePitch, gender, hasGenderMatchedVoice),
      baseRate: voiceTraits?.rate ?? SPEAKER_BASE_RATE[i % SPEAKER_BASE_RATE.length],
    };
  });
  return map;
}

// Web Speech API has no real emotion control, but small, deliberate
// pitch/rate variation based on punctuation — plus a touch of randomness —
// keeps a chunk from sounding perfectly flat. Questions lift in pitch,
// exclamations get a little faster and higher, and every line gets a tiny
// random jitter so back-to-back lines don't sound identically robotic.
function computeProsody(text, basePitch, baseRate) {
  let pitch = basePitch;
  let rate = baseRate;

  if (text.endsWith('?')) pitch += 0.12;
  if (text.endsWith('!')) {
    pitch += 0.08;
    rate *= 1.08;
  }

  pitch += (Math.random() - 0.5) * 0.06;
  rate *= 1 + (Math.random() - 0.5) * 0.06;

  return {
    pitch: Math.min(2, Math.max(0.5, pitch)),
    rate: Math.min(2, Math.max(0.5, rate)),
  };
}

// Builds a flat, ordered playback queue: each segment's text is chunked,
// and every chunk remembers which voice/pitch (i.e. which speaker) it
// belongs to, plus whether it starts a new speaker's turn (for pausing).
function buildPlayQueue(segments, voiceMap, baseRate) {
  const queue = [];
  segments.forEach((seg) => {
    const chunks = splitIntoSpeechChunks(seg.text);
    const speakerInfo = voiceMap[seg.speaker] || { voice: null, basePitch: 1, baseRate: 1 };
    chunks.forEach((chunk, i) => {
      const prosody = computeProsody(chunk, speakerInfo.basePitch, baseRate * speakerInfo.baseRate);
      queue.push({
        text: chunk,
        speaker: seg.speaker,
        voice: speakerInfo.voice,
        pitch: prosody.pitch,
        rate: prosody.rate,
        startsNewTurn: i === 0,
      });
    });
  });
  return queue;
}

function getGeminiQuotaCooldown() {
  try {
    const value = Number(sessionStorage.getItem(GEMINI_QUOTA_COOLDOWN_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function rememberGeminiQuotaCooldown() {
  try {
    sessionStorage.setItem(GEMINI_QUOTA_COOLDOWN_KEY, String(Date.now() + GEMINI_QUOTA_COOLDOWN_MS));
  } catch {
    // If sessionStorage is blocked, the next play can simply try Gemini again.
  }
}

function clearGeminiQuotaCooldown() {
  try {
    sessionStorage.removeItem(GEMINI_QUOTA_COOLDOWN_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

function hasGeminiQuotaCooldown() {
  const cooldownUntil = getGeminiQuotaCooldown();
  if (!cooldownUntil) return false;
  if (cooldownUntil > Date.now()) return true;

  clearGeminiQuotaCooldown();
  return false;
}

export default function AudioPlayer({ segments, voiceRate = 1, hosts, hostPersonaId, tone }) {
  const audioRef = useRef(null);
  const generatedAudioRef = useRef(null);
  const geminiAbortRef = useRef(null);
  const queueRef = useRef([]);
  const indexRef = useRef(0);
  const playSessionRef = useRef(0);
  const [status, setStatus] = useState('idle'); // idle | generating | playing | paused
  const [speechError, setSpeechError] = useState('');
  const [narrationNotice, setNarrationNotice] = useState('');
  const [fallbackReason, setFallbackReason] = useState('');
  const [playbackMode, setPlaybackMode] = useState('browser'); // gemini | browser
  const [voicesReady, setVoicesReady] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;

  const cleanSegments = Array.isArray(segments)
    ? segments.filter((s) => typeof s?.text === 'string' && s.text.trim())
    : [];
  const wordCount = cleanSegments.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
  const speakerNames = [...new Set(cleanSegments.map((s) => s.speaker || 'Host'))];
  const audioCacheKey = [
    hostPersonaId || '',
    Array.isArray(hosts) ? hosts.join('|') : '',
    tone || '',
    cleanSegments.map((segment) => `${segment.speaker || 'Host'}:${segment.text}`).join('\n'),
  ].join('::');

  // Voice lists load asynchronously in most browsers — 'voiceschanged' fires
  // once they're actually available, so we wait for that instead of assuming
  // getVoices() is populated on first render.
  useEffect(() => {
    if (!speechSupported) return;
    function handleVoices() {
      if (window.speechSynthesis.getVoices().length > 0) setVoicesReady(true);
    }
    handleVoices();
    window.speechSynthesis.onvoiceschanged = handleVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [speechSupported]);

  useEffect(() => {
    return () => {
      playSessionRef.current += 1;
      geminiAbortRef.current?.abort();
      if (speechSupported) window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (generatedAudioRef.current?.objectUrl) {
        URL.revokeObjectURL(generatedAudioRef.current.objectUrl);
      }
    };
  }, [speechSupported]);

  useEffect(() => {
    if (generatedAudioRef.current?.objectUrl) {
      URL.revokeObjectURL(generatedAudioRef.current.objectUrl);
      generatedAudioRef.current = null;
    }
    geminiAbortRef.current?.abort();
    geminiAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setStatus('idle');
    setCurrentSpeaker(null);
    setNarrationNotice('');
    setFallbackReason('');
  }, [audioCacheKey]);

  function speakNext(sessionId) {
    if (sessionId !== playSessionRef.current) return;
    const item = queueRef.current[indexRef.current];
    if (!item) {
      setStatus('idle');
      setCurrentSpeaker(null);
      return;
    }

    setCurrentSpeaker(item.speaker);
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.rate = item.rate;
    utterance.pitch = item.pitch;
    if (item.voice) utterance.voice = item.voice;

    utterance.onend = () => {
      if (sessionId !== playSessionRef.current) return;
      indexRef.current += 1;
      const next = queueRef.current[indexRef.current];
      // A short beat between chunks, and a longer one when the conversation
      // switches speaker — this "turn-taking" pause is a big part of what
      // makes back-and-forth dialogue sound like a conversation rather than
      // two people talking over a script with no breathing room.
      const pauseMs = next?.startsNewTurn ? 420 : 120;
      window.setTimeout(() => speakNext(sessionId), pauseMs);
    };
    utterance.onerror = (event) => {
      if (sessionId !== playSessionRef.current) return;
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setSpeechError('Narration stopped because the browser reported a speech error.');
      }
      setStatus('idle');
    };
    window.speechSynthesis.speak(utterance);
  }

  async function play() {
    if (cleanSegments.length === 0) {
      setSpeechError('There is no conversation to narrate.');
      return;
    }

    setSpeechError('');
    if (generatedAudioRef.current?.objectUrl) {
      playGeneratedAudio(generatedAudioRef.current.objectUrl);
      return;
    }
    if (hasGeminiQuotaCooldown()) {
      setFallbackReason('Browser voices are active. Gemini quota is unavailable for a few minutes.');
      playBrowserFallback();
      return;
    }

    const requestSession = playSessionRef.current + 1;
    playSessionRef.current = requestSession;
    setStatus('generating');
    setPlaybackMode('gemini');
    setCurrentSpeaker(null);
    setNarrationNotice('');
    setFallbackReason('');
    geminiAbortRef.current?.abort();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    geminiAbortRef.current = controller;

    try {
      const generatedAudio = await generateEpisodeAudio({
        segments: cleanSegments,
        hosts,
        tone,
        hostPersonaId,
        signal: controller?.signal,
      });
      if (requestSession !== playSessionRef.current) {
        URL.revokeObjectURL(generatedAudio.objectUrl);
        return;
      }
      generatedAudioRef.current = generatedAudio;
      playGeneratedAudio(generatedAudio.objectUrl);
    } catch (error) {
      if (requestSession !== playSessionRef.current) return;
      const fallbackMessage =
        error?.code === 'RATE_LIMIT'
          ? 'Browser voices are active. Gemini quota is unavailable for a few minutes.'
          : error?.code === 'TIMEOUT'
            ? "Gemini narration is taking too long - using your browser's built-in voices instead."
          : "Using your browser's built-in voices - couldn't reach the higher-quality narration service.";
      if (error?.code === 'RATE_LIMIT') rememberGeminiQuotaCooldown();
      setFallbackReason(fallbackMessage);
      playBrowserFallback();
    } finally {
      if (geminiAbortRef.current === controller) {
        geminiAbortRef.current = null;
      }
    }
  }

  function playGeneratedAudio(objectUrl) {
    if (!audioRef.current) return;

    if (speechSupported) window.speechSynthesis.cancel();
    playSessionRef.current += 1;
    setPlaybackMode('gemini');
    setNarrationNotice('');
    setFallbackReason('');
    setCurrentSpeaker(speakerNames.join(' / '));
    audioRef.current.src = objectUrl;
    audioRef.current.currentTime = 0;
    audioRef.current.onended = () => {
      setStatus('idle');
      setCurrentSpeaker(null);
    };
    audioRef.current.onerror = () => {
      setFallbackReason("Using your browser's built-in voices - couldn't play the generated narration.");
      playBrowserFallback();
    };
    audioRef.current.play().then(() => {
      setStatus('playing');
    }).catch(() => {
      setFallbackReason("Using your browser's built-in voices - couldn't play the generated narration.");
      playBrowserFallback();
    });
  }

  function playBrowserFallback() {
    if (!speechSupported) {
      setSpeechError('Speech narration is not supported in this browser.');
      setStatus('idle');
      return;
    }
    if (cleanSegments.length === 0) {
      setSpeechError('There is no conversation to narrate.');
      setStatus('idle');
      return;
    }

    const voiceMap = pickVoicesForSpeakers(speakerNames, window.speechSynthesis.getVoices(), {
      hosts,
      hostPersonaId,
    });
    window.speechSynthesis.cancel();
    setPlaybackMode('browser');
    queueRef.current = buildPlayQueue(cleanSegments, voiceMap, voiceRate);
    indexRef.current = 0;
    playSessionRef.current += 1;
    speakNext(playSessionRef.current);
    setStatus('playing');
  }

  function pause() {
    if (playbackMode === 'gemini') {
      audioRef.current?.pause();
    } else if (speechSupported) {
      window.speechSynthesis.pause();
    }
    setStatus('paused');
  }

  function resume() {
    if (playbackMode === 'gemini') {
      audioRef.current?.play().catch(() => {
        setSpeechError('Narration could not be resumed.');
        setStatus('idle');
      });
    } else if (speechSupported) {
      window.speechSynthesis.resume();
    } else {
      return;
    }
    setStatus('playing');
  }

  function useBrowserVoicesNow() {
    geminiAbortRef.current?.abort();
    geminiAbortRef.current = null;
    playSessionRef.current += 1;
    setFallbackReason("Using your browser's built-in voices for immediate playback.");
    playBrowserFallback();
  }

  function tryGeminiAgain() {
    clearGeminiQuotaCooldown();
    stop();
    window.setTimeout(() => play(), 0);
  }

  function stop() {
    playSessionRef.current += 1;
    if (playbackMode === 'gemini' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (speechSupported) window.speechSynthesis.cancel();
    setStatus('idle');
    setCurrentSpeaker(null);
  }

  return (
    <div className="panel audio-player">
      <audio ref={audioRef} />
      <div className="audio-controls">
        <span className={`waveform ${status === 'playing' ? '' : 'idle'}`} aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </span>

        {status === 'idle' && (
          <Button onClick={play} variant="contained" disabled={cleanSegments.length === 0}>
            ▶ Play episode
          </Button>
        )}
        {status === 'generating' && (
          <>
            <Button variant="contained" disabled>
              Generating Gemini narration...
            </Button>
            <Button onClick={useBrowserVoicesNow} variant="outlined">
              Use browser voices now
            </Button>
          </>
        )}
        {status === 'playing' && (
          <>
            <Button onClick={pause} variant="contained">⏸ Pause</Button>
            <Button onClick={stop} variant="outlined">■ Stop</Button>
          </>
        )}
        {status === 'paused' && (
          <>
            <Button onClick={resume} variant="contained">▶ Resume</Button>
            <Button onClick={stop} variant="outlined">■ Stop</Button>
          </>
        )}

        <span className="muted mono audio-meta">
          {wordCount} words / {speakerNames.length}-host conversation / {playbackMode === 'gemini' ? 'via Gemini TTS' : 'via Web Speech API'}
        </span>
      </div>

      {status === 'playing' && currentSpeaker && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="on-air">
            <span className="on-air-dot"></span>
            <span>on air</span>
          </span>
          <span className="mono muted" style={{ fontSize: 12 }}>
            Speaking now: <strong>{currentSpeaker}</strong>
          </span>
        </div>
      )}

      {status === 'playing' && playbackMode === 'browser' && fallbackReason && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="mono muted" style={{ fontSize: 12 }}>
            {fallbackReason}
          </span>
          {fallbackReason.includes('quota') && (
            <Button onClick={tryGeminiAgain} variant="outlined" size="small">
              Try Gemini again
            </Button>
          )}
        </div>
      )}

      {narrationNotice && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {narrationNotice}
        </Alert>
      )}

      {!voicesReady && speechSupported && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Loading available voices — if both hosts sound the same, your browser/OS may only have one voice installed.
        </Alert>
      )}

      {(!speechSupported || speechError) && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {speechError || 'Speech narration is not supported in this browser.'}
        </Alert>
      )}
    </div>
  );
}
