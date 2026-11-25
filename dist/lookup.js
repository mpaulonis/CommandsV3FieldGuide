const filter = document.querySelector('#method');
const lookup = filter.closest('.lookup');
const status = lookup.querySelector('[role="status"]');
const contents = document.querySelector('.contents');
const groups = Array.from(document.querySelectorAll('article > h2'), (heading) => {
  const list = heading.nextElementSibling;
  const jumpLink = contents.querySelector(`a[href="#${heading.id}"]`).closest('li');
  const entries = Array.from(list.children, (row) => {
    const methods = Array.from(row.querySelectorAll('strong code'), (code) => code.textContent.toLowerCase());
    const [name] = methods;
    // Controller entries list methods under the wrapper's class name.
    if (lookup.dataset.version === 'v3' && methods.length === 1 && /^command[a-z0-9]+$/.test(name)) {
      for (const code of row.querySelectorAll('code')) {
        const method = code.textContent;
        if (method.toLowerCase() !== name && /^[a-z]\w*$/i.test(method)) {
          methods.push(`${name}.${method.toLowerCase()}`);
        }
      }
    }
    return { row, methods };
  });
  return { heading, list, jumpLink, entries };
});

function updateLookup() {
  const parts = filter.value.trim().replace(/\(.*$/, '').toLowerCase().split('.');
  const query = parts.slice(lookup.dataset.version === 'v3' ? -2 : -1).join('.');
  let total = 0;
  for (const { heading, list, jumpLink, entries } of groups) {
    let count = 0;
    for (const { row, methods } of entries) {
      const match = methods.some((method) => method.includes(query));
      row.hidden = !match;
      count += Number(match);
    }
    heading.hidden = list.hidden = jumpLink.hidden = count === 0;
    total += count;
  }
  contents.hidden = total === 0;
  status.textContent = query ? `${total} matching ${total === 1 ? 'entry' : 'entries'}` : '';
}

lookup.hidden = false;
filter.addEventListener('input', updateLookup);
updateLookup();
