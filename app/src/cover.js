// Draws a multi-panel poster cover: the photos fill their panels, a colour
// grade washes over the whole poster, and the caption is set in bold
// outlined lettering. Everything is drawn with the 2D canvas API so the
// same code paints the live preview and the exported PNG.

/** The three post sizes the app exports, in pixels. */
export const SIZES = {
  square: { width: 1080, height: 1080, label: '1080 x 1080' },
  portrait: { width: 1080, height: 1350, label: '1080 x 1350' },
  wide: { width: 1920, height: 1080, label: '1920 x 1080' },
};

/** The poster layouts: each returns the panel rectangles for a canvas of w x h. */
export const LAYOUTS = {
  hero: 'Hero + strips',
  grid: '2 x 2 grid',
  trio: 'Three panels',
  single: 'Single hero',
};

/** The colour grades, each a wash drawn over the photos plus a tint. */
export const GRADES = {
  sunset: 'Sunset',
  neon: 'Neon Nights',
  noir: 'Noir',
  palm: 'Palm',
};

const GUTTER = 0.012; // panel gap, as a fraction of the short side

/** Returns the panel rectangles for `layout` on a canvas of `w` by `h`. */
export function layoutPanels(layout, w, h) {
  const g = Math.round(Math.min(w, h) * GUTTER);
  const inset = g;
  if (layout === 'single') {
    return [{ x: inset, y: inset, width: w - inset * 2, height: h - inset * 2 }];
  }
  if (layout === 'grid') {
    const cw = (w - inset * 2 - g) / 2;
    const ch = (h - inset * 2 - g) / 2;
    return [
      { x: inset, y: inset, width: cw, height: ch },
      { x: inset + cw + g, y: inset, width: cw, height: ch },
      { x: inset, y: inset + ch + g, width: cw, height: ch },
      { x: inset + cw + g, y: inset + ch + g, width: cw, height: ch },
    ];
  }
  if (layout === 'trio') {
    const cw = (w - inset * 2 - g * 2) / 3;
    return [0, 1, 2].map((i) => ({
      x: inset + i * (cw + g),
      y: inset,
      width: cw,
      height: h - inset * 2,
    }));
  }
  // hero: a tall hero panel on top, two short strips beneath it.
  const heroH = Math.round((h - inset * 2 - g) * 0.64);
  const stripH = h - inset * 2 - g - heroH;
  const stripW = (w - inset * 2 - g) / 2;
  return [
    { x: inset, y: inset, width: w - inset * 2, height: heroH },
    { x: inset, y: inset + heroH + g, width: stripW, height: stripH },
    { x: inset + stripW + g, y: inset + heroH + g, width: stripW, height: stripH },
  ];
}

/** How many panels a layout holds. */
export function panelCount(layout) {
  return layoutPanels(layout, 100, 100).length;
}

/** Draws one photo into a panel rect, panned by (ox, oy) and zoomed.
 * `fit` fills the panel by default; 'fit' shows the whole photo instead.
 * The default crop is biased toward the top of the photo, where faces are. */
function drawPanelPhoto(ctx, panel, img, zoom, ox, oy, fit) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const base = fit === 'fit'
    ? Math.min(panel.width / iw, panel.height / ih)
    : Math.max(panel.width / iw, panel.height / ih);
  const scale = base * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = panel.x + (panel.width - dw) / 2 + ox * panel.width;
  const dy = panel.y + (panel.height - dh) * 0.28 + oy * panel.height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.width, panel.height);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Washes the grade's colours over the whole canvas. */
