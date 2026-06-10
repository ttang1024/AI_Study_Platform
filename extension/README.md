# Easy Study Web Clipper (browser extension)

Clips the page you're viewing into your Easy Study library.

## Install (Chrome / Edge / Brave)

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this `extension/` folder.
3. (Optional) Edit `APP_ORIGIN` in `background.js` if your app isn't at `http://localhost:3000`.
4. Add an `icon128.png` (any 128×128 PNG — e.g. copy `web/public/app.png`).

## Use

On any article, click the toolbar button. The app opens its Web clipper with
the URL prefilled — press **Clip Article** and the page is fetched, cleaned to
Markdown, and saved to the course you pick.

Prefer no extension? Settings → Export → **Web Clipper bookmarklet** does the
same thing from your bookmarks bar.
