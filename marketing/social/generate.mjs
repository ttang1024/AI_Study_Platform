/**
 * Renders the per-platform social images from template.html.
 *
 *   node marketing/social/generate.mjs            # every target
 *   node marketing/social/generate.mjs youtube    # only targets whose file name matches
 *
 * Playwright is resolved out of web/node_modules, so `npm ci` in web/ is the only setup.
 * Every output is quantised to a 256-colour palette on the way out: the artwork is a dark
 * gradient plus flat UI, so it survives the reduction with dithering and lands roughly a
 * third of the truecolour size, which keeps the uploads inside the tighter platform caps.
 */

import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('playwright');
const execFileAsync = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(HERE, 'template.html');
const REPO = path.resolve(HERE, '..', '..');

/** mode picks the layout; width/height are the platform's exact pixel spec. */
const TARGETS = [
  {
    file: 'linkedin-1200x627.png',
    mode: 'landscape',
    w: 1200,
    h: 627,
    note: 'LinkedIn link preview / post',
  },
  {
    file: 'facebook-1200x630.png',
    mode: 'landscape',
    w: 1200,
    h: 630,
    note: 'Facebook link preview / post',
  },
  { file: 'x-1200x675.png', mode: 'landscape', w: 1200, h: 675, note: 'X (Twitter) post image' },
  {
    file: 'instagram-square-1080x1080.png',
    mode: 'square',
    w: 1080,
    h: 1080,
    note: 'Instagram square post',
  },
  {
    file: 'instagram-portrait-1080x1350.png',
    mode: 'portrait',
    w: 1080,
    h: 1350,
    note: 'Instagram portrait post',
  },
  {
    file: 'instagram-story-1080x1920.png',
    mode: 'story',
    w: 1080,
    h: 1920,
    note: 'Instagram Stories',
  },
  { file: 'tiktok-1080x1920.png', mode: 'story', w: 1080, h: 1920, note: 'TikTok vertical promo' },
  { file: 'youtube-1280x720.png', mode: 'thumb', w: 1280, h: 720, note: 'YouTube video thumbnail' },
  {
    file: 'wechat-square-1080x1080.png',
    mode: 'square',
    w: 1080,
    h: 1080,
    note: 'WeChat square post',
  },
  // The site's og:image. Written straight into web/public so a regeneration ships with the app.
  {
    file: '../../web/public/share.png',
    mode: 'square',
    w: 1200,
    h: 1200,
    note: 'og:image (share.png)',
  },
];

/**
 * Pillow ships with the system python3 here and is the only image dependency; keeping the
 * quantisation in one place means a failure is loud rather than silently emitting a 3x file.
 */
async function quantise(file) {
  await execFileAsync('python3', [
    '-c',
    [
      'import sys',
      'from PIL import Image',
      'p = sys.argv[1]',
      'im = Image.open(p).convert("RGB")',
      'im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(p, optimize=True)',
    ].join('\n'),
    file,
  ]);
}

const filter = process.argv[2];
const targets = filter ? TARGETS.filter((t) => t.file.includes(filter)) : TARGETS;

if (targets.length === 0) {
  console.error(
    `No target matches "${filter}". Known targets:\n  ${TARGETS.map((t) => t.file).join('\n  ')}`,
  );
  process.exit(1);
}

const browser = await chromium.launch();

try {
  for (const { file, mode, w, h, note } of targets) {
    const out = path.resolve(HERE, file);
    await fs.mkdir(path.dirname(out), { recursive: true });

    // deviceScaleFactor 1 keeps the screenshot at the exact pixel spec rather than a multiple.
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(`file://${TEMPLATE}?mode=${mode}&w=${w}&h=${h}`, { waitUntil: 'networkidle' });
    // Orbitron and Inter arrive from Google Fonts; screenshotting before they land silently
    // falls back to the system sans and changes every measurement on the card.
    await page.evaluate(() => document.fonts.ready);

    // A column that outgrows the frame still paints — it just runs past the padding and off
    // the canvas, which is how a chip row ends up sliced in half. scrollHeight is no use
    // here: these columns are flex items that simply *grow*, so scrollHeight always equals
    // clientHeight however far they overshoot. Compare the column's bottom edge against the
    // content box instead. 1px of slack absorbs subpixel rounding when --s is not exactly 1.
    const overflow = await page.evaluate(() => {
      const content = document.querySelector('.content');
      const limit =
        content.getBoundingClientRect().bottom -
        parseFloat(getComputedStyle(content).paddingBottom);
      const spill = (sel) => {
        const el = document.querySelector(sel);
        if (!el || el.offsetParent === null) return null;
        const over = Math.round(el.getBoundingClientRect().bottom - limit);
        return over > 1 ? `${sel} by ${over}px` : null;
      };
      return [spill('.col-main'), spill('.col-side')].filter(Boolean).join(', ');
    });
    if (overflow) {
      throw new Error(`${file}: content overflows ${overflow} — adjust the ${mode} sizes`);
    }

    await page.screenshot({ path: out });
    await page.close();

    await quantise(out);
    const { size } = await fs.stat(out);
    console.log(
      `${String(Math.round(size / 1024)).padStart(5)} KB  ${w}x${h}  ${path.relative(REPO, out)}  — ${note}`,
    );
  }
} finally {
  await browser.close();
}
