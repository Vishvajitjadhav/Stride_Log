// Task statuses in board order, and one look per status used everywhere.
// Colour is never the only signal: every status also shows its label.
//   badge: soft pill   card: tinted card surface   dot: small marker
//   text:  coloured label   hex: PDF and charts (no CSS variables there)
export const STATUSES = ['pending', 'in_progress', 'in_review', 'done', 'blocked']

export const STATUS_LABELS = {
  pending: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
  blocked: 'Blocked',
}

export const STATUS_STYLE = {
  pending:     { badge: 'bg-gray-50 text-gray-600 ring-gray-200',    card: 'bg-surface border-gray-200', dot: 'bg-gray-300',  text: 'text-gray-600',  hex: '#475569' },
  in_progress: { badge: 'bg-amber-50 text-amber-800 ring-amber-200', card: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', text: 'text-amber-800', hex: '#b45309' },
  in_review:   { badge: 'bg-sky-50 text-sky-800 ring-sky-200',       card: 'bg-sky-50 border-sky-200',     dot: 'bg-sky-500',   text: 'text-sky-800',   hex: '#0369a1' },
  done:        { badge: 'bg-mint-50 text-mint-700 ring-mint-200',    card: 'bg-mint-50 border-mint-200',   dot: 'bg-mint-500',  text: 'text-mint-700',  hex: '#166534' },
  blocked:     { badge: 'bg-red-50 text-red-700 ring-red-200',       card: 'bg-red-50 border-red-200',     dot: 'bg-red-600',   text: 'text-red-700',   hex: '#b91c1c' },
}

export const statusStyle = status => STATUS_STYLE[status] ?? STATUS_STYLE.pending
