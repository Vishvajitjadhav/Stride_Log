import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import { ROLE_LABELS } from '../../lib/permissions'

// Built-in Helvetica only covers WinAnsi — keep to plain ASCII-ish symbols.
const P = '#7c3aed'
const P_LIGHT = '#c4b5fd'
const INK = '#1f2937'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 56, fontFamily: 'Helvetica', fontSize: 9, color: INK },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: P },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, objectFit: 'contain', marginRight: 10 },
  logoBox: { width: 40, height: 40, borderRadius: 8, backgroundColor: P, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoLetter: { color: '#fff', fontSize: 18, fontFamily: 'Helvetica-Bold' },
  company: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  sub: { fontSize: 8, color: MUTED, marginTop: 2 },
  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: P },
  range: { fontSize: 10, marginTop: 3, fontFamily: 'Helvetica-Bold' },
  meta: { fontSize: 8, color: MUTED, marginTop: 8, marginBottom: 14 },
  h2: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: P, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.6 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  kpi: { width: '25%', padding: 4 },
  kpiInner: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8 },
  kpiLabel: { fontSize: 7.5, color: MUTED },
  kpiValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  kpiDelta: { fontSize: 7.5, marginTop: 2 },
  row: { flexDirection: 'row' },
  half: { width: '50%' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  barLabel: { width: 90, fontSize: 8, color: MUTED },
  barTrack: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  barValue: { fontSize: 8, marginLeft: 4, fontFamily: 'Helvetica-Bold' },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5, paddingHorizontal: 6 },
  th: { fontSize: 7.5, color: MUTED, fontFamily: 'Helvetica-Bold' },
  td: { fontSize: 8.5 },
  listItem: { flexDirection: 'row', marginBottom: 4 },
  bullet: { width: 10, color: P },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
  legend: { flexDirection: 'row', marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  swatch: { width: 8, height: 8, borderRadius: 2, marginRight: 4 },
})

const fmt = (iso, f = 'd MMM yyyy') => format(parseISO(iso), f)

function Delta({ g, suffix = '', lowerIsBetter = false }) {
  if (!g) return null
  const d = g.delta
  const good = lowerIsBetter ? d < 0 : d > 0
  const color = d === 0 ? MUTED : good ? '#16a34a' : '#dc2626'
  const unit = suffix === '%' ? ' pts' : ''
  return <Text style={[s.kpiDelta, { color }]}>{d > 0 ? '+' : d < 0 ? '-' : '+/-'}{Math.abs(d)}{unit} vs prev ({g.prev}{suffix})</Text>
}

function Kpi({ label, value, suffix = '', g, lowerIsBetter }) {
  return (
    <View style={s.kpi}>
      <View style={s.kpiInner}>
        <Text style={s.kpiLabel}>{label}</Text>
        <Text style={s.kpiValue}>{value}{suffix}</Text>
        <Delta g={g} suffix={suffix} lowerIsBetter={lowerIsBetter} />
      </View>
    </View>
  )
}

// Stacked done / not-done columns drawn with Views.
function Columns({ data, labelOf }) {
  const H = 110
  const max = Math.max(1, ...data.map(d => d.planned))
  return (
    <View>
      <View style={s.legend}>
        <View style={s.legendItem}><View style={[s.swatch, { backgroundColor: P }]} /><Text style={{ fontSize: 7.5, color: MUTED }}>Done</Text></View>
        <View style={s.legendItem}><View style={[s.swatch, { backgroundColor: P_LIGHT }]} /><Text style={{ fontSize: 7.5, color: MUTED }}>Not done</Text></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, borderBottomWidth: 1, borderBottomColor: LINE }}>
        {data.map(d => {
          const open = Math.max(0, d.planned - d.done)
          return (
            <View key={labelOf(d)} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {d.planned > 0 && <Text style={{ fontSize: 7, color: MUTED, marginBottom: 2 }}>{d.done}/{d.planned}</Text>}
              <View style={{ width: 16 }}>
                {open > 0 && <View style={{ height: (open / max) * (H - 14), backgroundColor: P_LIGHT, borderTopLeftRadius: 3, borderTopRightRadius: 3, marginBottom: 1 }} />}
                {d.done > 0 && <View style={{ height: (d.done / max) * (H - 14), backgroundColor: P, borderTopLeftRadius: open ? 0 : 3, borderTopRightRadius: open ? 0 : 3 }} />}
              </View>
            </View>
          )
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 3 }}>
        {data.map(d => <Text key={labelOf(d)} style={{ flex: 1, textAlign: 'center', fontSize: 7, color: MUTED }}>{labelOf(d)}</Text>)}
      </View>
    </View>
  )
}

