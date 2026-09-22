const flame = `
<svg class="flame-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <path fill="#c4451c" d="M32 8c3 8-7 12-4 22 2 7 8 9 8 9s-8 2-10 8c-1 4 1 9 6 11-12-2-18-12-16-22 2-11 14-16 16-28z"/>
  <path fill="#e25822" d="M34 12c2 7-4 11-2 19 1 6 7 8 7 8s-6 3-7 8c-1 4 2 8 6 10-10-1-15-10-14-19 2-10 8-15 10-26z"/>
  <path fill="#e8b86d" d="M36 28c1 5 6 7 6 7s-5 3-5 8c0 4 3 7 6 8-8 0-12-7-11-14 1-6 3-9 4-9z"/>
</svg>
`;

export function brandBlock(compact = false): string {
  return `
    <div class="brand ${compact ? "brand-compact" : ""}">
      ${flame}
      <div class="brand-text">
        <h1><span>Fire</span> and Fellowship</h1>
        <p class="brand-credit">Design by Freddy Jara-Almonte</p>
        <p class="brand-tagline">Men's Fellowship</p>
      </div>
    </div>
  `;
}
