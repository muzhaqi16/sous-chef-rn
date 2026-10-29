#!/usr/bin/env node
/**
 * Renders the store screenshots, the Play feature graphic and the App Store
 * header for one app language, from raw iPhone captures in that language,
 * outside the repo (the system temp dir's `sous-chef-store-listing` by
 * default). Captions and order are `frames.json`; the store copy they must
 * agree with is `listing.json`.
 *
 *   node scripts/store-listing/render.mjs [--locale en|es|it|sq] [raw-root] [out-root]
 *
 * `<raw-root>/<locale>/` holds full-resolution captures named as `frames.json`
 * names them, taken on an iPhone 18 Pro simulator signed in to the account
 * `seed-demo.mjs` fills, the app in that language, with
 * `xcrun simctl status_bar <udid> override --time 9:41`, its names set to
 * `frames.json` `demoNames` and its catalog names re-asked in that language.
 * The images land in
 * `<out-root>/<locale>/`, each custom product page's iPhone set (the same
 * frames, reordered) under `cpp-<page>/`.
 * Needs Google Chrome (`CHROME` overrides its path) and macOS `sips`.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const WORK = join(tmpdir(), 'sous-chef-store-listing');
const args = process.argv.slice(2);
const localeAt = args.indexOf('--locale');
const LOCALE = localeAt === -1 ? 'en' : args.splice(localeAt, 2)[1];
const RAW = join(resolve(args[0] ?? join(WORK, 'raw')), LOCALE);
const OUT = join(resolve(args[1] ?? join(WORK, 'out')), LOCALE);
const CHROME =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ICON = join(
  REPO,
  'ios/SousChef/Images.xcassets/AppIcon.appiconset/1024.png',
);
const spec = JSON.parse(readFileSync(join(HERE, 'frames.json'), 'utf8'));

/** A caption in this locale; missing copy stops the run rather than falling back. */
function copyIn(copy, what) {
  const found = copy[LOCALE];
  if (!found) throw new Error(`frames.json has no ${LOCALE} copy for ${what}`);
  return found;
}

// The App Store's required iPhone sizes, then Play's 9:16 phone size: a Play
// side may be at most twice the other, which 1320×2868 is not.
const TARGETS = {
  'ios-6.9': [1320, 2868],
  'ios-6.3': [1206, 2622],
  'play-phone': [1080, 1920],
};
const TONES = {
  light: {
    bg1: '#FFF7ED',
    bg2: '#FAF9F7',
    ink: '#211E18',
    sub: '#514D45',
    accent: '#EA590C',
    bezel: '#211E18',
  },
  dark: {
    bg1: '#2A2620',
    bg2: '#171510',
    ink: '#FAF9F7',
    sub: '#DAD6CD',
    accent: '#FB923B',
    bezel: '#000000',
  },
  brand: {
    bg1: '#F58234',
    bg2: '#EA590C',
    ink: '#FFFFFF',
    sub: '#FFEDD5',
    accent: '#FFFFFF',
    bezel: '#211E18',
  },
};
const BRAND_BG =
  'radial-gradient(90% 120% at 15% 20%, #fb923b 0%, #f58234 40%, #ea590c 100%)';

const img = file => pathToFileURL(file).href;
const raw = name => img(join(RAW, name));

function sipsInfo(file) {
  const out = execFileSync(
    'sips',
    ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', file],
    { encoding: 'utf8' },
  );
  const read = key => out.match(new RegExp(`${key}: (\\S+)`))?.[1];
  return {
    w: Number(read('pixelWidth')),
    h: Number(read('pixelHeight')),
    alpha: read('hasAlpha') === 'yes',
  };
}

/** Screenshots `html` at w×h CSS px times `scale` into `out`, opaque and checked. */
function render(html, [w, h], out, scale = 1) {
  const page = `${out}.html`;
  writeFileSync(page, html);
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--force-device-scale-factor=${scale}`,
      `--window-size=${w},${h}`,
      `--screenshot=${out}`,
      pathToFileURL(page).href,
    ],
    { stdio: 'ignore' },
  );
  rmSync(page);
  let info = sipsInfo(out);
  if (info.alpha) {
    // App Store Connect refuses an alpha channel even when every pixel is opaque.
    execFileSync('sips', ['-s', 'format', 'bmp', out, '--out', `${out}.bmp`], {
      stdio: 'ignore',
    });
    execFileSync('sips', ['-s', 'format', 'png', `${out}.bmp`, '--out', out], {
      stdio: 'ignore',
    });
    rmSync(`${out}.bmp`);
    info = sipsInfo(out);
  }
  if (info.w !== w * scale || info.h !== h * scale || info.alpha) {
    throw new Error(
      `${out}: ${info.w}×${info.h} alpha=${info.alpha}, wanted ${w * scale}×${
        h * scale
      } opaque`,
    );
  }
  console.log(`${out}  ${info.w}×${info.h}`);
}

function framePage(frame, [w, h]) {
  const t = TONES[frame.tone];
  const tall = h / w > 2;
  const hs = Math.round(w * (tall ? 0.078 : 0.072));
  const dw = Math.round(w * (tall ? 0.76 : 0.66));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
body{background:radial-gradient(120% 70% at 50% 0%,${t.bg1} 0%,${
    t.bg2
  } 70%);font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;color:${
    t.ink
  };position:relative}
.cap{position:absolute;left:${Math.round(w * 0.07)}px;right:${Math.round(
    w * 0.07,
  )}px;top:${Math.round(h * (tall ? 0.055 : 0.045))}px;text-align:center}
.h{font-weight:800;font-size:${hs}px;line-height:1.06;letter-spacing:-0.02em;margin:0}
.h em{font-style:normal;color:${t.accent}}
.s{font-weight:500;font-size:${Math.round(hs * 0.46)}px;line-height:1.3;color:${
    t.sub
  };margin:${Math.round(hs * 0.32)}px auto 0;max-width:92%}
.dev{position:absolute;left:50%;top:${Math.round(
    h * (tall ? 0.225 : 0.215),
  )}px;width:${dw}px;transform:translateX(-50%);border:${Math.round(
    w * 0.012,
  )}px solid ${t.bezel};border-radius:${Math.round(
    dw * 0.11,
  )}px;overflow:hidden;box-shadow:0 ${Math.round(w * 0.02)}px ${Math.round(
    w * 0.06,
  )}px rgba(33,30,24,.28)}
.dev img{display:block;width:100%}
</style></head><body>
<div class="cap"><p class="h">${
    copyIn(frame.copy, frame.id).headline
  }</p><p class="s">${copyIn(frame.copy, frame.id).sub}</p></div>
<div class="dev"><img src="${raw(frame.shot)}"></div>
</body></html>`;
}