function CategoryBars({ data }) {
  const total = data.reduce((n, d) => n + d.count, 0)
  const max = Math.max(1, ...data.map(d => d.count))
  if (!data.length) return <Text style={{ color: MUTED }}>No tasks in this period.</Text>
  return data.slice(0, 10).map(c => (
    <View key={c.name} style={s.barRow}>
      <Text style={s.barLabel}>{c.name}</Text>
      <View style={s.barTrack}>
        <View style={{ width: `${(c.count / max) * 75}%`, height: 7, backgroundColor: c.color, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
        <Text style={s.barValue}>{c.count} ({Math.round((c.count / total) * 100)}%)</Text>
      </View>
    </View>
  ))
}

function Table({ cols, rows }) {
  return (
    <View style={s.table}>
      <View style={[s.tr, { backgroundColor: '#f9fafb' }]} fixed>
        {cols.map(c => <Text key={c.label} style={[s.th, { width: c.w, textAlign: c.align ?? 'left' }]}>{c.label}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          {cols.map(c => <Text key={c.label} style={[s.td, { width: c.w, textAlign: c.align ?? 'left' }]}>{c.get(r)}</Text>)}
        </View>
      ))}
    </View>
  )
}

export default function ReportDocument({ data }) {
  const { org, current: c, growth: g } = data
  const kindLabel = data.kind === 'weekly' ? 'Weekly' : 'Monthly'
  const logoOk = org.logo_url && !/\.svg($|\?)/i.test(org.logo_url)
  const company = org.company_name || 'StrideLog'
  const scopeLabel = { me: 'Personal report', person: 'Individual report', team: 'Team report', company: 'Company report' }[data.scope.kind]

  return (
    <Document title={`${company} ${kindLabel} Report – ${data.scope.name}`} author={company} creator="StrideLog">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>
            {logoOk ? <Image src={org.logo_url} style={s.logo} /> : (
              <View style={s.logoBox}><Text style={s.logoLetter}>{company[0]}</Text></View>
            )}
            <View>
              <Text style={s.company}>{company}</Text>
              <Text style={s.sub}>{scopeLabel}: {data.scope.name}</Text>
            </View>
          </View>
          <View style={s.titleBlock}>
            <Text style={s.title}>{kindLabel} Productivity Report</Text>
            <Text style={s.range}>{fmt(data.range.from)} – {fmt(data.range.to)}</Text>
          </View>
        </View>

        <Text style={s.meta}>
          Generated {format(data.generatedAt, 'd MMM yyyy, HH:mm')}{data.generatedBy ? ` by ${data.generatedBy}` : ''} ·
          Compared with {fmt(data.prev.from, 'd MMM')} – {fmt(data.prev.to, 'd MMM yyyy')} ·
          Working days are Mon–Fri excluding holidays
          {data.holidaysInRange.length ? ` (${data.holidaysInRange.map(h => `${h.name} ${fmt(h.date, 'd MMM')}`).join(', ')})` : ''}
        </Text>

        <Text style={[s.h2, { marginTop: 0 }]}>Summary</Text>
        <View style={s.kpis}>
          <Kpi label="Tasks completed" value={c.done} g={g.done} />
          <Kpi label="Completion rate" value={c.completionRate} suffix="%" g={g.completionRate} />
          <Kpi label="Log consistency" value={c.consistency} suffix="%" g={g.consistency} />
          <Kpi label="Assigned tasks on time" value={c.onTimeBase ? c.onTimeRate : '-'} suffix={c.onTimeBase ? '%' : ''} g={c.onTimeBase && data.previousOnTimeBase ? g.onTimeRate : null} />
          <Kpi label="Tasks planned" value={c.planned} g={g.planned} />
          <Kpi label="Carried over" value={c.carried} g={g.carried} lowerIsBetter />
          <Kpi label="Blocked" value={c.blocked} g={g.blocked} lowerIsBetter />
          <Kpi label="Extra days (weekend / holiday)" value={c.extraDays} g={g.extraDays} />
        </View>
        <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 4 }}>
          Days logged: {c.loggedDays} of {c.expectedDays} expected working days · Active people: {c.activePeople} · Assigned tasks: {c.assigned} ({c.assignedDone} done)
        </Text>

        <View style={[s.row, { marginTop: 4 }]}>
          <View style={[s.half, { paddingRight: 10 }]}>
            <Text style={s.h2}>{data.kind === 'weekly' ? 'Tasks by day' : 'Weekly trend'}</Text>
            {data.kind === 'weekly'
              ? <Columns data={data.daily} labelOf={d => fmt(d.date, 'EEE')} />
              : <Columns data={data.trend.slice(-8)} labelOf={d => fmt(d.week, 'd MMM')} />}
          </View>
          <View style={[s.half, { paddingLeft: 10 }]}>
            <Text style={s.h2}>Work by category</Text>
            <CategoryBars data={data.categories} />
          </View>
        </View>

        {data.teams.length > 0 && (
          <View wrap={false}>
            <Text style={s.h2}>By team</Text>
            <Table rows={data.teams} cols={[
              { label: 'Team', w: '30%', get: r => r.name },
              { label: 'People', w: '10%', align: 'right', get: r => r.members },
              { label: 'Done / planned', w: '18%', align: 'right', get: r => `${r.done} / ${r.planned}` },
              { label: 'Completion', w: '14%', align: 'right', get: r => `${r.completionRate}%` },
              { label: 'Consistency', w: '14%', align: 'right', get: r => `${r.consistency}%` },
              { label: 'Blocked', w: '14%', align: 'right', get: r => r.blocked },
            ]} />
          </View>
        )}

        {data.persons.length > 0 && (
          <View>
            <Text style={s.h2}>By person</Text>
            <Table rows={data.persons} cols={[
              { label: 'Name', w: '26%', get: r => r.name },
              { label: 'Role', w: '14%', get: r => ROLE_LABELS[r.role] ?? r.role },
              { label: 'Done / planned', w: '15%', align: 'right', get: r => `${r.done} / ${r.planned}` },
              { label: 'Completion', w: '11%', align: 'right', get: r => `${r.completionRate}%` },
              { label: 'Consistency', w: '12%', align: 'right', get: r => `${r.consistency}%` },
              { label: 'On time', w: '10%', align: 'right', get: r => (r.onTimeBase ? `${r.onTimeRate}%` : '-') },
              { label: 'Extra', w: '12%', align: 'right', get: r => r.extraDays },
            ]} />
          </View>
        )}

        <View style={s.row} wrap={false}>
          <View style={[s.half, { paddingRight: 10 }]}>
            <Text style={s.h2}>Highlights — completed</Text>
            {data.highlights.length === 0 && <Text style={{ color: MUTED }}>Nothing completed in this period.</Text>}
            {data.highlights.map(h => (
              <View key={h.id} style={s.listItem}>
                <Text style={s.bullet}>•</Text>
                <Text style={{ flex: 1 }}>{h.title}{data.persons.length ? `  — ${h.name}` : ''}</Text>
              </View>
            ))}
          </View>
          <View style={[s.half, { paddingLeft: 10 }]}>
            <Text style={s.h2}>Blockers raised</Text>
            {data.blockers.length === 0 && <Text style={{ color: MUTED }}>No blockers reported.</Text>}
            {data.blockers.map((b, i) => (
              <View key={i} style={s.listItem}>
                <Text style={s.bullet}>•</Text>
                <Text style={{ flex: 1 }}>{fmt(b.date, 'd MMM')} · {b.text}{data.persons.length ? `  — ${b.name}` : ''}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>{org.report_footer} · {company}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
