import { Document, Page, View, Text, Image, Svg, Rect, Path, Circle, StyleSheet, Font } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import { ROLE_LABELS } from '../../lib/permissions'
import { STATUS_LABELS } from '../../lib/labels'
import { GLOSSARY } from '../../lib/glossary'

// Don't hyphenate normal words (no dashes in reports). Very long strings such
// as links are still cut into pieces, otherwise react-pdf cannot lay them out.
Font.registerHyphenationCallback(word =>
  word.length <= 18 ? [word] : word.match(/.{1,12}/g))

// Built-in Helvetica covers WinAnsi only; stick to plain characters.
const NAVY = '#1d3254'
const NAVY_2 = '#2f4e7e'
const GOLD = '#c9a43f'
const INK = '#0f172a'
const BODY = '#334155'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const SOFT = '#f5f7fa'
const STATUS_COLOR = { done: '#166534', in_progress: '#92400e', blocked: '#b91c1c', pending: '#475569' }

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9, color: BODY },
  band: { backgroundColor: NAVY, marginTop: -40, marginHorizontal: -40, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 22, marginBottom: 18 },
  bandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 34, height: 34, objectFit: 'contain', marginRight: 10, backgroundColor: '#ffffff', borderRadius: 6 },
  company: { fontSize: 13, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  companySub: { fontSize: 8, color: '#c8d4e6', marginTop: 2 },
  reportTitle: { fontSize: 18, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 18 },
  reportRange: { fontSize: 10.5, lineHeight: 1.3, color: '#e4eaf3', marginTop: 4 },
  goldRule: { height: 2, width: 36, backgroundColor: GOLD, marginTop: 10 },
  meta: { flexDirection: 'row', borderWidth: 1, borderColor: LINE, borderRadius: 4, marginBottom: 6 },
  metaCell: { flex: 1, paddingVertical: 7, paddingHorizontal: 9, borderRightWidth: 1, borderRightColor: LINE },
  metaLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 9, color: INK, marginTop: 2, fontFamily: 'Helvetica-Bold' },
  h2: { fontSize: 11.5, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 20, marginBottom: 3 },
  hint: { fontSize: 8, color: MUTED, marginBottom: 8 },
  kpis: { flexDirection: 'row', marginHorizontal: -4 },
  kpi: { flex: 1, marginHorizontal: 4, borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 9 },
  kpiLabel: { fontSize: 8, color: MUTED },
  kpiValue: { fontSize: 18, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 4 },
  kpiOf: { fontSize: 9, color: MUTED, fontFamily: 'Helvetica' },
  kpiChange: { fontSize: 7.5, lineHeight: 1.3, marginTop: 4 },
  kpiMeaning: { fontSize: 7.5, lineHeight: 1.35, color: MUTED, marginTop: 4 },
  bulletRow: { flexDirection: 'row', marginBottom: 4 },
  bullet: { width: 4, height: 4, backgroundColor: GOLD, borderRadius: 2, marginTop: 4, marginRight: 8 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  th: { flexDirection: 'row', backgroundColor: SOFT, borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 6, paddingHorizontal: 8 },
  thText: { fontSize: 7.5, color: MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eef1f5', paddingVertical: 5.5, paddingHorizontal: 8 },
  td: { fontSize: 8.5, color: BODY },
  personHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 6, marginBottom: 10 },
  personName: { fontSize: 14, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: INK },
  personSub: { fontSize: 8.5, color: MUTED, marginTop: 2 },
  mini: { flexDirection: 'row', marginBottom: 12, marginHorizontal: -3 },
  miniCell: { flex: 1, marginHorizontal: 3, backgroundColor: SOFT, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 },
  miniLabel: { fontSize: 7, color: MUTED },
  miniValue: { fontSize: 11, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 2 },
  dayRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: LINE },
  dayCell: { width: '19%', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: SOFT },
  dayName: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK },
  dayDate: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  dayState: { fontSize: 7, marginTop: 3, fontFamily: 'Helvetica-Bold' },
  taskRow: { flexDirection: 'row', paddingVertical: 4.5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f4f8' },
  note: { fontSize: 7.5, lineHeight: 1.4, color: BODY, paddingVertical: 4, paddingHorizontal: 8 },
  running: { position: 'absolute', top: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED },
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
  glossRow: { flexDirection: 'row', marginBottom: 5 },
  glossTerm: { width: 110, fontSize: 8, fontFamily: 'Helvetica-Bold', color: INK },
  glossText: { flex: 1, fontSize: 8, lineHeight: 1.4, color: BODY },
})

