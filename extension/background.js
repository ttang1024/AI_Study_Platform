// Easy Study Web Clipper — clicking the toolbar button opens the app's web
// clipper with the current tab's URL prefilled. The app (already logged in)
// fetches and converts the article server-side.

// Change this if you self-host the app elsewhere.
const APP_ORIGIN = 'http://localhost:5173';

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.url || !/^https?:/i.test(tab.url)) return;
  const clipUrl = `${APP_ORIGIN}/summarizer?tab=web&clip=${encodeURIComponent(tab.url)}`;
  chrome.tabs.create({ url: clipUrl });
});
