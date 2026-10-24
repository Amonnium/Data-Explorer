const fs = require('fs/promises');
const path = require('path');

const DEFAULT_IGNORED_DIRECTORIES = ['node_modules', '.git', 'public'];
const DEFAULT_IGNORED_FILES = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml',
  'tsconfig.json', 'jsconfig.json', 'deno.json', 'deno.jsonc', 'biome.json',
  '.eslintrc.json', '.prettierrc', '.prettierrc.json', 'composer.json', 'composer.lock',
  'pom.xml', 'settings.xml', 'web.config', 'app.config'
]);

/**
 * UI-independent, project-scoped structured-data explorer.
 *
 * Use dataRoots to opt in to the folders that contain searchable data. For
 * example, dataRoots: ['data', 'fixtures'] prevents application files from
 * ever being indexed. Without it, the project root is searched while common
 * project metadata is excluded.
 */
function createDataExplorer({
  root = process.cwd(),
  dataRoots = ['.'],
  extensions = ['.json', '.xml'],
  ignored = []
} = {}) {
  const projectRoot = path.resolve(root);
  const allowedExtensions = new Set(extensions.map(extension => extension.toLowerCase()));
  const ignoredNames = new Set([...DEFAULT_IGNORED_DIRECTORIES, ...ignored]);
  const searchRoots = dataRoots.map(relativePath => resolvePath(relativePath));

  const toRelative = fullPath => path.relative(projectRoot, fullPath).replaceAll(path.sep, '/');
  const isDataFile = filePath => allowedExtensions.has(path.extname(filePath).toLowerCase());

  function resolvePath(relativePath = '') {
    const resolved = path.resolve(projectRoot, relativePath);
    if (resolved !== projectRoot && !resolved.startsWith(`${projectRoot}${path.sep}`)) throw new Error('Invalid path');
    return resolved;
  }

  function isWithinSearchRoots(filePath) {
    return searchRoots.some(searchRoot => filePath === searchRoot || filePath.startsWith(`${searchRoot}${path.sep}`));
  }

  function isIgnored(entry) {
    return ignoredNames.has(entry.name) || (!entry.isDirectory() && DEFAULT_IGNORED_FILES.has(entry.name.toLowerCase()));
  }

  function isSearchableFile(filePath) {
    return isWithinSearchRoots(filePath) && isDataFile(filePath) && !DEFAULT_IGNORED_FILES.has(path.basename(filePath).toLowerCase());
  }

  async function listDirectory(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      if (isIgnored(entry)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) results.push({ name: entry.name, path: toRelative(fullPath), type: 'directory', children: await listDirectory(fullPath) });
      else if (entry.isFile() && isSearchableFile(fullPath)) results.push({ name: entry.name, path: toRelative(fullPath), type: 'file' });
    }
    return results.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }

  async function listFiles() {
    if (dataRoots.length === 1 && dataRoots[0] === '.') return listDirectory(projectRoot);
    const roots = [];
    for (const searchRoot of searchRoots) {
      const stat = await fs.stat(searchRoot);
      if (!stat.isDirectory()) throw new Error(`Data root is not a directory: ${toRelative(searchRoot)}`);
      roots.push({ name: path.basename(searchRoot), path: toRelative(searchRoot), type: 'directory', children: await listDirectory(searchRoot) });
    }
    return roots;
  }

  async function readFile(relativePath) {
    const fullPath = resolvePath(relativePath);
    if (!isSearchableFile(fullPath)) throw new Error(`Only selected ${[...allowedExtensions].join(' and ')} data files are available`);
    return { path: toRelative(fullPath), content: await fs.readFile(fullPath, 'utf8') };
  }

  function findMatches(content, query) {
    const needle = query.toLocaleLowerCase();
    return content.split(/\r?\n/).flatMap((line, index) => {
      const column = line.toLocaleLowerCase().indexOf(needle);
      return column === -1 ? [] : [{ line: index + 1, column: column + 1, preview: line.trim().slice(0, 180) }];
    });
  }

  async function searchDirectory(directory, query) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      if (isIgnored(entry)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) results.push(...await searchDirectory(fullPath, query));
      else if (entry.isFile() && isSearchableFile(fullPath)) {
        const matches = findMatches(await fs.readFile(fullPath, 'utf8'), query);
        if (matches.length) results.push({ path: toRelative(fullPath), matches });
      }
    }
    return results;
  }

  async function search(query) {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) return [];
    const results = await Promise.all(searchRoots.map(searchRoot => searchDirectory(searchRoot, cleanQuery)));
    return results.flat();
  }

  return { listFiles, readFile, search, resolvePath, isDataFile };
}

module.exports = { createDataExplorer };
