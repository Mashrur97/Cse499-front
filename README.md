# Banglish 4B · live demo site

Qwen3-4B as released vs. our Banglish fine-tune (CWH+-D), answering the same message side by side.
NSU CSE 499 · Mashrur and team.

- React + Vite + Tailwind, deployed on Netlify (`netlify.toml`: build `npm run build`, publish `dist`).
- The models run in a Kaggle T4 session (`banglish_demo_backend_kaggle.ipynb`). While it runs, the notebook publishes
  its current public link to `datasets/mashrur991/banglish-demo-link/link.json`; this site reads that file every
  minute and talks to the backend's `/stream` endpoint with `@gradio/client`. When the notebook is off, the site shows
  an offline state.

Local dev: `npm install && npm run dev`. To point at another link file: `VITE_LINK_URL=... npm run dev`.
