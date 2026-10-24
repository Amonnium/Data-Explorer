const tree = document.querySelector('#file-tree');
const search = document.querySelector('#search');
const results = document.querySelector('#results');
const viewer = document.querySelector('#viewer');
const content = document.querySelector('#content');
const fileName = document.querySelector('#file-name');
const matchInfo = document.querySelector('#match-info');

async function api(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load data.');
  return data;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function drawTree(items, parent = tree) {
  parent.innerHTML = '';
  items.forEach(item => {
    if (item.type === 'directory') {
      const label = document.createElement('div');
      label.className = 'folder';
      label.textContent = `▾ ${item.name}`;
      parent.append(label);
      const children = document.createElement('div');
      children.className = 'tree-children';
      parent.append(children);
      drawTree(item.children, children);
      return;
    }
    const button = document.createElement('button');
    button.className = 'file';
    button.dataset.path = item.path;
    button.innerHTML = `<span>◫</span>${item.name}`;
    button.onclick = () => openFile(item.path);
    parent.append(button);
  });
}

async function loadTree() {
  try {
    drawTree(await api('/api/files'));
  } catch (error) {
    tree.textContent = error.message;
  }
}

function selectFile(path) {
  document.querySelectorAll('.file').forEach(element => element.classList.toggle('selected', element.dataset.path === path));
}

async function openFile(path, line = 0, query = '') {
  try {
    const data = await api(`/api/file?path=${encodeURIComponent(path)}`);
    selectFile(path);
    fileName.textContent = path;
    matchInfo.textContent = line ? `Line ${line}` : '';
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let html = escapeHtml(data.content);
    if (query) html = html.replace(new RegExp(safeQuery, 'gi'), hit => `<mark>${hit}</mark>`);
    if (line) {
      const lines = html.split(/\r?\n/);
      lines[line - 1] = `<span class="line-highlight">${lines[line - 1]}</span>`;
      html = lines.join('\n');
    }
    content.innerHTML = html;
    viewer.classList.remove('hidden');
    viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    content.querySelector('.line-highlight')?.scrollIntoView({ block: 'center' });
  } catch (error) {
    alert(error.message);
  }
}

function renderResults(files, query) {
  const count = files.reduce((total, file) => total + file.matches.length, 0);
  if (!count) {
    results.className = 'results empty';
    results.innerHTML = `<div class="empty-icon">⌕</div><h1>No results</h1><p>No key or value contains “${escapeHtml(query)}”.</p>`;
    return;
  }
  results.className = 'results';
  results.innerHTML = `<p class="result-summary">${count} result${count === 1 ? '' : 's'} in ${files.length} file${files.length === 1 ? '' : 's'}</p>`;
  files.forEach(file => file.matches.forEach(match => {
    const button = document.createElement('button');
    button.className = 'result';
    button.innerHTML = `<span class="result-path">${escapeHtml(file.path)} · line ${match.line}</span><span class="result-preview">${escapeHtml(match.preview)}</span>`;
    button.onclick = () => openFile(file.path, match.line, query);
    results.append(button);
  }));
}

async function runSearch() {
  const query = search.value.trim();
  viewer.classList.add('hidden');
  if (!query) {
    results.className = 'results empty';
    results.innerHTML = '<div class="empty-icon">⌕</div><h1>Explore your data</h1><p>Search for a key, value, or text in this project\'s JSON and XML data files.</p>';
    return;
  }
  results.className = 'results';
  results.innerHTML = '<p class="result-summary">Searching…</p>';
  try {
    renderResults(await api(`/api/search?q=${encodeURIComponent(query)}`), query);
  } catch (error) {
    results.innerHTML = `<p class="result-summary">${escapeHtml(error.message)}</p>`;
  }
}

document.querySelector('#refresh').onclick = loadTree;
search.addEventListener('keydown', event => { if (event.key === 'Enter') runSearch(); });
document.querySelectorAll('.theme-button').forEach(button => {
  button.onclick = () => {
    const theme = button.dataset.theme;
    document.documentElement.dataset.theme = theme === 'system' ? '' : theme;
    document.querySelectorAll('.theme-button').forEach(other => other.classList.toggle('active', other === button));
    localStorage.setItem('data-explorer-theme', theme);
  };
});

const savedTheme = localStorage.getItem('data-explorer-theme');
if (savedTheme) document.querySelector(`.theme-button[data-theme="${savedTheme}"]`).click();
loadTree();