function phones(shots, h, share) {
  const pw = (h * share) / 2.174;
  const tilt = [
    [-4, 30],
    [0, -10],
    [4, 30],
  ];
  return shots
    .map((s, i) => {
      const [r, dy] = shots.length === 2 ? tilt[i === 0 ? 0 : 1] : tilt[i];
      return `<div class="ph" style="width:${pw}px;border:${
        pw * 0.03
      }px solid #211E18;border-radius:${
        pw * 0.12
      }px;transform:translateY(${dy}px) rotate(${r}deg)"><img src="${raw(
        s,
      )}"></div>`;
    })
    .join('');
}

const wideStyle = (
  w,
  h,
) => `html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
body{background:${BRAND_BG};font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;color:#fff;display:flex;align-items:center;box-sizing:border-box}
.ph{overflow:hidden;box-shadow:0 ${h * 0.02}px ${
  h * 0.06
}px rgba(0,0,0,.35)} .ph img{display:block;width:100%}`;

function featureGraphicPage({ title, tagline, shots }, [w, h]) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${wideStyle(
    w,
    h,
  )}
.l{flex:0 0 46%;padding-left:${w * 0.06}px}
.ic{width:${h * 0.2}px;height:${h * 0.2}px;border-radius:${
    h * 0.045
  }px;box-shadow:0 ${h * 0.01}px ${h * 0.04}px rgba(0,0,0,.25)}
h1{font-weight:800;font-size:${h * 0.13}px;letter-spacing:-.02em;margin:${
    h * 0.04
  }px 0 ${h * 0.02}px}
p{font-weight:600;font-size:${
    h * 0.06
  }px;line-height:1.25;margin:0;color:#fff7ed;max-width:95%}
.r{flex:1;display:flex;justify-content:center;align-items:center;gap:${
    w * 0.02
  }px}
</style></head><body><div class="l"><img class="ic" src="${img(
    ICON,
  )}"><h1>${title}</h1><p>${tagline}</p></div><div class="r">${phones(
    shots,
    h,
    0.62,
  )}</div></body></html>`;
}

// The header doubles as the search-results asset, which App Store crops to 3:2,
// so everything sits inside the centre 3:2 and the product page names the app.
function headerPage({ tagline, shots }, [w, h]) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${wideStyle(
    w,
    h,
  )}
body{padding:0 ${w * 0.11}px}
.l{flex:0 0 42%} p{font-weight:800;font-size:${
    h * 0.056
  }px;line-height:1.12;letter-spacing:-.015em;margin:0}
.r{flex:1;display:flex;justify-content:flex-end;align-items:center;gap:${
    w * 0.015
  }px}
</style></head><body><div class="l"><p>${tagline}</p></div><div class="r">${phones(
    shots,
    h,
    0.56,
  )}</div></body></html>`;
}

for (const [target, size] of Object.entries(TARGETS)) {
  const dir = join(OUT, target);
  mkdirSync(dir, { recursive: true });
  spec.frames.forEach((frame, i) => {
    render(
      framePage(frame, size),
      size,
      join(dir, `${String(i + 1).padStart(2, '0')}-${frame.id}.png`),
    );
  });
}
const shotName = id => {
  const i = spec.frames.findIndex(frame => frame.id === id);
  if (i === -1) throw new Error(`frames.json has no frame ${id}`);
  return `${String(i + 1).padStart(2, '0')}-${id}.png`;
};
for (const [page, order] of Object.entries(spec.customProductPages)) {
  for (const target of ['ios-6.9', 'ios-6.3']) {
    const dir = join(OUT, `cpp-${page}`, target);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    order.forEach((id, i) => {
      copyFileSync(
        join(OUT, target, shotName(id)),
        join(dir, `${String(i + 1).padStart(2, '0')}-${id}.png`),
      );
    });
  }
}
const { shots: featureShots, copy: featureCopy } = spec.featureGraphic;
render(
  featureGraphicPage(
    { shots: featureShots, ...copyIn(featureCopy, 'the feature graphic') },
    [1024, 500],
  ),
  [1024, 500],
  join(OUT, 'play-feature-graphic.png'),
);
// A header only for a language the App Store lists (`listing.json` _storeLanguages).
if (spec.header.copy[LOCALE]) {
  render(
    headerPage(
      { shots: spec.header.shots, ...spec.header.copy[LOCALE] },
      [2622, 1475],
    ),
    [2622, 1475],
    join(OUT, 'appstore-header-5244x2950.png'),
    2,
  );
}