function drawGrade(ctx, grade, w, h) {
  if (grade === 'noir') {
    const shade = ctx.createLinearGradient(0, 0, w, h);
    shade.addColorStop(0, 'rgba(10, 10, 14, 0.10)');
    shade.addColorStop(1, 'rgba(10, 10, 14, 0.45)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  let wash;
  if (grade === 'sunset') {
    wash = ctx.createLinearGradient(0, h * 0.25, 0, h);
    wash.addColorStop(0, 'rgba(255, 140, 60, 0)');
    wash.addColorStop(0.55, 'rgba(255, 90, 60, 0.16)');
    wash.addColorStop(1, 'rgba(190, 30, 110, 0.42)');
  } else if (grade === 'neon') {
    wash = ctx.createLinearGradient(0, 0, w, h);
    wash.addColorStop(0, 'rgba(0, 220, 255, 0.20)');
    wash.addColorStop(0.5, 'rgba(120, 40, 220, 0.10)');
    wash.addColorStop(1, 'rgba(255, 30, 160, 0.38)');
  } else {
    // palm
    wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(0, 180, 150, 0.14)');
    wash.addColorStop(0.6, 'rgba(0, 120, 110, 0.08)');
    wash.addColorStop(1, 'rgba(255, 170, 60, 0.30)');
  }
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
}

/** Draws the grade's sky motif: a low sun for Sunset, light streaks for Neon Nights. */
function drawGradeMotif(ctx, grade, w, h) {
  if (grade === 'sunset') {
    const r = Math.min(w, h) * 0.075;
    const cx = w * 0.82;
    const cy = h * 0.16;
    const sun = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    sun.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
    sun.addColorStop(0.6, 'rgba(255, 160, 70, 0.85)');
    sun.addColorStop(1, 'rgba(255, 90, 60, 0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (grade === 'neon') {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#39e6ff';
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.06);
    ctx.lineTo(w * 0.42, h * 0.06);
    ctx.stroke();
    ctx.strokeStyle = '#ff2e9a';
    ctx.beginPath();
    ctx.moveTo(w * 0.58, h * 0.94);
    ctx.lineTo(w * 0.95, h * 0.94);
    ctx.stroke();
    ctx.restore();
  }
}

/** Draws the title and subtitle in bold outlined capitals at the chosen placement.
 * The two lines are stacked as one block, anchored so neither line can run off the edge. */
function drawCaption(ctx, title, subtitle, placement, w, h) {
  const text = title.trim().toUpperCase();
  const sub = subtitle.trim().toUpperCase();
  if (!text && !sub) return;
  const unit = Math.min(w, h);
  const fontStack = '"Arial Black", "Helvetica Neue", sans-serif';

  let titleSize = 0;
  if (text) {
    titleSize = unit * 0.115;
    ctx.font = `900 ${titleSize}px ${fontStack}`;
    while (ctx.measureText(text).width > w * 0.92 && titleSize > 14) {
      titleSize -= 2;
      ctx.font = `900 ${titleSize}px ${fontStack}`;
    }
  }
  const subSize = sub ? unit * 0.038 : 0;
  const gap = unit * 0.025;
  // The block's height is the two lines plus the gap; its top edge is placed
  // by the chosen placement, with a margin that keeps it fully on the canvas.
  const blockHeight = titleSize + (text && sub ? gap + subSize : 0);
  const margin = unit * 0.05;
  let blockTop;
  if (placement === 'top') blockTop = margin;
  else if (placement === 'centre') blockTop = (h - blockHeight) / 2;
  else blockTop = h - margin - blockHeight;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  if (text) {
    ctx.font = `900 ${titleSize}px ${fontStack}`;
    ctx.lineWidth = Math.max(2, titleSize * 0.10);
    ctx.strokeStyle = 'rgba(20, 8, 30, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = titleSize * 0.18;
    ctx.shadowOffsetY = titleSize * 0.05;
    const titleBaseline = blockTop + titleSize;
    ctx.strokeText(text, w / 2, titleBaseline);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, titleBaseline);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (sub) {
    ctx.font = `800 ${subSize}px ${fontStack}`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`; } catch { /* older canvas */ }
    const subBaseline = blockTop + titleSize + (text ? gap : 0) + subSize;
    ctx.lineWidth = Math.max(2, subSize * 0.12);
    ctx.strokeStyle = 'rgba(20, 8, 30, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = subSize * 0.2;
    ctx.strokeText(sub, w / 2, subBaseline);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(sub, w / 2, subBaseline);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  ctx.restore();
}

/**
 * Draws the whole cover onto `canvas` from `state`:
 * { layout, grade, title, subtitle, placement, panels: [{ img, zoom, ox, oy }] }.
 * A panel with no photo gets a warm placeholder gradient.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const panels = layoutPanels(state.layout, w, h);

  ctx.fillStyle = '#1c1026';
  ctx.fillRect(0, 0, w, h);

  panels.forEach((panel, i) => {
    const slot = state.panels[i];
    if (slot && slot.img) {
      if (state.grade === 'noir') {
        ctx.save();
        ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.04)';
        drawPanelPhoto(ctx, panel, slot.img, slot.zoom, slot.ox, slot.oy, slot.fit);
        ctx.restore();
      } else {
        drawPanelPhoto(ctx, panel, slot.img, slot.zoom, slot.ox, slot.oy, slot.fit);
      }
    } else {
      const warm = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y + panel.height);
      warm.addColorStop(0, '#ff9a5c');
      warm.addColorStop(0.5, '#e85d8a');
      warm.addColorStop(1, '#5b2a86');
      ctx.fillStyle = warm;
      ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `700 ${Math.round(Math.min(panel.width, panel.height) * 0.06)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', panel.x + panel.width / 2, panel.y + panel.height / 2);
    }
  });

  drawGradeMotif(ctx, state.grade, w, h);
  drawGrade(ctx, state.grade, w, h);

  // Thin poster frame around the whole cover.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

  drawCaption(ctx, state.title, state.subtitle, state.placement, w, h);
}