const fmt = (iso, f = 'd MMM yyyy') => format(parseISO(iso), f)
const rangeText = r => `${fmt(r.from, r.from.slice(0, 4) === r.to.slice(0, 4) ? 'd MMM' : 'd MMM yyyy')} to ${fmt(r.to)}`
const stateColor = st => (st === 'Submitted' ? STATUS_COLOR.done : st === 'Not submitted' ? STATUS_COLOR.blocked : st === 'Extra day' ? '#8a6a1f' : MUTED)

function Mark({ size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={{ marginRight: 10 }}>
      <Rect width="512" height="512" rx="112" fill="#ffffff" fillOpacity={0.12} />
      <Path d="M128 348 H232" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={44} strokeLinecap="round" />
      <Path d="M196 264 H300" stroke="#ffffff" strokeOpacity={0.78} strokeWidth={44} strokeLinecap="round" />
      <Path d="M264 180 H316" stroke="#ffffff" strokeWidth={44} strokeLinecap="round" />
      <Circle cx="380" cy="180" r="34" fill={GOLD} />
    </Svg>
  )
}

function Change({ g, suffix = '', lowerIsBetter, periodName }) {
  if (!g) return null
  const d = g.delta
  const good = lowerIsBetter ? d < 0 : d > 0
  const color = d === 0 ? MUTED : good ? STATUS_COLOR.done : STATUS_COLOR.blocked
  const unit = suffix === '%' ? ' points' : ''
  const text = d === 0 ? `Same as last ${periodName}` : `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)}${unit} from last ${periodName}`
  return <Text style={[s.kpiChange, { color }]}>{text}</Text>
}

function Kpi({ metric, value, suffix = '', of, g, lowerIsBetter, periodName }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{GLOSSARY[metric].label}</Text>
      <Text style={s.kpiValue}>{value}{suffix}{of ? <Text style={s.kpiOf}>  {of}</Text> : null}</Text>
      <Change g={g} suffix={suffix} lowerIsBetter={lowerIsBetter} periodName={periodName} />
      <Text style={s.kpiMeaning}>{GLOSSARY[metric].short}</Text>
    </View>
  )
}

