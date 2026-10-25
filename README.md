# Playmaker

Playmaker is a local-first football analysis prototype. The main workflow lets a user place players and the ball on a pitch, configure the match state, analyse possible next plays, and save or reload scenarios in the browser.

Live site: https://playmaker-0fjv.onrender.com/

## Run locally

```bash
npm start
```

Open [http://localhost:4173](http://localhost:4173).

The Node server serves the frontend and exposes the API under `/api`. If the API is unavailable, the browser continues to use local storage for the profile and saved scenarios.

## Test

```bash
npm test
npm run test:server
npm run test:model
```

The analysis engine lives in `analysis.js` and is intentionally independent of the DOM. `app.js` owns browser state and rendering, which keeps the eventual API or machine-learning model integration separate from the interaction layer.

The API is implemented in `server.js`. It supports account registration, login, password reset, email verification, account deletion, workspace members, owned and shared scenario CRUD, comments, notifications, and model feedback. Passwords are hashed with Node's `scrypt`, sessions use HTTP-only cookies, and the development database is stored in `data/playmaker.sqlite` using Node's built-in SQLite driver. Set `PLAYMAKER_EMAIL_API_URL` and `PLAYMAKER_EMAIL_API_KEY` to a JSON email API that accepts `{ to, subject, text }` with bearer authentication; without them, production reports email delivery as unavailable and local development exposes one-time tokens for testing. Scenario validation rejects more than 11 players for any team at both the browser and API boundaries. Pitch geometry, play timelines, undo/redo, and tactical reports live in `analysis.js`, `workspace.js`, and `report.js` so they can be unit-tested without the DOM.

## Train the baseline model

```bash
npm run train:model
```

The trainer downloads StatsBomb Open Data for the 2023/24 Bundesliga season, joins event records to 360 freeze frames, and builds samples from the next same-team event. It learns from event location plus nearby-opponent count, nearest-opponent distance, and aggregate opponent pressure, then writes `model/model.json`. The current artifact was trained on 24 matches and 92,391 samples with 37.79% held-out top-1 accuracy across five action classes. It is a real-data baseline, not a production tactical model: 360 event data still does not capture every tactical intention or continuous tracking frame. The webapp loads the artifact when present and blends its probabilities with explicit tactical-shape features; without it, the deterministic baseline remains available.
