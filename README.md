# POWAI

POWAI is an academic integrity tracker for written assignments. Teachers can create assignments and review submissions, while students can submit text work and receive authenticity analysis.

## Current Highlights

- Dark mode is the default theme on initial load.
- Light mode remains available through the theme toggle.
- Deadline enforcement is active server-side for assignment access and submission.
- Dashboard submissions support legacy ownership fallback for older records.

## Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: Express + TypeScript
- Database: Neon Postgres
- Analysis: Groq + OCR/text heuristics

## Project Structure

- src: React frontend
- server: Express API
- public: static files

## Environment Variables

Create a `.env` file in the project root with:

```env
VITE_DATABASE_URL=postgres://...
GROQ_API_KEY=...
GROQ_MODEL=mixtral-8x7b-32768
PORT=3001
```

Notes:
- `VITE_DATABASE_URL` is required by the server database initializer.
- If `GROQ_API_KEY` is missing, analysis routes run with reduced capability and log a warning.

## Install

```bash
npm install
```

## Run in Development

```bash
npm run dev:all
```

This starts:
- Frontend on `http://localhost:8080`
- API on `http://localhost:3001`

## Build and Preview

```bash
npm run build
npm run preview
```

## Useful Scripts

- `npm run dev`: start Vite frontend only
- `npm run server`: start Express server in watch mode
- `npm run dev:all`: start frontend and backend together
- `npm run test`: run Vitest tests
- `npm run lint`: run ESLint

## Troubleshooting

- If `npm run dev:all` fails, ensure you are inside the actual project folder:
	- `C:\Users\ACER\Downloads\effort-score-tracker-main\effort-score-tracker-main`
- If the app appears stale, close old dev servers and run one fresh `npm run dev:all` instance.
- If database errors appear at startup, verify `VITE_DATABASE_URL` in `.env`.
