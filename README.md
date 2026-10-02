# Space Attack

A small browser arcade game foundation built for incremental feature work. It runs as a static site and needs no build step.

Open `index.html` through a static server, or publish the repository root with GitHub Pages. Run the model checks with `npm test`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for subsystem boundaries, current capabilities, and handoff guidance.

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow that tests and publishes the game whenever `main` is updated.

Before the first deployment, open the repository's **Settings → Pages**, select **GitHub Actions** as the source, and save. Push this branch to `main` (or run **Deploy Space Attack to GitHub Pages** manually from the Actions tab). Once the workflow succeeds, GitHub reports the playable site URL in the deployment step and Pages settings.
