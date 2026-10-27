import './admin-workspace.css';
export interface AdminWorkspace { destroy(): void; }
export function mountAdminWorkspace(): AdminWorkspace | null {
  const root = document.getElementById('superadmin-content');
  const original = root?.firstElementChild as HTMLElement | null;
  const kyc = document.getElementById('sa-kyc-list')?.parentElement;
  const liq = document.getElementById('sa-liq-pending')?.parentElement?.parentElement;
  const people = document.getElementById('sa-people-panel');
  const tokens = document.getElementById('sa-token-form')?.parentElement;
  if (!root || !original || !kyc || !liq || !people || !tokens || ![kyc, liq, people, tokens].every(n => original.contains(n))) {
    console.error('[AdminWorkspace] Unexpected structure; original view retained.');
    return null;
  }
  const definitions = [
    ['resumen', 'Resumen', 'Accesos a las funciones existentes. Sin indicadores comerciales no verificados.'],
    ['kyc', 'Verificaciones KYC', 'Cola de revisión y controles existentes.'],
    ['liquidaciones', 'Liquidaciones B2B', 'Pendientes, retenciones e historial. Se conserva el desembolso manual.'],
    ['equipo', 'Scouts y hosters', 'Alta y gestión del equipo.'],
    ['inversion', 'Accesos de inversión', 'Emisión y gestión de tokens existentes.']
  ] as const;
  const shell = document.createElement('div');
  shell.className = 'ronda-admin-workspace';
  const sidebar = document.createElement('aside');
  sidebar.className = 'raw-sidebar';
  sidebar.innerHTML = '<div class="raw-brand">RONDA</div><p>Administración central</p>';
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Secciones de administración');
  sidebar.append(nav);
  const main = document.createElement('div');
  main.className = 'raw-main';
  const title = document.createElement('h2');
  title.className = 'raw-title';
  title.tabIndex = -1;
  const description = document.createElement('p');
  main.append(title, description);
  const panels = new Map<string, HTMLElement>();
  const buttons = new Map<string, HTMLButtonElement>();
  for (const [id, label] of definitions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.section = id;
    button.setAttribute('aria-controls', 'raw-panel-' + id);
    nav.append(button); buttons.set(id, button);
    const panel = document.createElement('section');
    panel.id = 'raw-panel-' + id;
    panel.setAttribute('aria-label', label);
    panel.className = 'raw-panel';
    panels.set(id, panel); main.append(panel);
  }
  const overview = panels.get('resumen')!;
  overview.innerHTML = '<div class="raw-notice">Esta vista conserva las operaciones del controlador actual. No añade servicios, permisos o validaciones de backend.</div>';
  const cards = document.createElement('div');
  cards.className = 'raw-cards'; overview.append(cards);
  for (const [id, label, detail] of definitions.slice(1)) {
    const card = document.createElement('article');
    const heading = document.createElement('h3'); heading.textContent = label;
    const text = document.createElement('p'); text.textContent = detail;
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.section = id; button.textContent = 'Abrir sección →';
    card.append(heading, text, button); cards.append(card);
  }
  const moved: Array<{ node: HTMLElement; marker: Comment; display: string }> = [];
  function move(node: HTMLElement, destination: HTMLElement) {
    const marker = document.createComment('admin-workspace-position');
    node.before(marker); moved.push({ node, marker, display: node.style.display });
    destination.append(node);
  }
  move(people, panels.get('equipo')!);
  move(tokens, panels.get('inversion')!);
  move(kyc, panels.get('kyc')!);
  move(liq, panels.get('liquidaciones')!);
  people.style.display = 'block';
  const toggle = document.getElementById('sa-people-toggle');
  const previousToggle = toggle?.hidden;
  if (toggle) toggle.hidden = true;
  for (const id of ['sa-payout-overlay', 'sa-reverse-overlay']) {
    const overlay = document.getElementById(id);
    if (overlay && original.contains(overlay)) move(overlay, root);
  }
  const previousDisplay = original.style.display;
  original.style.display = 'none';
  shell.append(sidebar, main); root.append(shell);
  const wrap = root.closest('.wrap');
  const hadWrapClass = wrap?.classList.contains('raw-wrap');
  wrap?.classList.add('raw-wrap');
  function activate(id: string, focus = true) {
    const definition = definitions.find(item => item[0] === id);
    if (!definition) return;
    for (const [key, panel] of panels) panel.hidden = key !== id;
    for (const [key, button] of buttons) {
      if (key === id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    title.textContent = definition[1]; description.textContent = definition[2];
    if (focus) title.focus({ preventScroll: true });
  }
  const abort = new AbortController();
  shell.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button[data-section]');
    if (button && shell.contains(button)) activate(button.dataset.section || '');
  }, { signal: abort.signal });
  activate('resumen', false);
  let destroyed = false;
  return { destroy() {
    if (destroyed) return; destroyed = true; abort.abort();
    for (const { node, marker, display } of moved.reverse()) {
      if (marker.parentNode) marker.replaceWith(node);
      node.style.display = display;
    }
    if (toggle) toggle.hidden = previousToggle ?? false;
    shell.remove(); original.style.display = previousDisplay;
    if (!hadWrapClass) wrap?.classList.remove('raw-wrap');
  } };
}
