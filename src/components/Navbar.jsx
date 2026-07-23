import { NavLink, useNavigate } from 'react-router-dom';
import { AppBar, Box, Button, Toolbar } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const linkStyle = ({ isActive }) => ({
  color: isActive ? 'var(--gold)' : 'var(--text-muted)',
  textDecoration: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  padding: '8px 10px',
  whiteSpace: 'nowrap',
});

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ bgcolor: 'background.paper', borderBottom: '1px solid var(--border)' }}
    >
      <Toolbar
        className="navbar-toolbar"
        sx={{
          width: '100%',
          maxWidth: 1040,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: 1,
          minHeight: 'unset',
          color: 'text.primary',
        }}
      >
        <Box className="navbar-main">
          <NavLink to="/" style={{ textDecoration: 'none', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="waveform idle" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </span>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Podwave</strong>
          </NavLink>
          {user && (
            <Box component="nav" aria-label="Main navigation" className="navbar-links">
              <NavLink to="/create" style={linkStyle}>Create</NavLink>
              <NavLink to="/library" style={linkStyle}>Library</NavLink>
              <NavLink to="/dashboard" style={linkStyle}>Dashboard</NavLink>
            </Box>
          )}
        </Box>

        <Box className="navbar-actions">
          <Button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            variant="outlined"
            size="small"
            sx={{ color: 'text.secondary', borderColor: 'divider', minWidth: 0 }}
          >
            {theme === 'dark' ? '☀ light' : '● dark'}
          </Button>
          {user ? (
            <>
              <span className="pill">{user.username}</span>
              <Button
                onClick={handleLogout}
                color="error"
                size="small"
              >
                Log out
              </Button>
            </>
          ) : (
            <NavLink to="/login" style={linkStyle}>Log in</NavLink>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
