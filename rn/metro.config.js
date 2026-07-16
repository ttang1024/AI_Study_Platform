// Metro config so the app can bundle the shared package (../packages/core),
// which lives outside the Expo project root. packages/core is pure TS with no
// runtime deps of its own, so all dependencies still resolve from this app's
// node_modules.
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
// The repo root contains both this app and packages/. Two things are needed for
// Metro to bundle the out-of-root shared code:
//   1) The repo-root `pnpm-workspace.yaml` — Expo auto-detects the workspace root
//      from it and stops pinning Metro's server root to rn/ (without a marker it
//      falls back to the app dir, and packages/ is never crawled).
//   2) watchFolders below — the file map crawls its watch roots; watch the repo
//      root (which *contains* projectRoot) and block the other deployables to
//      keep the crawl fast.
const workspaceRoot = path.resolve(projectRoot, '..');
const coreSrc = path.resolve(workspaceRoot, 'packages/core/src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

// Resolve every dependency from this app's node_modules — packages/core brings none.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

// Keep the crawl to rn/ + packages/: exclude the sibling deployables (they're
// large — .NET build output, other node_modules) from the file map.
const escapeRe = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const existingBlock = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];
config.resolver.blockList = [
  ...existingBlock,
  new RegExp(`^${escapeRe(path.join(workspaceRoot, 'server'))}/.*`),
  new RegExp(`^${escapeRe(path.join(workspaceRoot, 'web'))}/.*`),
  new RegExp(`^${escapeRe(path.join(workspaceRoot, 'admin'))}/.*`),
  new RegExp(`^${escapeRe(path.join(workspaceRoot, 'extension'))}/.*`),
];

// Expo's tsconfig-paths support resolves `@/*` (inside the project root) but not
// `@core/*`, whose target escapes the root. Map it ourselves and return an
// explicit sourceFile resolution — delegating an absolute path to the default
// resolver doesn't work (it expects a module specifier there, not a filepath).
const CORE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.json'];
const resolveCoreFile = (target) => {
  for (const ext of CORE_EXTS) {
    if (fs.existsSync(target + ext)) return target + ext;
  }
  for (const ext of CORE_EXTS) {
    const index = path.join(target, `index${ext}`);
    if (fs.existsSync(index)) return index;
  }
  return null;
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@core' || moduleName.startsWith('@core/')) {
    const sub = moduleName === '@core' ? 'index' : moduleName.slice('@core/'.length);
    const filePath = resolveCoreFile(path.join(coreSrc, sub));
    if (filePath) return { type: 'sourceFile', filePath };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
