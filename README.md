# Data Explorer

A small, local browser UI and a UI-independent Node.js engine for safely exploring and searching JSON and XML data in a project.

## Install in a project

This package is a project dependency: it does not install anything globally on your computer.

From a project that should use the engine, install it from GitHub:

```bash
npm install --save github:Amonnium/Data-Explorer
```

After the package is published to npm, the equivalent project-local installation will be:

```bash
npm install --save @amonnium/data-explorer
```

## Use the engine in any frontend or API

The engine has no dependency on this browser UI, HTTP, or a framework. Connect it to any Node.js backend, desktop app, CLI, or frontend API.

```js
const { createDataExplorer } = require('@amonnium/data-explorer');

const explorer = createDataExplorer({
  root: process.cwd(),
  dataRoots: ['data', 'fixtures'],
  extensions: ['.json', '.xml']
});

const files = await explorer.listFiles();
const results = await explorer.search('New York');
const file = await explorer.readFile('data/customers.json');
```

Use `dataRoots` to explicitly opt in to the folders that contain data. This prevents configuration and application files elsewhere in the project from being indexed. If it is omitted, the project root is scanned but common project metadata such as `package.json`, lock files, TypeScript configuration, and XML build configuration is excluded.

## Run the included browser UI

Clone this repository, then run:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000). The included interface scans this repository's selected data files and is intended as a ready-to-use local example.

## API

`createDataExplorer(options)` returns:

- `listFiles()` — a tree of selected JSON and XML data files.
- `search(query)` — case-insensitive text matches with file paths, line numbers, columns, and previews.
- `readFile(relativePath)` — safely reads one selected data file.

The engine keeps all file access within `root` and ignores `node_modules`, `.git`, and `public` by default.
