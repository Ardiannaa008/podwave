const KEY_PREFIX = 'podwave_episodes_';

export function getEpisodes(username) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + username);
    const parsed = raw ? JSON.parse(raw) : [];
    // Valid JSON is not necessarily the array shape the app expects.
    return Array.isArray(parsed) ? parsed.filter((episode) => episode && typeof episode === 'object') : [];
  } catch {
    // Corrupted JSON in localStorage — fail safe with an empty library
    // rather than crashing the whole page.
    return [];
  }
}

export function saveEpisode(username, episode) {
  const episodes = getEpisodes(username);
  episodes.unshift(episode);
  try {
    localStorage.setItem(KEY_PREFIX + username, JSON.stringify(episodes));
  } catch {
    // localStorage quota exceeded or write blocked (e.g. private browsing).
    console.warn('Could not save episode to localStorage (quota exceeded or storage unavailable).');
  }
  return episodes;
}

export function deleteEpisode(username, id) {
  const episodes = getEpisodes(username).filter((e) => e.id !== id);
  try {
    localStorage.setItem(KEY_PREFIX + username, JSON.stringify(episodes));
  } catch {
    console.warn('Could not update localStorage after deleting an episode.');
  }
  return episodes;
}

export function getEpisode(username, id) {
  return getEpisodes(username).find((e) => e.id === id);
}
