// Fixed scenes for screenshots and checks.
//
// `?shot=cover` shows the cover alone, full-bleed, for the cover shots.
// `?shot=editor` shows the whole editor with a photo loaded. `?shot=export-test`
// draws the cover and runs the same export the Export button calls, then
// publishes its byte size on window.__exportInfo so a check can read it.
// Every scene sets window.__shotReady once the cover is painted.
//
// Query knobs: photo (boulevard | pier), caption (the title), subtitle,
// badge, layout (quad | hero | bleed | collage), grade
// (sunset | neon | dusk | noir), size (square | portrait | wide).

function ready() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.__shotReady = true;
      resolve();
    }));
  });
}

function readScene(query) {
  return {
    photo: query.get('photo') ?? 'pier',
    title: query.get('caption') ?? 'Sunset Heist',
    subtitle: query.get('subtitle') ?? 'one last ride down Ocean Drive',
    badge: query.get('badge') ?? 'Vice City',
    layout: query.get('layout') ?? 'hero',
    grade: query.get('grade') ?? 'sunset',
    size: query.get('size') ?? 'square',
  };
}

async function fillAllPanels(scene, hooks) {
  // One photo in every panel, each panel keeping its own look-up crop.
  for (let i = 0; i < 4; i += 1) {
    await hooks.loadIntoPanel(i, `samples/${scene.photo}.jpg`, scene.photo);
  }
}

export async function runShot(shot, query, hooks) {
  const scene = readScene(query);
  hooks.setState({
    layout: scene.layout,
    grade: scene.grade,
    size: scene.size,
    title: scene.title,
    subtitle: scene.subtitle,
    badge: scene.badge,
  });
  // Keep the editor's text inputs showing the same words as the cover.
  const titleInput = document.getElementById('title');
  const subtitleInput = document.getElementById('subtitle');
  const badgeInput = document.getElementById('badge');
  if (titleInput) titleInput.value = scene.title;
  if (subtitleInput) subtitleInput.value = scene.subtitle;
  if (badgeInput) badgeInput.value = scene.badge;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'cover' || shot === 'export-test') {
    await fillAllPanels(scene, hooks);
    hooks.redraw();
    if (shot === 'export-test') return runExportTest(hooks);
    return ready();
  }
  if (shot === 'editor') {
    await hooks.loadSample(scene.photo, 0);
    hooks.redraw();
    return ready();
  }
  return ready();
}

// The export check: runs the exact exportCover the Export button calls,
// at the square size, and reports the PNG back on the window so an
// automated check can verify the export path end to end.
async function runExportTest(hooks) {
  try {
    const blob = await hooks.exportCover('square');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('could not read the exported PNG'));
      reader.readAsDataURL(blob);
    });
    window.__exportInfo = {
      bytes: blob.size,
      width: 1080,
      height: 1080,
      mime: blob.type,
      dataUrl,
    };
  } catch (error) {
    window.__exportInfo = { error: String(error?.message ?? error) };
  }
  return ready();
}
