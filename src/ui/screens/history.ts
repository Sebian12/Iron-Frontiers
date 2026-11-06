import { div, icon, panel, span, tag } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';
import { pct } from '../format';

// Persistent political record. This screen is deliberately read-only: it is the country's archive,
// not another lever of power, and entries survive every transition because they live in GameState.

const TYPE_LABEL: Record<string, string> = {
  system: 'Constitution',
  election: 'Election',
  reform: 'Reform',
  revolution: 'Revolution',
  coup: 'Coup',
  crisis: 'Crisis',
  focus: 'Focus',
  war: 'War',
};

const TYPE_COLOR: Record<string, 'gold' | 'blue' | 'green' | 'red' | 'grey'> = {
  system: 'gold',
  election: 'blue',
  reform: 'green',
  revolution: 'red',
  coup: 'red',
  crisis: 'gold',
  focus: 'blue',
  war: 'red',
};

export function mountHistory(ctx: ScreenContext): Screen {
  const { state } = ctx;
  const system = state.politicalSystem;
  const badge = tag(`${state.politicalHistory.length} entries`, 'gold');
  const frame = screenFrame('scroll', 'Political History', `${state.country.name} · constitutions, leaders and turning points`, [badge]);
  const grid = div('if-history-layout');

  const summary = panel('The Present Order', system?.icon ?? 'gov');
  const summaryBody = div('if-history-summary');
  summaryBody.append(
    div('if-history-summary__system', system?.name ?? 'Unclassified government'),
    div('if-muted', system?.description ?? ''),
    div('if-kv', span('if-kv__label', 'Head of state'), span('if-kv__value', `${state.political.leaderName} · ${state.political.leaderTitle}`)),
    div('if-kv', span('if-kv__label', 'Ideology'), span('if-kv__value', state.political.ideology)),
    div('if-kv', span('if-kv__label', 'Legitimacy'), span('if-kv__value', pct(state.political.legitimacy))),
    div('if-kv', span('if-kv__label', 'Political tension'), span('if-kv__value', `${Math.round(state.political.tension)} / 100`)),
    div('if-kv', span('if-kv__label', 'Revolutionary support'), span('if-kv__value', `${Math.round(state.political.revolutionSupport)} / 100`)),
    div('if-kv', span('if-kv__label', 'Completed political focuses'), span('if-kv__value', `${state.treeFocuses.filter((focus) => focus.branch && state.completedFocuses.has(focus.id)).length}`)),
  );
  summary.body.append(summaryBody);

  const systems = new Set(state.politicalHistory.filter((entry) => entry.type === 'system').map((entry) => entry.title));
  const leaders = new Set(state.politicalHistory.map((entry) => entry.leader).filter(Boolean));
  const archive = panel('Archive', 'book');
  archive.body.append(
    div('if-kv', span('if-kv__label', 'Constitutional settlements'), span('if-kv__value', String(systems.size))),
    div('if-kv', span('if-kv__label', 'Leaders recorded'), span('if-kv__value', String(leaders.size))),
    div('if-hint', 'Every entry is written when the event happens and is preserved through save and load.'),
  );

  const timeline = panel('Timeline', 'scroll');
  const list = div('if-history-timeline');
  if (state.politicalHistory.length === 0) {
    list.append(div('if-empty', 'No political developments recorded yet.'));
  }
  for (const entry of state.politicalHistory) {
    const row = div(`if-history-entry if-history-entry--${entry.type}`);
    const marker = div('if-history-entry__marker');
    marker.append(icon(entry.icon, 'if-ico'));
    const body = div('if-history-entry__body');
    const head = div('if-history-entry__head');
    head.append(
      span('if-history-entry__date', entry.date),
      tag(TYPE_LABEL[entry.type] ?? entry.type, TYPE_COLOR[entry.type] ?? 'grey'),
      span('if-history-entry__title', entry.title),
    );
    body.append(head, div('if-history-entry__text', entry.description));
    if (entry.leader) body.append(div('if-history-entry__meta', `${entry.leader} · ${entry.systemId?.replace(/_/g, ' ') ?? ''}`));
    row.append(marker, body);
    list.append(row);
  }
  timeline.body.append(list);

  grid.append(summary.element, archive.element, timeline.element);
  frame.body.append(grid);
  return { element: frame.element };
}
