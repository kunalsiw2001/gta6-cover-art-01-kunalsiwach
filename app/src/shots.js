// Fixed scenes for screenshots: ?shot=cover shows the cover alone, full
// screen; ?shot=editor shows the editor with sample photos loaded.
// Query params: layout, grade, size, title, subtitle, placement,
// photo / photo2 / photo3 / photo4 (sample names, one per panel).
// window.__shotReady is set once the scene has painted.
export async function runShot(shot, query, env) {
  const photos = ['photo', 'photo2', 'photo3', 'photo4']
    .map((key) => query.get(key))
    .filter(Boolean);
  const scene = {
    layout: query.get('layout') ?? 'hero',
    grade: query.get('grade') ?? 'sunset',
    size: query.get('size') ?? 'square',
    title: query.get('title') ?? 'SUNSET HEIST',
    subtitle: query.get('subtitle') ?? 'BOULEVARD QUEEN',
    placement: query.get('placement') ?? 'bottom',
    photos: photos.length ? photos : ['pier'],
  };
  await env.apply(scene);
  if (shot === 'cover') env.fitCover();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
