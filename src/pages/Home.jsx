import { Link } from 'react-router-dom';
import { Button } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="page home-page">
      <div className="waveform" style={{ justifyContent: 'center', height: 60, marginBottom: 24 }} aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <h1 className="hero-title">Say the topic. Podwave writes and reads it.</h1>
      <p className="muted" style={{ fontSize: 16, maxWidth: 480, margin: '0 auto 32px' }}>
        A tiny AI podcast studio in your browser — pick a topic, tone, and length,
        and get a script that's written and narrated back to you in seconds.
      </p>
      <Button
        component={Link}
        to={user ? '/create' : '/login'}
        variant="contained"
        size="large"
      >
        {user ? 'Start a new episode' : 'Log in to get started'}
      </Button>
    </div>
  );
}
