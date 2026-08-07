const USERS_KEY = 'podwave_users';

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export function getUsers() {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function findUser(username) {
  const key = normalizeUsername(username);
  if (!key) return null;

  const users = getUsers();
  const record = users[key];
  return record &&
    typeof record === 'object' &&
    typeof record.username === 'string' &&
    typeof record.passwordHash === 'string'
    ? record
    : null;
}

export function saveUser(username, passwordHash) {
  const trimmedUsername = String(username || '').trim();
  const key = normalizeUsername(trimmedUsername);
  if (!key) throw new Error('Username is required.');

  const users = getUsers();
  if (users[key]) {
    throw new Error('An account with that username already exists.');
  }

  users[key] = { username: trimmedUsername, passwordHash };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return users[key];
}

// This is intentionally simple and synchronous for a no-backend course project.
// It avoids plaintext localStorage passwords, but it is not cryptographically secure.
export function hashPassword(password) {
  const value = String(password || '');
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a:${(hash >>> 0).toString(16)}`;
}
