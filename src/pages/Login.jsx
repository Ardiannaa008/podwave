import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, TextField } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // useRef: focus the input on mount without triggering a re-render.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    setError('');
    login(trimmed);
    navigate('/library');
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <h2 style={{ marginBottom: 8 }}>Log in to Podwave</h2>
      <p className="muted" style={{ marginBottom: 24 }}>
        No password needed for this demo — just pick a name. Your episodes are saved locally under it.
      </p>
      <form onSubmit={handleSubmit} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextField
          id="username"
          label="Username"
          inputRef={inputRef}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. anaa"
          size="small"
          fullWidth
          error={Boolean(error)}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          type="submit"
          variant="contained"
          fullWidth
        >
          Enter studio
        </Button>
      </form>
    </div>
  );
}
