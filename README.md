# Podwave — AI Podcast Studio

Give it a topic, tone, and length. Podwave writes a two-host conversation
about it and reads it back to you out loud — with two different voices —
right in the browser.

## Running it

```bash
npm install
npm start
```

Open the printed localhost URL. Log in with any username (3+ chars, no
password needed — it's a mock auth flow for this project) and you're in.

Works fully offline out of the box — script generation falls back to a local
template generator so you don't need any API key to demo it.

## Using real AI generation (optional)

By default, `generateScript` in `src/utils/scriptGenerator.js` uses a local
fallback so the app works with zero setup. To use real Groq-generated
scripts instead:

1. Get a free API key from https://console.groq.com
2. Create a `.env` file in the project root:
   ```
   REACT_APP_GROQ_API_KEY=your_key_here
   ```
3. Restart `npm start`. The Authorization header is already wired up in
   `scriptGenerator.js`. (Create React App only exposes env vars prefixed
   with `REACT_APP_` to the browser.)

## Where each course requirement lives

| Requirement | Where |
|---|---|
| Reusable components | `FieldGroup`, `AudioPlayer`, `EpisodeTable`, `StatCard` |
| Props + children | `FieldGroup` takes `label`/`hint` props and renders `children` |
| Event handling | Form submits (Create, Login), button clicks (player controls) |
| Functions as props | `onDelete` passed into `EpisodeTable`, `handleSaveEpisode` |
| useState | Form fields, loading/error states, player status |
| Conditional rendering | Loading skeletons, generation waveform, empty states, auth-gated nav links |
| Controlled forms | Login, Create (topic/tone/length/rate) |
| useEffect (data loading) | `Library.jsx`, `Dashboard.jsx`, `EpisodeDetail.jsx` load local data on mount |
| Axios + Authorization header | `scriptGenerator.js` → Groq API call |
| useRef | Input focus (`Login`), utterance instance (`AudioPlayer`) |
| useMemo | Table search/sort (`EpisodeTable`), stats aggregation (`Dashboard`) |
| useContext | `AuthContext`, `ThemeContext` |
| Dynamic table + search/sort | `EpisodeTable.jsx` |
| Dark/light theme | `ThemeContext` + navbar toggle |
| React Router | `App.jsx` — 6 routes, protected routes for authed pages |
| Form validation | Login (min length), Create (min topic length) |
| Auth flow | Mock login → fake token → protected routes |
| Responsive layout | `.page` max-width + CSS grid on Dashboard |

## Notes for the proposal doc

This uses the browser's built-in Web Speech API (`speechSynthesis`) for
narration — completely free, no API key, works offline, and demoable live
in class by literally pressing play. Two hosts ("Alex" and "Jamie") are
assigned two distinct installed voices automatically; if your OS only has
one voice installed, both hosts will sound the same, which is a browser/OS
limitation rather than a bug in the app.
