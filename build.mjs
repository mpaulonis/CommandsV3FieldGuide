import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const exampleTopics = [
  'examples-sensor-waits',
  'examples-operator-controls',
  'examples-command-groups',
  'examples-advanced',
].map((source) => ({ file: source + '.html', source, exampleTopic: true }));

const pages = [
  { file: 'index.html', source: 'home' },
  { file: 'coroutines.html', source: 'coroutines', label: 'Learn', lesson: 'Run a coroutine' },
  { file: 'intake.html', source: 'lesson', lesson: 'Translate an intake command' },
  { file: 'ownership.html', source: 'ownership', lesson: 'Coordinate mechanisms' },
  { file: 'changes.html', source: 'changes', label: 'Migration' },
  { file: 'examples.html', source: 'examples', label: 'Examples' },
  ...exampleTopics,
  { file: 'reference.html', source: 'reference', label: 'v2 lookup', lookup: 'v2' },
  { file: 'v3-reference.html', source: 'v3-reference', label: 'v3 lookup', lookup: 'v3' },
];
const lessons = pages.filter(({ lesson }) => lesson);

const read = (path) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const headingId = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');

function emphasis(text) {
  return text
    .replace(/(?<!\\)\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![\\*])\*(?![\s*])([^*\n]+?)(?<![\\\s])\*(?!\*)/g, '<em>$1</em>')
    .replace(/(?<![\w\\])_(?![\s_])([^_\n]+?)(?<![\\\s])_(?!\w)/g, '<em>$1</em>')
    .replace(/\\([*_])/g, '$1');
}

function inline(line) {
  // Preserve code spans and link destinations while processing emphasis.
  const fragments = [];
  const keep = (html) => '\0' + (fragments.push(html) - 1) + '\0';
  const restore = (text) => text.replace(/\0(\d+)\0/g, (_, index) => fragments[index]);
  const text = escape(line).replace(/\x60([^\x60]+)\x60/g, (_, code) => keep('<code>' + code + '</code>'));
  const linked = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s<>()\0]+|[a-z#][a-zA-Z0-9/.#_-]+)\)/g,
    (_, label, href) => {
      const linkText = restore(emphasis(label));
      if (!/^https?:\/\//.test(href)) return keep('<a href="' + href + '">' + linkText + '</a>');
      const wpilib = /^https?:\/\/docs\.wpilib\.org\//.test(href);
      return keep('<a href="' + href + '"' + (wpilib ? ' class="wpilib-link"' : '') +
        ' target="_blank" rel="noopener">' + linkText +
        ' <span class="external-link-icon" aria-hidden="true">↗</span>' +
        '<span class="visually-hidden"> (opens in a new tab)</span></a>');
    });
  return restore(emphasis(linked));
}

const highlightTypes = { 'Key idea': 'idea', 'Watch for': 'warning', 'WPILib docs': 'docs' };

function renderHighlight(block) {
  const [heading, ...lines] = block.split('\n');
  const label = heading.slice(4, -2);
  const type = highlightTypes[label];
  if (!type || !lines.length || lines.some((line) => !line.startsWith('> '))) {
    throw new Error('Invalid highlight: ' + heading);
  }
  const content = lines.map((line) => line.slice(2));
  const body = type === 'docs'
    ? '<ul>' + content.map((row) => '<li>' + inline(row) + '</li>').join('') + '</ul>'
    : '<p>' + inline(content.join(' ')) + '</p>';
  return '<div class="highlight highlight-' + type + '"><p class="highlight-label">' + label + '</p>' + body + '</div>';
}

function codeBlock(block) {
  const lines = block.split('\n');
  const caption = lines.shift().slice(3).split(' ').slice(1).join(' ');
  if (lines.pop() !== '\x60\x60\x60') throw new Error('Unterminated code block');
  const body = lines.join('\n');
  return '<figure><figcaption>' + escape(caption) + '</figcaption><pre tabindex="0"><code>' +
    escape(body) + '</code></pre></figure>';
}