function Table({ cols, rows, zebra = false }) {
  return (
    <View style={s.table}>
      <View style={s.th}>
        {cols.map(c => <Text key={c.label} style={[s.thText, { width: c.w, textAlign: c.align ?? 'left' }]}>{c.label}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[s.tr, zebra && i % 2 ? { backgroundColor: '#fafbfc' } : null]} wrap={false}>
          {cols.map(c => (
            <Text key={c.label} style={[s.td, { width: c.w, textAlign: c.align ?? 'left' }, c.style?.(r)]}>{c.get(r)}</Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function CategoryBars({ data }) {
  const total = data.reduce((n, d) => n + d.count, 0)
  if (!total) return <Text style={{ color: MUTED }}>No tasks in this period.</Text>
  return data.slice(0, 8).map(c => {
    const pct = Math.round((c.count / total) * 100)
    return (
      <View key={c.name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ width: 95, fontSize: 8, color: BODY }}>{c.name}</Text>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: `${Math.max(pct, 1) * 0.8}%`, height: 6, backgroundColor: NAVY_2, borderRadius: 2 }} />
          <Text style={{ fontSize: 8, marginLeft: 5, color: INK }}>{pct}%  ({c.count})</Text>
        </View>
      </View>
    )
  })
}

// ── Detail sections ─────────────────────────────────────────────────────────
function PersonHeader({ p, data }) {
  return (
    <>
      <View style={s.personHead}>
        <View>
          <Text style={s.personName}>{p.name}</Text>
          <Text style={s.personSub}>{ROLE_LABELS[p.role] ?? p.role}{p.team ? `, ${p.team}` : ''}</Text>
        </View>
        <Text style={{ fontSize: 8.5, color: MUTED }}>{rangeText(data.range)}</Text>
      </View>
      <View style={s.mini}>
        {[
          ['Tasks completed', `${p.done} of ${p.planned}`],
          ['Completion rate', `${p.completionRate}%`],
          ['Daily logs submitted', `${p.loggedDays} of ${p.expectedDays} days`],
          ['Blocked tasks', String(p.blocked)],
          ['Extra days', String(p.extraDays)],
        ].map(([k, v]) => (
          <View key={k} style={s.miniCell}><Text style={s.miniLabel}>{k}</Text><Text style={s.miniValue}>{v}</Text></View>
        ))}
      </View>
    </>
  )
}

function WeeklyDetail({ p }) {
  return (
    <View style={s.table}>
      <View style={s.th}>
        <Text style={[s.thText, { width: '19%' }]}>Day</Text>
        <Text style={[s.thText, { width: '45%', paddingLeft: 8 }]}>Task</Text>
        <Text style={[s.thText, { width: '20%' }]}>Category</Text>
        <Text style={[s.thText, { width: '16%', textAlign: 'right' }]}>Status</Text>
      </View>
      {p.days.map(d => (
        <View key={d.date} style={s.dayRow} wrap={false}>
          <View style={s.dayCell}>
            <Text style={s.dayName}>{fmt(d.date, 'EEEE')}</Text>
            <Text style={s.dayDate}>{fmt(d.date, 'd MMM yyyy')}</Text>
            <Text style={[s.dayState, { color: stateColor(d.state) }]}>{d.state}</Text>
          </View>
          <View style={{ width: '81%' }}>
            {d.tasks.length === 0 && <Text style={[s.taskRow, { color: MUTED, fontSize: 8.5 }]}>No tasks logged</Text>}
            {d.tasks.map(t => (
              <View key={t.id} style={s.taskRow}>
                <View style={{ width: '55.5%', paddingRight: 6 }}>
                  <Text style={{ fontSize: 8.5, color: INK }}>{t.title}</Text>
                  {t.assignedBy && <Text style={{ fontSize: 7, color: MUTED, marginTop: 1 }}>Assigned by {t.assignedBy}</Text>}
                </View>
                <Text style={{ width: '24.7%', fontSize: 8, color: BODY }}>{t.category}</Text>
                <Text style={{ width: '19.8%', fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: STATUS_COLOR[t.status] }}>
                  {STATUS_LABELS[t.status]}
                </Text>
              </View>
            ))}
            {d.summary && <Text style={s.note}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Summary: </Text>{d.summary}</Text>}
            {d.blockers && <Text style={[s.note, { color: STATUS_COLOR.blocked }]}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Blocker: </Text>{d.blockers}</Text>}
          </View>
        </View>
      ))}
    </View>
  )
}

function MonthlyDetail({ p }) {
  return (
    <>
      <Table zebra rows={p.weeks} cols={[
        { label: 'Week', w: '30%', get: r => rangeText(r) },
        { label: 'Tasks done', w: '18%', align: 'right', get: r => `${r.done} of ${r.planned}` },
        { label: 'Completion', w: '16%', align: 'right', get: r => `${r.completionRate}%` },
        { label: 'Daily logs', w: '20%', align: 'right', get: r => `${r.loggedDays} of ${r.expectedDays}` },
        { label: 'Blocked', w: '16%', align: 'right', get: r => r.blocked },
      ]} />
      {p.open.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 4 }}>Unfinished at the end of the month</Text>
          {p.open.slice(0, 12).map((t, i) => (
            <View key={i} style={s.bulletRow}>
              <View style={s.bullet} />
              <Text style={{ flex: 1, fontSize: 8 }}>{t.title}  <Text style={{ color: MUTED }}>({STATUS_LABELS[t.status]}, planned {fmt(t.date, 'd MMM')})</Text></Text>
            </View>
          ))}
        </View>
      )}
    </>
  )
}

// Header (from page 2) and footer repeated on every page.
function Chrome({ data, company, title, footer }) {
  return (
    <>
      <View style={s.running} fixed render={({ pageNumber }) => (pageNumber > 1 ? (
        <>
          <Text>{company}  ·  {title}</Text>
          <Text>{data.scope.name}  ·  {rangeText(data.range)}</Text>
        </>
      ) : null)} />
      <View style={s.footer} fixed>
        <Text>{footer}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </>
  )
}

