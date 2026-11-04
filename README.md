# cognitive-symbiont.github.io

Project page for the perspective paper *From Autonomous Agents to Cognitive Symbionts: Toward AI-Augmented Human Intelligence* (Hao Fei, University of Oxford), [arXiv:2611.05376](https://arxiv.org/abs/2611.05376).
Live at https://cognitive-symbiont.github.io. Static site, no build step.

```
index.html               the page: street hero with lens, two kinds of individual, six cases, AGI vs AHI, the Cognitive Symbiont loop
assets/css/site.css      styles and motion
assets/js/site.js        frame-locked overlays, lens, frontier mask, outline sync, case playback and beat sync, loop
assets/data/tracks.json  per-frame device points and figure boxes over the hero loop
assets/video/            hero (2560x1440 loop), outline pass, six case clips; mp4 + webm + webp poster each
assets/img/              favicon
```

The paper link appears twice in `index.html` (the top-right pill and the closing line).
To change it, replace the arXiv URL in both places.

Local preview needs a static server with HTTP Range support so the case clips can seek, for example `npx http-server -p 8841`.
