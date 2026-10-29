<!-- SPDX-License-Identifier: EPL-2.0 -->
<!--
  TIN Projects sign-in backdrop: drifting glows, a dot grid and app icons orbiting the card.
  Purely decorative (aria-hidden, no pointer events); stops moving under prefers-reduced-motion.
-->
<script lang="ts">
  const icons = [
    { d: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 9 3 3 5-6', hue: 'blue' },
    { d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M9 13h6M9 17h4', hue: 'green' },
    { d: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z', hue: 'amber' },
    { d: 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18', hue: 'pink' },
    { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', hue: 'sky' },
    { d: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3', hue: 'violet' }
  ]
  // Angles (deg, 0 = right, clockwise) keep tiles clear of the brand mark above the card and of the card
  // itself while the ring sways ±15deg.
  const angles = [-130, -50, -10, 30, 150, 190]
  const tiles = icons.map((icon, i) => {
    const a = (Math.PI / 180) * angles[i]
    return { ...icon, left: 50 + 50 * Math.cos(a), top: 50 + 50 * Math.sin(a), delay: -i * 1.1 }
  })
</script>

<div class="backdrop" aria-hidden="true">
  <div class="blob b1" />
  <div class="blob b2" />
  <div class="blob b3" />
  <div class="dots" />
  <div class="orbit-wrap">
    <svg class="rings" viewBox="0 0 820 820">
      <circle class="dash" cx="410" cy="410" r="380" />
      <circle class="inner" cx="410" cy="410" r="300" />
    </svg>
    <div class="orbit">
      {#each tiles as tile}
        <div class="slot" style:left="{tile.left}%" style:top="{tile.top}%">
          <div class="upright">
            <div class="tile {tile.hue}" style:animation-delay="{tile.delay}s">
              <svg viewBox="0 0 24 24"><path d={tile.d} /></svg>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- Brand mark and cycling tagline above the card. -->
<div class="brand" aria-hidden="true">
  <div class="mark">
    <span class="ring" />
    <span class="ring late" />
    <span class="logo">T</span>
  </div>
  <div class="tagline">
    <span class="word">Plan.</span>
    <span class="word accent">Collaborate.</span>
    <span class="word">Deliver.</span>
  </div>
</div>

<style lang="scss">
  .backdrop {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    animation: drift 24s ease-in-out infinite;
  }
  .b1 {
    width: 32rem;
    height: 32rem;
    top: -10rem;
    left: 8%;
    background: #c7d2fe;
    opacity: 0.8;
  }
  .b2 {
    width: 28rem;
    height: 28rem;
    bottom: -11rem;
    right: 6%;
    background: #bae6fd;
    opacity: 0.75;
    animation-duration: 30s;
    animation-delay: -8s;
  }
  .b3 {
    width: 22rem;
    height: 22rem;
    top: 38%;
    left: 58%;
    background: #e9d5ff;
    opacity: 0.55;
    animation-duration: 34s;
    animation-delay: -16s;
  }
  :global(.theme-dark) .blob {
    opacity: 0.16;
  }
  .dots {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(color-mix(in srgb, var(--theme-caption-color) 12%, transparent) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: radial-gradient(ellipse at center, #000 20%, transparent 70%);
  }

  .orbit-wrap {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 820px;
    height: 820px;
    margin: -410px 0 0 -410px;
  }
  .rings {
    position: absolute;
    inset: 0;
    fill: none;
  }
  .dash {
    stroke: color-mix(in srgb, var(--primary-button-default) 24%, transparent);
    stroke-width: 1.5;
    stroke-dasharray: 4 10;
    animation: dash 3s linear infinite;
  }
  .inner {
    stroke: var(--theme-divider-color);
  }
  .orbit {
    position: absolute;
    inset: 30px;
    animation: sway 24s ease-in-out infinite;
  }
  .slot {
    position: absolute;
    transform: translate(-50%, -50%);
  }
  .upright {
    animation: unsway 24s ease-in-out infinite;
  }
  .tile {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 1rem;
    background: var(--theme-popup-color);
    box-shadow:
      0 0 0 1px var(--theme-divider-color),
      0 10px 30px rgba(17, 17, 20, 0.1);
    animation: bob 6s ease-in-out infinite;

    svg {
      width: 1.375rem;
      height: 1.375rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    &.blue { color: #3b5bdb; }
    &.green { color: #15803d; }
    &.amber { color: #b45309; }
    &.pink { color: #be185d; }
    &.sky { color: #0369a1; }
    &.violet { color: #7e22ce; }
  }

  .brand {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.875rem;
    animation: enter 0.8s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }
  .mark {
    position: relative;
    width: 3rem;
    height: 3rem;
  }
  .ring {
    position: absolute;
    inset: 0;
    border-radius: 0.875rem;
    border: 2px solid #7b93f0;
    animation: ring 2.8s ease-out infinite;

    &.late {
      animation-delay: 1.4s;
    }
  }
  .logo {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 0.875rem;
    background: var(--primary-button-default);
    color: #fff;
    font-size: 1.3125rem;
    font-weight: 700;
    box-shadow: 0 8px 20px rgba(59, 91, 219, 0.35);
  }
  .tagline {
    position: relative;
    width: 18rem;
    height: 2.5rem;
    text-align: center;
    font-size: 2rem;
    line-height: 2.5rem;
    font-weight: 600;
    letter-spacing: -0.03em;
    color: var(--theme-caption-color);
  }
  .word {
    position: absolute;
    inset: 0;
    opacity: 0;
    animation: word 9s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;

    &:nth-child(2) {
      animation-delay: 3s;
    }
    &:nth-child(3) {
      animation-delay: 6s;
    }
    &.accent {
      color: var(--primary-button-default);
    }
  }

  // Not enough room for the ring: keep glows and grid only.
  @media (max-width: 900px), (max-height: 760px) {
    .orbit-wrap {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .blob,
    .dash,
    .orbit,
    .upright,
    .tile,
    .ring,
    .brand,
    .word {
      animation: none;
    }
    .word:first-child {
      opacity: 1;
    }
  }

  @keyframes drift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(60px, -40px) scale(1.08); }
    66% { transform: translate(-40px, 30px) scale(0.94); }
  }
  @keyframes sway {
    0%, 100% { transform: rotate(-15deg); }
    50% { transform: rotate(15deg); }
  }
  @keyframes unsway {
    0%, 100% { transform: rotate(15deg); }
    50% { transform: rotate(-15deg); }
  }
  @keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  @keyframes dash {
    to { stroke-dashoffset: -40; }
  }
  @keyframes ring {
    0% { transform: scale(0.8); opacity: 0.55; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes word {
    0% { opacity: 0; transform: translateY(12px); }
    6%, 28% { opacity: 1; transform: translateY(0); }
    34%, 100% { opacity: 0; transform: translateY(-12px); }
  }
  @keyframes enter {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