// ── Document ────────────────────────────────────────────────────────────────
export default function ReportDocument({ data }) {
  const { org, current: c, growth: g, periodName } = data
  const kindLabel = data.kind === 'weekly' ? 'Weekly' : 'Monthly'
  const company = org.company_name || 'StrideLog'
  const logoOk = org.logo_url && !/\.svg($|\?)/i.test(org.logo_url)
  const many = data.details.length > 1
  const footer = org.report_footer?.replace(/\s*[\u2013\u2014-]\s*/g, '. ') || 'Confidential. For internal use only.'
  const title = `${kindLabel} Productivity Report`

  return (
    <Document title={`${company} ${title}, ${data.scope.name}`} author={company} creator="StrideLog">
      <Page size="A4" style={s.page}>
        <Chrome data={data} company={company} title={title} footer={footer} />

        {/* Cover band */}
        <View style={s.band}>
          <View style={s.bandRow}>
            <View style={s.brand}>
              {logoOk ? <Image src={org.logo_url} style={s.logo} /> : <Mark />}
              <View>
                <Text style={s.company}>{company}</Text>
                <Text style={s.companySub}>Employee productivity</Text>
              </View>
            </View>
            <Text style={{ fontSize: 8, color: '#c8d4e6' }}>CONFIDENTIAL</Text>
          </View>
          <Text style={s.reportTitle}>{title}</Text>
          <Text style={s.reportRange}>{rangeText(data.range)}</Text>
          <View style={s.goldRule} />
        </View>

        <View style={s.meta}>
          {[
            ['Prepared for', data.scope.name],
            ['Prepared by', data.generatedBy ?? company],
            ['Generated on', format(data.generatedAt, 'd MMM yyyy, HH:mm')],
            ['Compared with', rangeText(data.prev)],
          ].map(([k, v], i, arr) => (
            <View key={k} style={[s.metaCell, i === arr.length - 1 ? { borderRightWidth: 0 } : null]}>
              <Text style={s.metaLabel}>{k}</Text>
              <Text style={s.metaValue}>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 7.5, color: MUTED }}>
          Working days are Monday to Friday, excluding company holidays{data.holidaysInRange.length ? ` (${data.holidaysInRange.map(h => `${h.name}, ${fmt(h.date, 'd MMM')}`).join('; ')})` : ''}.
        </Text>

        <Text style={s.h2}>Summary</Text>
        <Text style={s.hint}>Headline numbers for the period, compared with the previous {periodName}.</Text>
        <View style={s.kpis}>
          <Kpi metric="done" value={c.done} of={`of ${c.planned}`} g={g.done} periodName={periodName} />
          <Kpi metric="completionRate" value={c.completionRate} suffix="%" g={g.completionRate} periodName={periodName} />
          <Kpi metric="consistency" value={c.consistency} suffix="%" of={`${c.loggedDays} of ${c.expectedDays}`} g={g.consistency} periodName={periodName} />
          <Kpi metric="blocked" value={c.blocked} g={g.blocked} lowerIsBetter periodName={periodName} />
        </View>

        <Text style={s.h2}>Key observations</Text>
        <View style={{ marginTop: 4 }}>
          {data.observations.map((o, i) => (
            <View key={i} style={s.bulletRow}><View style={s.bullet} /><Text style={{ flex: 1, fontSize: 9 }}>{o}</Text></View>
          ))}
        </View>

        {many && (
          <>
            <Text style={s.h2}>Employee summary</Text>
            <Text style={s.hint}>One line per employee. Detailed {data.kind === 'weekly' ? 'day by day' : 'week by week'} pages follow.</Text>
            <Table zebra rows={data.persons} cols={[
              { label: 'Employee', w: '27%', get: r => r.name, style: () => ({ color: INK, fontFamily: 'Helvetica-Bold' }) },
              { label: 'Role', w: '17%', get: r => ROLE_LABELS[r.role] ?? r.role },
              { label: 'Tasks done', w: '14%', align: 'right', get: r => `${r.done} of ${r.planned}` },
              { label: 'Completion', w: '12%', align: 'right', get: r => (r.planned ? `${r.completionRate}%` : 'No tasks') },
              { label: 'Daily logs', w: '13%', align: 'right', get: r => `${r.loggedDays} of ${r.expectedDays}` },
              { label: 'Blocked', w: '9%', align: 'right', get: r => r.blocked, style: r => (r.blocked ? { color: STATUS_COLOR.blocked } : null) },
              { label: 'Extra', w: '8%', align: 'right', get: r => r.extraDays },
            ]} />
          </>
        )}

        <View wrap={false}>
          <Text style={s.h2}>Where the work went</Text>
          <Text style={s.hint}>Share of all tasks in the period by category.</Text>
          <CategoryBars data={data.categories} />
        </View>

        <View wrap={false}>
          <Text style={s.h2}>How to read this report</Text>
          {['done', 'completionRate', 'consistency', 'blocked', 'extraDays'].map(k => (
            <View key={k} style={s.glossRow}>
              <Text style={s.glossTerm}>{GLOSSARY[k].label}</Text>
              <Text style={s.glossText}>{GLOSSARY[k].tip}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* One page (or more) per employee */}
      {data.details.map(p => (
        <Page key={p.id} size="A4" style={s.page}>
          <Chrome data={data} company={company} title={title} footer={footer} />
          <Text style={[s.h2, { marginTop: 0, marginBottom: 10 }]}>{data.kind === 'weekly' ? 'Day by day detail' : 'Week by week detail'}</Text>
          <PersonHeader p={p} data={data} />
          {data.kind === 'weekly' ? <WeeklyDetail p={p} /> : <MonthlyDetail p={p} />}
        </Page>
      ))}
    </Document>
  )
}