function renderTable(block) {
  const rows = block.split('\n').map((line) =>
    line.slice(1, -1).split('|').map((cell) => inline(cell.trim())));
  const [head, , ...body] = rows;
  const headings = head.map((cell) => '<th scope="col">' + cell + '</th>').join('');
  const entries = body.map(([label, ...cells]) => '<tr><th scope="row">' + label + '</th>' +
    cells.map((cell) => '<td>' + cell + '</td>').join('') + '</tr>').join('');
  return '<table><thead><tr>' + headings + '</tr></thead><tbody>' + entries +
    '</tbody></table>';
}

function render(markdown, headings) {
  const blocks = markdown.trim().split(/((?:^\x60\x60\x60[^\n]*\n[\s\S]*?^\x60\x60\x60$\n?)+)/m)
    .flatMap((part, index) => index % 2
      ? [part.trim()]
      : part.trim().split(/\n\s*\n/).filter(Boolean));
  return blocks.map((block) => {
    if (block.startsWith('\x60\x60\x60')) {
      return '<div class="examples">' +
        block.split(/(?<=\n\x60\x60\x60)\n(?=\x60\x60\x60)/).map(codeBlock).join('') + '</div>';
    }
    const heading = block.match(/^(#{2,3}) (.+?)(?: \{#([a-z0-9-]+)\})?$/);
    if (heading) {
      const [, marks, label, explicitId] = heading;
      const level = marks.length;
      const id = explicitId ?? headingId(label);
      headings.push({ level, label, id });
      return '<h' + level + ' id="' + id + '">' + inline(label) + '</h' + level + '>';
    }
    if (block.startsWith('> **')) return renderHighlight(block);
    if (block.startsWith('| ')) return renderTable(block);
    const list = block.startsWith('- ') ? 'ul' : block.startsWith('1. ') ? 'ol' : '';
    if (list) {
      const items = block.split('\n').map((line) =>
        '<li>' + inline(line.replace(/^(?:-|\d+\.) /, '')) + '</li>');
      return '<' + list + '>' + items.join('') + '</' + list + '>';
    }
    return '<p>' + inline(block) + '</p>';
  }).join('\n');
}

function contents(headings) {
  if (!headings.length) return '';
  const sections = [];
  for (const heading of headings) {
    if (heading.level === 2) sections.push({ ...heading, children: [] });
    else sections.at(-1).children.push(heading);
  }
  const item = ({ id, label, children }) => '<li><a href="#' + id + '">' + inline(label) +
    '</a>' + (children?.length ? '<ul>' + children.map(item).join('') + '</ul>' : '') + '</li>';
  return '<nav class="contents" aria-labelledby="contents-title"><div id="contents-title">On this page</div>' +
    '<ul>' + sections.map(item).join('') + '</ul></nav>';
}

function lessonActions(page, index) {
  if (!page.lesson) return '';
  const action = (file, label, title) => '<a href="' + file + '"><span>' + label +
    '</span><strong>' + escape(title) + '</strong></a>';
  const previous = lessons[index - 1];
  const next = lessons[index + 1];
  return '<nav class="lesson-actions" aria-label="Continue learning">' +
    (previous ? action(previous.file, 'Previous lesson', previous.lesson) : '') +
    (next ? action(next.file, 'Next lesson', next.lesson) : action('examples.html', 'Apply what you learned', 'Browse worked examples')) +
    '</nav>';
}

function renderPage(page) {
  const [heading, ...body] = read('content/' + page.source + '.md').split('\n');
  const title = escape(heading.slice(2));
  const [, intro, content] = body.join('\n').trim().match(/^([\s\S]+?)\n\s*\n([\s\S]+)$/);
  const headings = [];
  const article = page.source === 'home'
    ? content.split(/\n(?=## )/).map((section) => '<section>' + render(section, headings) + '</section>').join('')
    : render(content, headings);
  return { title, intro, headings, article };
}

function exampleIndex(renderedPages) {
  return exampleTopics.map(({ file }) => {
    const { title, intro, headings } = renderedPages.get(file);
    const links = headings.filter(({ level }) => level === 2).map(({ id, label }) =>
      '<li id="' + id + '"><a href="' + file + '#' + id + '">' + inline(label) + '</a></li>').join('');
    return '<section class="example-topic-card" id="' + headingId(title) + '">' +
      '<h2><a href="' + file + '">' + title + '</a></h2><p>' + inline(intro) + '</p><ul>' + links + '</ul></section>';
  }).join('');
}

function html(page, renderedPages) {
  const { title, intro, headings, article } = renderedPages.get(page.file);
  const lessonIndex = lessons.indexOf(page);
  const home = page.source === 'home';
  const examples = page.source === 'examples';
  const lookupFilter = page.lookup ? '<div class="lookup" data-version="' + page.lookup +
    '" hidden><label for="method">Filter by ' + (page.lookup === 'v3' ? 'v3 method or class' : 'v2 method name') + '</label>' +
    '<input type="search" id="method" placeholder="' + (page.lookup === 'v3' ? 'e.g. Coroutine.await' : 'e.g. ProxyCommand') + '" spellcheck="false" autocomplete="off">' +
    '<p role="status"></p></div>' : '';
  const link = (file, label, active = false) =>
    '<a href="' + file + '"' + (file === page.file ? ' aria-current="page"' :
      active ? ' aria-current="location"' : '') + '>' + escape(label) + '</a>';
  const navigation = pages.filter(({ label }) => label)
    .map(({ file, label }) => link(file, label, (file === 'coroutines.html' && page.lesson) ||
      (file === 'examples.html' && page.exampleTopic)))
    .join('');
  const readingLayout = '<div class="reading-layout' + (page.exampleTopic ? ' example-reading-layout' : '') + '">' +
    contents(headings) + '<article class="' + page.source + '">' + article + lessonActions(page, lessonIndex) +
    (page.exampleTopic ? '<p class="example-back"><a href="examples.html">Browse all examples</a></p>' : '') +
    '</article></div>';
  const lessonNavigation = page.lesson
    ? '<nav class="lesson-nav" aria-label="Learning path"><ol>' +
      lessons.map(({ file, lesson }, index) => '<li>' + link(file, (index + 1) + '. ' + lesson) + '</li>').join('') +
      '</ol></nav>'
    : '';
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="description" content="A Commands v3 field guide with worked Java examples for FRC students who know Commands v2.">' +
    '<title>' + title + (page.file === 'index.html' ? '' : ' | Commands v3 Field Guide') + '</title>' +
    '<link rel="stylesheet" href="style.css">' + (page.lookup ? '<script src="lookup.js" defer></script>' : '') +
    '</head><body>' +
    '<a class="skip" href="#main">Skip to content</a>' +
    '<header><div class="frame"><a class="brand" href="index.html"' + (home ? ' aria-current="page"' : '') +
    '>Commands v3 <span>Field Guide</span></a>' +
    '<nav class="site-nav" aria-label="Guide">' + navigation + '</nav></div></header>' +
    '<main class="frame' + (examples || page.exampleTopic ? ' examples-frame' : '') + '" id="main" tabindex="-1"><div class="hero">' +
    (page.exampleTopic ? '<p class="section"><a href="examples.html">All examples</a></p>' : '') +
    (page.lesson ? '<p class="section">Lesson ' + (lessonIndex + 1) + ' of ' + lessons.length + '</p>' : '') +
    '<h1>' + title + '</h1><p class="intro">' + inline(intro) + '</p>' + lookupFilter + '</div>' +
    lessonNavigation + (home ? '<div class="home-paths">' + article + '</div>' :
      examples ? '<div class="example-index">' + exampleIndex(renderedPages) + article + '</div>' : readingLayout) + '</main>' +
    '<footer><div class="frame">FRC Java · WPILib 2027 Alpha 8</div></footer></body></html>\n';
}

mkdirSync('dist', { recursive: true });
const renderedPages = new Map(pages.map((page) => [page.file, renderPage(page)]));
for (const page of pages) writeFileSync('dist/' + page.file, html(page, renderedPages));
copyFileSync('style.css', 'dist/style.css');
copyFileSync('lookup.js', 'dist/lookup.js');
