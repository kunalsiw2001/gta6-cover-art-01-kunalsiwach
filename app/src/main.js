// Wires the cover studio: layout and grade pickers, per-panel photos with
// drag-to-pan and zoom, the caption, and PNG export in the three post sizes.
// A `?shot=` query sets up a fixed scene for a screenshot (./shots.js).
import { drawCover, layoutPanels, panelCount, SIZES, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const placementSelect = document.getElementById('placement');
const sizeSelect = document.getElementById('sizeSelect');
const panelList = document.getElementById('panelList');

const SAMPLES = { boulevard: 'Boulevard', pier: 'Pier' };

const state = {
  layout: 'hero',
  grade: 'sunset',
  size: 'square',
  title: titleInput.value,
  subtitle: subtitleInput.value,
  placement: placementSelect.value,
  panels: [],
};
let selectedPanel = 0;

function blankPanel() {
  return { img: null, name: '', zoom: 1, ox: 0, oy: 0, fit: 'fill' };
}

/** Resizes the panel list to the current layout, keeping photos already placed. */
function syncPanels() {
  const keep = state.panels;
  state.panels = Array.from({ length: panelCount(state.layout) }, (_, i) => keep[i] ?? blankPanel());
  if (selectedPanel >= state.panels.length) selectedPanel = 0;
  buildPanelList();
}

function redraw() {
  const size = SIZES[state.size];
  canvas.width = size.width;
  canvas.height = size.height;
  drawCover(canvas, state);
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function setPanelPhoto(index, fileOrUrl, name) {
  const img = typeof fileOrUrl === 'string'
    ? await loadImage(fileOrUrl)
    : await loadImage(URL.createObjectURL(fileOrUrl));
  state.panels[index] = { ...state.panels[index], img, name, zoom: 1, ox: 0, oy: 0 };
  selectedPanel = index;
  buildPanelList();
  redraw();
}

function buildChoiceButtons(el, entries, current, onPick) {
  el.textContent = '';
  for (const [key, label] of Object.entries(entries)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(key === current));
    button.addEventListener('click', () => {
      onPick(key);
      buildChoiceButtons(el, entries, key, onPick);
      redraw();
    });
    el.appendChild(button);
  }
}

function buildPanelList() {
  panelList.textContent = '';
  state.panels.forEach((panel, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row' + (i === selectedPanel ? ' selected' : '');
    row.addEventListener('click', () => { selectedPanel = i; buildPanelList(); });

    const head = document.createElement('div');
    head.className = 'panel-head';
    const label = document.createElement('strong');
    label.textContent = `Panel ${i + 1}`;
    const photoName = document.createElement('span');
    photoName.textContent = panel.img ? panel.name : 'empty';
    head.append(label, photoName);

    const buttons = document.createElement('div');
    buttons.className = 'panel-buttons';
    const upload = document.createElement('button');
    upload.type = 'button';
    upload.textContent = 'Upload photo';
    upload.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedPanel = i;
      fileInput.click();
    });
    buttons.append(upload);
    for (const [key, labelText] of Object.entries(SAMPLES)) {
      const sample = document.createElement('button');
      sample.type = 'button';
      sample.textContent = `Sample: ${labelText}`;
      sample.addEventListener('click', async (e) => {
        e.stopPropagation();
        await setPanelPhoto(i, `samples/${key}.jpg`, labelText);
      });
      buttons.append(sample);
    }
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    clear.disabled = !panel.img;
    clear.addEventListener('click', (e) => {
      e.stopPropagation();
      state.panels[i] = blankPanel();
      buildPanelList();
      redraw();
    });
    buttons.append(clear);

    const zoomRow = document.createElement('label');
    zoomRow.className = 'zoom-row';
    zoomRow.textContent = 'Zoom ';
    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '3';
    zoom.step = '0.05';
    zoom.value = String(panel.zoom);
    zoom.disabled = !panel.img;
    zoom.setAttribute('aria-label', `Zoom panel ${i + 1}`);
    zoom.addEventListener('input', () => {
      state.panels[i].zoom = Number(zoom.value);
      redraw();
    });
    zoomRow.append(zoom);

    const fitRow = document.createElement('label');
    fitRow.className = 'fit-row';
    const fit = document.createElement('input');
    fit.type = 'checkbox';
    fit.checked = panel.fit === 'fit';
    fit.disabled = !panel.img;
    fit.addEventListener('change', () => {
      state.panels[i].fit = fit.checked ? 'fit' : 'fill';
      redraw();
    });
    fitRow.append(fit, document.createTextNode(' Fit whole photo (off = fill panel)'));

    row.append(head, buttons, zoomRow, fitRow);
    panelList.append(row);
  });
}

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  await setPanelPhoto(selectedPanel, file, file.name);
  status.textContent = `Loaded ${file.name} into panel ${selectedPanel + 1}.`;
});

