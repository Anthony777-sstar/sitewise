# How the Shader/Design Background Works

Both versions recreate the same animated shader overlay on the hero section. The difference is the rendering approach.

---

## `website-cdn-shaders/` — Shader Library via CDN

**Goal:** Use the real `shaders` npm package without React or a build step.

`script.js` dynamically imports the package from esm.sh CDN at runtime:

```js
const { createShader } = await import('https://esm.sh/shaders@latest/js');

await createShader(canvas, {
  components: [
    { type: 'Swirl', props: { colorA: '#ffffff', colorB: '#f0f0f0', detail: 1.7 } },
    { type: 'ChromaFlow', props: { baseColor: '#ffffff', downColor: '#ff5f03', leftColor: '#ff5f03', rightColor: '#ff5f03', upColor: '#ff5f03', momentum: 13, radius: 3.5 } },
    { type: 'FlutedGlass', props: { aberration: 0.61, angle: 31, frequency: 8, highlight: 0.12, highlightSoftness: 0, lightAngle: -90, refraction: 4, shape: 'rounded', softness: 1, speed: 0.15 } },
    { type: 'FilmGrain', props: { strength: 0.05 } }
  ]
});
```

The `<canvas>` sits inside a `.shader-overlay` div (absolute, inset-0, z-10, pointer-events-none) in the hero section. If the CDN is unreachable, a compact WebGL fallback kicks in.

**Why this works:** The `shaders` package has a `shaders/js` entry point specifically for vanilla JS. It creates a WebGL render loop on the given canvas and composites all four shader components together. The parameters match the spec exactly.

---

## `website-css-only/` — Pure CSS Shader Simulation

**Goal:** Same visual effect with zero JavaScript, zero CDN, zero external dependencies.

Four CSS layers stack inside `.shader-css-overlay`:

| Layer | CSS Technique | Spec Equivalent |
|---|---|---|
| `::before` | Conic gradient, `animation: swirlRotate 12s linear infinite` | Swirl |
| `::after` | Repeating linear gradient (orange bands), `animation: chromaFlow 8s linear infinite` | ChromaFlow |
| `.shader-glass` | `backdrop-filter: blur(2px)` + angled gradient sweep with `animation: glassShift` | FlutedGlass |
| `.shader-noise` | SVG `<feTurbulence>` noise data URI with shifting animation | FilmGrain |

Key CSS:

```css
/* Swirl */
.shader-css-overlay::before {
  background: conic-gradient(from 0deg, transparent, rgba(255,255,255,0.3), transparent, ...);
  animation: swirlRotate 12s linear infinite;
}

/* ChromaFlow */
.shader-css-overlay::after {
  background: repeating-linear-gradient(90deg, transparent 30px, rgba(255,95,3,0.03) 30px, ...);
  animation: chromaFlow 8s linear infinite;
}

/* Glass */
.shader-glass {
  backdrop-filter: blur(2px);
  background: linear-gradient(31deg, transparent 40%, rgba(255,255,255,0.08) 50%, ...);
}

/* Noise */
.shader-noise {
  background-image: url("data:image/svg+xml,...<feTurbulence...>...");
  animation: grainShift 0.5s steps(4) infinite;
}
```

**Why this works:** Each CSS layer targets a different visual aspect of the spec's shaders — radial motion (Swirl), horizontal orange sweep (ChromaFlow), subtle distortion (FlutedGlass), and grain texture (FilmGrain). Mix-blend-modes and opacity keep it subtle, matching the "light gray background with gentle motion" feel.

---

## HTML Structure (both versions)

Inside the `<section class="hero">`:

```html
<section class="hero">
  <!-- Shader sits between the bg and everything else -->
  <div class="shader-overlay">
    <!-- CDN: <canvas id="shaderCanvas"> -->
    <!-- CSS: <div class="shader-css-overlay"> + .shader-glass + .shader-noise -->
  </div>

  <nav class="nav-wrapper">...</nav>   <!-- z-20, above shader -->
  <div class="hero-spacer"></div>
  <div class="hero-content">...</div>  <!-- z-20, above shader -->
</section>
```

The `.hero` has `position: relative; overflow: hidden`. The shader overlay is `position: absolute; inset: 0; z-index: 10; pointer-events: none` so it fills the hero and lets clicks pass through to the nav/content above (z-20).