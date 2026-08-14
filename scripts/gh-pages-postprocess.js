// GitHub Pages has no server-side routing — a request for a path with no
// exact matching file (e.g. /listing/abc123, since the export only produces
// the literal file listing/[token].html) falls through to 404.html. This is
// the standard "spa-github-pages" trick (rafgraph/spa-github-pages): 404.html
// encodes the real path into a query string and redirects to index.html;
// this script's twin snippet, injected into index.html's <head>, decodes it
// and calls history.replaceState BEFORE Expo Router's own bundle boots and
// reads window.location, so the app renders the actual requested route
// instead of the homepage. Re-run after every `expo export -p web` — the
// export always regenerates dist/ from scratch.
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

// GitHub Pages project sites serve from a subpath (https://user.github.io/repo/),
// but Expo's static export always emits root-absolute asset paths
// ("/assets/...", "/_expo/..."), both in every HTML shell's <script>/<link>
// tags AND baked as literal string constants inside the bundled JS itself
// (Metro's font/asset resolution). app.json's experiments.baseUrl and the
// EXPO_BASE_URL env var were both tried and neither actually changes this
// output (confirmed by inspecting the generated files) — so this rewrites
// every occurrence directly, post-export, across every .html and .js file.
const BASE_PATH = '/hazbot-web';

function walk(dir, exts, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, files);
    else if (exts.some((e) => entry.name.endsWith(e))) files.push(full);
  }
  return files;
}

let rewritten = 0;
for (const file of walk(distDir, ['.html', '.js'])) {
  const original = fs.readFileSync(file, 'utf8');
  const patched = original
    .replaceAll('"/assets/', `"${BASE_PATH}/assets/`)
    .replaceAll('"/_expo/', `"${BASE_PATH}/_expo/`)
    .replaceAll('="/favicon.ico"', `="${BASE_PATH}/favicon.ico"`);
  if (patched !== original) {
    fs.writeFileSync(file, patched);
    rewritten++;
  }
}
console.log(`Rewrote absolute asset paths to ${BASE_PATH} in ${rewritten} file(s)`);

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html not found — run `expo export -p web` first.');
  process.exit(1);
}

const restoreScript =
  '<script>' +
  '(function(){var p=new URLSearchParams(window.location.search).get("p");' +
  'if(p){window.history.replaceState(null,"",p+window.location.hash);}' +
  '})();' +
  '</script>';

let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('URLSearchParams(window.location.search).get("p")')) {
  html = html.replace('<head>', '<head>' + restoreScript);
  fs.writeFileSync(indexPath, html);
  console.log('Injected path-restore script into dist/index.html');
} else {
  console.log('dist/index.html already has the path-restore script');
}

const notFoundHtml =
  '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<script>' +
  'var l=window.location;' +
  'window.location.replace(l.origin+"/?p="+encodeURIComponent(l.pathname+l.search)+l.hash);' +
  '</script>' +
  '</head><body></body></html>';

fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml);
console.log('Wrote dist/404.html');

// Privacy Policy / Terms of Service need a URL that resolves on the very
// first request — App Store Connect and Apple's reviewers load these
// directly, never through in-app navigation, so they can't depend on the
// SPA 404-redirect trick above (which itself doesn't fully work for nested
// paths here — see PublicListingScreen's doc comment in
// src/app/listing/[token].tsx). Copied as plain, standalone HTML files
// instead of expo-router pages, so GitHub Pages serves them as a direct
// file match with zero client-side routing involved.
const legalDir = path.join(__dirname, '..', 'legal');
for (const name of ['privacy.html', 'terms.html']) {
  fs.copyFileSync(path.join(legalDir, name), path.join(distDir, name));
}
console.log('Copied privacy.html and terms.html into dist/');