buildChoiceButtons(document.getElementById('layoutChoices'), LAYOUTS, state.layout, (key) => {
  state.layout = key;
  syncPanels();
});
buildChoiceButtons(document.getElementById('gradeChoices'), GRADES, state.grade, (key) => {
  state.grade = key;
});
syncPanels();

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
placementSelect.addEventListener('change', () => { state.placement = placementSelect.value; redraw(); });
sizeSelect.addEventListener('change', () => { state.size = sizeSelect.value; redraw(); });

// Drag a panel in the preview to pan its photo.
let drag = null;
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  const i = panels.findIndex((p) => x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height);
  return i === -1 ? null : { index: i, panel: panels[i], x, y };
}
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (!hit || !state.panels[hit.index].img) return;
  selectedPanel = hit.index;
  buildPanelList();
  drag = { ...hit, startX: e.clientX, startY: e.clientY, ox: state.panels[hit.index].ox, oy: state.panels[hit.index].oy };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const slot = state.panels[drag.index];
  slot.ox = Math.max(-0.5, Math.min(0.5, drag.ox + ((e.clientX - drag.startX) / rect.width) * (canvas.width / drag.panel.width)));
  slot.oy = Math.max(-0.5, Math.min(0.5, drag.oy + ((e.clientY - drag.startY) / rect.height) * (canvas.height / drag.panel.height)));
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

// Drop a photo file onto a panel to fill it.
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  const hit = panelAt(e.clientX, e.clientY);
  if (!file || !hit) return;
  await setPanelPhoto(hit.index, file, file.name);
  status.textContent = `Loaded ${file.name} into panel ${hit.index + 1}.`;
});

/** Exports the cover at `sizeKey` as a PNG download. */
export async function exportPng(sizeKey) {
  const size = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = size.width;
  off.height = size.height;
  drawCover(off, state);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cover-${size.width}x${size.height}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  status.textContent = `Saved cover-${size.width}x${size.height}.png`;
  return blob;
}

document.getElementById('exportSquare').addEventListener('click', () => exportPng('square'));
document.getElementById('exportPortrait').addEventListener('click', () => exportPng('portrait'));
document.getElementById('exportWide').addEventListener('click', () => exportPng('wide'));

// Handles the ?shot= scenes: the screenshot setup lives in ./shots.js.
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    loadImage,
    apply: async (scene) => {
      state.layout = scene.layout;
      state.grade = scene.grade;
      state.size = scene.size;
      state.title = scene.title;
      state.subtitle = scene.subtitle;
      state.placement = scene.placement;
      titleInput.value = scene.title;
      subtitleInput.value = scene.subtitle;
      placementSelect.value = scene.placement;
      sizeSelect.value = scene.size;
      syncPanels();
      for (let i = 0; i < scene.photos.length; i += 1) {
        const img = await loadImage(`samples/${scene.photos[i]}.jpg`);
        state.panels[i] = { ...state.panels[i], img, name: SAMPLES[scene.photos[i]] ?? scene.photos[i] };
      }
      buildPanelList();
      redraw();
    },
    fitCover: () => {
      document.body.classList.add('shot-cover');
      const size = SIZES[state.size];
      const scale = Math.min(innerWidth / size.width, innerHeight / size.height);
      canvas.style.width = `${Math.round(size.width * scale)}px`;
      canvas.style.height = `${Math.round(size.height * scale)}px`;
    },
  });
} else {
  redraw();
}
