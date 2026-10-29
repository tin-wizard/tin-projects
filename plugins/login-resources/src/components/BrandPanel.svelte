<!-- SPDX-License-Identifier: EPL-2.0 -->
<!--
  TIN Projects sign-in brand panel ("Live board"): TIN logo, tagline, an animated mini board where one issue
  moves to Done, and the main apps. Brand copy is English only, like the product name; hidden below 900px
  wide, where LoginApp shows a compact logo instead. Animations stop under prefers-reduced-motion.
-->
<script lang="ts">
  // Deterministic spread so the panel looks the same on every load.
  const particles = Array.from({ length: 16 }, (_, i) => ({
    left: (i * 37 + 11) % 100,
    size: 2 + (i % 3),
    duration: 9 + ((i * 7) % 9),
    delay: -((i * 2.3) % 17)
  }))
  const columns = [
    { name: 'Todo', dot: '#9aa6c9', id: 'WEBSI-6', title: 'Launch email' },
    { name: 'In progress', dot: '#f2b544', id: 'WEBSI-1', title: 'Launch plan' },
    { name: 'Done', dot: '#4ade80', id: 'WEBSI-3', title: 'Homepage design' }
  ]
  const apps = [
    { name: 'Tracker', d: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 9 3 3 5-6' },
    { name: 'Documents', d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M9 13h6M9 17h4' },
    { name: 'Chat', d: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z' },
    { name: 'Planner', d: 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18' },
    { name: 'Drive', d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }
  ]
</script>

<section class="panel" aria-label="TIN Projects">
  <div class="orb o1" />
  <div class="orb o2" />
  <div class="grid" />
  <div class="particles" aria-hidden="true">
    {#each particles as p}
      <span
        class="particle"
        style:left="{p.left}%"
        style:width="{p.size}px"
        style:height="{p.size}px"
        style:animation-duration="{p.duration}s"
        style:animation-delay="{p.delay}s"
      />
    {/each}
  </div>

  <div class="brand enter">
    <span class="logo">
      <span class="signal" />
      <span class="signal late" />
      <img src="/tin/tin-logo-white.png" alt="TIN" width="66" height="44" />
    </span>
    <span class="divider" aria-hidden="true" />
    <span class="product">Projects</span>
  </div>

  <div class="middle">
    <div class="enter" style:animation-delay="0.1s">
      <h1>Plan.<br />Collaborate.<br /><span class="accent">Deliver.</span></h1>
      <p>Issues, documents, chat and planning for your team, in one place.</p>
    </div>

    <div class="board enter float" aria-hidden="true">
      <div class="columns">
        {#each columns as c}
          <div class="column">
            <div class="column-name"><span class="dot" style:background={c.dot} />{c.name}</div>
            <div class="slot" />
            <div class="card">
              <span class="id">{c.id}</span>
              <span class="title">{c.title}</span>
            </div>
          </div>
        {/each}
      </div>
      <div class="card moving">
        <span class="id"><span class="dot status" />WEBSI-7</span>
        <span class="title row">
          Final QA pass
          <svg width="14" height="14" viewBox="0 0 16 16"><path class="check" d="m3.5 8.5 3 3 6-7" /></svg>
        </span>
      </div>
    </div>
  </div>

  <ul class="apps enter" style:animation-delay="0.4s">
    {#each apps as a}
      <li>
        <span class="app-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d={a.d} /></svg>
        </span>{a.name}
      </li>
    {/each}
  </ul>
</section>

<style lang="scss">
  .panel {
    position: relative;
    overflow: hidden;
    flex: 1 1 35rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 2.5rem;
    padding: 3rem 3.5rem;
    background: #0c1433;
    color: #fff;
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(64px);
    pointer-events: none;
    animation: drift 22s ease-in-out infinite;
  }
  .o1 {
    width: 460px;
    height: 460px;
    top: -140px;
    left: -160px;
    background: #3b5bdb;
    opacity: 0.45;
  }
  .o2 {
    width: 380px;
    height: 380px;
    bottom: -110px;
    right: -120px;
    background: #7b93f0;
    opacity: 0.28;
    animation-duration: 28s;
    animation-delay: -9s;
  }
  .grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at 40% 40%, #000 30%, transparent 75%);
  }
  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .particle {
    position: absolute;
    bottom: -8px;
    border-radius: 50%;
    background: #afc0ff;
    box-shadow: 0 0 8px #afc0ff;
    opacity: 0;
    animation: rise linear infinite;
  }

  .brand {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }
  .logo {
    position: relative;
    display: inline-block;
    width: 66px;
    height: 44px;

    img {
      position: relative;
      display: block;
    }
  }
  // Rings pulse from the dot of the "i" in the logo.
  .signal {
    position: absolute;
    left: 28px;
    top: 19px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid #f15d25;
    animation: signal 3s ease-out infinite;

    &.late {
      animation-delay: 1.5s;
    }
  }
  .divider {
    width: 1px;
    height: 28px;
    background: rgba(255, 255, 255, 0.22);
  }
  .product {
    font-size: 1.3125rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .middle {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    max-width: 35rem;
  }
  h1 {
    margin: 0;
    font-size: 3.25rem;
    line-height: 1.04;
    font-weight: 600;
    letter-spacing: -0.035em;
    color: #fff;
  }
  .accent {
    color: #afc0ff;
  }
  p {
    margin: 1.125rem 0 0;
    max-width: 26rem;
    font-size: 1rem;
    line-height: 1.55;
    color: #c3cce8;
  }

  .board {
    position: relative;
    width: 480px;
    max-width: 100%;
    padding: 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .column-name {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 22px;
    font-size: 12px;
    font-weight: 500;
    color: #c3cce8;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .slot {
    height: 56px;
  }
  .card {
    height: 56px;
    padding: 9px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.09);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-sizing: border-box;
  }
  .id {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 500 10.5px var(--mono-font);
    color: #9aa6c9;
  }
  .title {
    font-size: 12px;
    color: #e6eaf7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  // The card that travels Todo -> In progress -> Done; one step is its own width plus the 12px column gap.
  .moving {
    position: absolute;
    left: 14px;
    top: 44px;
    width: calc((100% - 52px) / 3);
    background: #fff;
    box-shadow: 0 10px 24px rgba(5, 10, 30, 0.35);
    animation: move 9s cubic-bezier(0.65, 0, 0.35, 1) infinite;

    .id {
      color: #5b5b66;
    }
    .title {
      color: #111114;
      font-weight: 500;
    }
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .status {
    background: #9aa6c9;
    animation: status 9s steps(1) infinite;
  }
  .check {
    fill: none;
    stroke: #16a34a;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 24;
    animation: check 9s ease-out infinite;
  }

  .apps {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    gap: 10px 22px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
    color: #c3cce8;

    // The global theme colours every li, so set it here rather than inheriting from .apps.
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #c3cce8;
    }
  }
  .app-icon {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #afc0ff;

    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  }

  .enter {
    animation: enter 0.7s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }
  .board.enter.float {
    animation:
      enter 0.7s 0.25s cubic-bezier(0.22, 0.61, 0.36, 1) both,
      float 7s ease-in-out infinite;
  }

  @media (max-width: 900px) {
    .panel {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .orb,
    .particle,
    .signal,
    .enter,
    .board.enter.float,
    .moving,
    .status,
    .check {
      animation: none;
    }
    .signal {
      display: none;
    }
  }

  @keyframes drift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(36px, -28px) scale(1.07); }
    66% { transform: translate(-24px, 18px) scale(0.95); }
  }
  @keyframes rise {
    0% { transform: translate(0, 0); opacity: 0; }
    10% { opacity: 0.9; }
    85% { opacity: 0.9; }
    100% { transform: translate(16px, -100vh); opacity: 0; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @keyframes move {
    0%, 16% { transform: translateX(0); }
    30%, 48% { transform: translateX(calc(100% + 12px)); }
    62%, 86% { transform: translateX(calc(200% + 24px)); }
    94%, 100% { transform: translateX(calc(200% + 24px)); opacity: 0; }
  }
  @keyframes status {
    0%, 16% { background: #9aa6c9; }
    30%, 48% { background: #f2b544; }
    62%, 100% { background: #4ade80; }
  }
  @keyframes check {
    0%, 60% { stroke-dashoffset: 24; }
    70%, 100% { stroke-dashoffset: 0; }
  }
  @keyframes signal {
    0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.8; }
    100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0; }
  }
  @keyframes enter {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
