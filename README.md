# Commands v3 Field Guide

An introductory field guide for FRC Java students who know Commands v2. Start
with the three lessons on coroutines, translating an intake command, and
coordinating mechanisms. Use Migration to diagnose behavior changes, Examples
to browse by task, and the v2 and v3 method lookups to find APIs by name.

Open `dist/index.html` to read the site locally. Edit the Markdown in `content/`
and run `node build.mjs` to regenerate the HTML and stylesheet in `dist/`.
The Java excerpts focus on command behavior and use comments where
robot-specific hardware code would go.

The [desktop intake lab](lab/README.md) exercises the intake lesson against the
Commands v3 scheduler without robot hardware.

## Publish on GitHub Pages

1. Push the project to a public GitHub repository with a `main` branch.
2. In the repository, open **Settings → Pages** and select **GitHub Actions** as
   the publishing source.
3. In **Actions**, open **Deploy field guide to GitHub Pages** and run it from
   `main` if the first deployment has not run successfully yet.

The workflow runs `node build.mjs` and publishes `dist/`. After setup, pushes
to `main` rebuild and publish the guide. The Pages settings and completed
deployment show the public URL.
