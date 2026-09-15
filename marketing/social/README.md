# Social images

Per-platform promotional images, all rendered from one template so the set stays a family.

```bash
node marketing/social/generate.mjs            # all of them
node marketing/social/generate.mjs youtube    # just the targets whose file name matches
```

The only setup is `npm ci` in `web/` — the script borrows Playwright and its Chromium from there.
Fonts come from Google Fonts at render time, so the machine needs network access.

| File                               | Platform          | Purpose             | Size        |
| ---------------------------------- | ----------------- | ------------------- | ----------- |
| `linkedin-1200x627.png`            | LinkedIn          | Link preview / post | 1200 × 627  |
| `facebook-1200x630.png`            | Facebook          | Link preview / post | 1200 × 630  |
| `x-1200x675.png`                   | X (Twitter)       | Post image          | 1200 × 675  |
| `instagram-square-1080x1080.png`   | Instagram         | Square post         | 1080 × 1080 |
| `instagram-portrait-1080x1350.png` | Instagram         | Portrait post       | 1080 × 1350 |
| `instagram-story-1080x1920.png`    | Instagram Stories | Story               | 1080 × 1920 |
| `tiktok-1080x1920.png`             | TikTok            | Vertical promo      | 1080 × 1920 |
| `youtube-1280x720.png`             | YouTube           | Video thumbnail     | 1280 × 720  |
| `wechat-square-1080x1080.png`      | WeChat            | Square post         | 1080 × 1080 |
| `../../web/public/share.png`       | the site          | `og:image`          | 1200 × 1200 |

`share.png` is written straight into `web/public/` so regenerating it ships with the app. It is the
only output the site itself serves; everything else is uploaded to each platform by hand and is not
part of the web bundle.

## How the template works

`template.html` is one card with five layouts, chosen by the `mode` query parameter:

| Mode        | Base width | Used by                                                              |
| ----------- | ---------- | -------------------------------------------------------------------- |
| `landscape` | 1200       | LinkedIn, Facebook, X — text column beside a stack of artifact cards |
| `thumb`     | 1280       | YouTube — text only, sized to survive being shown ~246px wide        |
| `square`    | 1080       | Instagram square, WeChat, `share.png`                                |
| `portrait`  | 1080       | Instagram 4:5                                                        |
| `story`     | 1080       | Stories and TikTok — inset from the platform's top and bottom UI     |

Every length is written against its mode's base width and multiplied by `--s` (`width / base`), so a
target can be any size in the same family and still render at the same visual weight. The mode
variables must carry a unit — `--h1: 82px`, not `--h1: 82` — because `calc(82 * var(--s))` is a
plain number, not a length, and the browser drops the whole declaration silently.

The markup is one shape for every mode; the rules at the bottom of the stylesheet decide what each
one shows.

## Adding a size

Add a row to `TARGETS` in `generate.mjs` naming the mode closest to its aspect ratio. Before
screenshotting, the script checks that neither column's bottom edge runs past the content box and
fails loudly if it does — these columns are flex items that grow, so `scrollHeight` never reports
the overflow, and a clipped chip row is easy to miss otherwise. If a new size trips it, adjust that
mode's variables rather than the shared rules.
