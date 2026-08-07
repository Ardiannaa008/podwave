import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button, TextField } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const EMPTY_ERRORS = {
  username: '',
  password: '',
  confirmPassword: '',
};

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const inputRef = useRef(null);
  const { signup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function validate() {
    const nextErrors = { ...EMPTY_ERRORS };
    const trimmed = username.trim();

    if (trimmed.length < 3) {
      nextErrors.username = 'Username must be at least 3 characters.';
    }
    if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords must match.';
    }

    return nextErrors;
  }

  function updateField(field, value, setter) {
    setter(value);
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: '' }));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate();

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    try {
      signup(username.trim(), password);
      navigate('/library');
    } catch (err) {
      setErrors({
        ...EMPTY_ERRORS,
        username: err.message || 'Could not create this account.',
      });
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <h2 style={{ marginBottom: 8 }}>Create your Podwave account</h2>
      <p className="muted" style={{ marginBottom: 24 }}>
        Accounts stay in this browser, keeping each local episode library separate.
      </p>
      <form onSubmit={handleSubmit} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextField
          id="signup-username"
          label="Username"
          inputRef={inputRef}
          value={username}
          onChange={(e) => updateField('username', e.target.value, setUsername)}
          placeholder="e.g. anaa"
          size="small"
          fullWidth
          autoComplete="username"
          error={Boolean(errors.username)}
          helperText={errors.username}
        />
        <TextField
          id="signup-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => updateField('password', e.target.value, setPassword)}
          size="small"
          fullWidth
          autoComplete="new-password"
          error={Boolean(errors.password)}
          helperText={errors.password}
        />
        <TextField
          id="confirm-password"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => updateField('confirmPassword', e.target.value, setConfirmPassword)}
          size="small"
          fullWidth
          autoComplete="new-password"
          error={Boolean(errors.confirmPassword)}
          helperText={errors.confirmPassword}
        />
        <Button type="submit" variant="contained" fullWidth>
          Sign up
        </Button>
        <Button component={RouterLink} to="/login" variant="outlined" fullWidth>
          Back to log in
        </Button>
      </form>
    </div>
  );
}
