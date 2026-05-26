'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

// ── TYPES ──────────────────────────────────────────────────
interface Lead {
  id: string
  handle: string
  nome: string
  status: string
  created: string
  gmv: number
  comissao: number
}
interface Summary {
  total: number
  agenciados: number
  conversion: number
  totalGmv: number
  totalCom: number
  giseleEarn: number
  updatedAt: string
}
interface DayPoint { date: string; n: number }

const STATUS_COLOR: Record<string, string> = {
  'Agenciado':                '#059669',
  'Convite Aceito':           '#059669',
  'Convite Enviado':          '#D97706',
  'Em progresso (Atendido)':  '#2563EB',
  'Enviar Convite (Atendido)':'#7C3AED',
}
const STATUS_LABEL: Record<string, string> = {
  'Agenciado':                'Agenciado',
  'Convite Aceito':           'Agenciado',
  'Convite Enviado':          'Convite Enviado',
  'Em progresso (Atendido)':  'Em Progresso',
  'Enviar Convite (Atendido)':'Enviar Convite',
}
const INSIDE = new Set(['Agenciado','Convite Aceito'])

// ── HELPERS ────────────────────────────────────────────────
const fmtBRL = (n: number) =>
  'R$' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })

// ── COMPONENT ──────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<{ summary: Summary; leads: Lead[]; byDay: DayPoint[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all'|'inside'|'other'>('all')

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError('Erro ao carregar dados: ' + d.error)
        } else {
          setData(d)
        }
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar dados.'); setLoading(false) })
  }, [])

  if (loading) return <Loading />
  if (error || !data) return <Error msg={error} />

  const { summary: s, leads, byDay } = data
  const filtered = leads.filter(l =>
    filter === 'all' ? true :
    filter === 'inside' ? INSIDE.has(l.status) :
    !INSIDE.has(l.status)
  )

  return (
    <div style={{ background:'#F7F8FF', minHeight:'100vh', fontFamily:"'Inter',sans-serif" }}>

      {/* HEADER */}
      <header style={{ background:'#1B3FE4', padding:'1.25rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <img src='/amplify-logo.png' alt='Amplify' style={{ height:'38px', objectFit:'contain' }} />
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ color:'rgba(255,255,255,.5)', fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>Relatório Super Afiliada</div>
          <div style={{ color:'white', fontSize:'13px', fontWeight:700 }}>Gisele Correia · @delymarkets</div>
        </div>
      </header>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'2rem 1.5rem' }}>

        {/* UPDATED AT */}
        <div style={{ marginBottom:'1.5rem', color:'#9CA3AF', fontSize:'12px', fontWeight:500 }}>
          ↻ Atualizado em {new Date(s.updatedAt).toLocaleString('pt-BR')}
        </div>

        {/* SUMMARY CARDS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'2rem' }}>
          <Card label="Total Indicações" value={String(s.total)} sub="leads gerados" color="#0D0D1A" bg="white" />
          <Card label="Agenciados" value={String(s.agenciados)} sub="contrato + convite aceito" color="#1B3FE4" bg="white" />
          <Card label="Conversão" value={`${s.conversion}%`} sub="indicados → agenciados" color="#1B3FE4" bg="#EEF1FD" />
          <Card label="Comissão estimada" value={fmtBRL(s.giseleEarn)} sub="período atual" color="#059669" bg="#ECFDF5" />
        </div>

        {/* GMV CARD */}
        <div style={{ background:'white', borderRadius:'16px', padding:'1.5rem 2rem', marginBottom:'2rem', border:'1px solid #E5E7EB', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem' }}>
          <div>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#9CA3AF', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'4px' }}>GMV total dos seus creators</div>
            <div style={{ fontSize:'2rem', fontWeight:800, color:'#0D0D1A', letterSpacing:'-0.02em' }}>{fmtBRL(s.totalGmv)}</div>
          </div>
          <div>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#9CA3AF', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'4px' }}>Cálculo da sua comissão</div>
            <div style={{ fontSize:'12px', color:'#6B6B8A', lineHeight:1.8 }}>
              {fmtBRL(s.totalGmv)} × 10% (creators) = {fmtBRL(s.totalCom)}<br/>
              {fmtBRL(s.totalCom)} × 10% (Amplify) × 20% (você) = <strong style={{ color:'#059669' }}>{fmtBRL(s.giseleEarn)}</strong>
            </div>
          </div>
        </div>

        {/* CHARTS ROW */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'2rem' }}>
          {/* Indicações por dia */}
          <div style={{ background:'white', borderRadius:'16px', padding:'1.25rem 1.5rem', border:'1px solid #E5E7EB' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#1B3FE4', marginBottom:'1rem', letterSpacing:'0.05em', textTransform:'uppercase' }}>Indicações por dia</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={byDay} barCategoryGap="30%">
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize:10, fill:'#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => [v + ' indicações', '']} labelFormatter={l => fmtDate(l)} />
                <Bar dataKey="n" fill="#1B3FE4" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 5 creators */}
          <div style={{ background:'white', borderRadius:'16px', padding:'1.25rem 1.5rem', border:'1px solid #E5E7EB' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#1B3FE4', marginBottom:'1rem', letterSpacing:'0.05em', textTransform:'uppercase' }}>Top creators por GMV</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={leads.filter(l => l.gmv > 0).slice(0,5)} layout="vertical" barCategoryGap="30%">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="handle" width={100} tick={{ fontSize:10, fill:'#6B6B8A' }} axisLine={false} tickLine={false}
                  tickFormatter={h => h.replace('@','').slice(0,14)} />
                <Tooltip formatter={(v: number) => [fmtBRL(v), 'GMV']} />
                <Bar dataKey="gmv" fill="#E4003A" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TABLE */}
        <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E5E7EB', overflow:'hidden' }}>
          <div style={{ padding:'1rem 1.5rem', borderBottom:'1px solid #EEF1FD', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#1B3FE4', letterSpacing:'0.05em', textTransform:'uppercase' }}>
              Todas as {s.total} indicações
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              {(['all','inside','other'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize:'11px', fontWeight:700, padding:'4px 12px', borderRadius:'100px', border:'none', cursor:'pointer',
                    background: filter === f ? '#1B3FE4' : '#F3F4F6',
                    color: filter === f ? 'white' : '#6B6B8A' }}>
                  {f === 'all' ? 'Todos' : f === 'inside' ? 'Agenciados' : 'Pendentes'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ background:'#F7F8FF' }}>
                  {['#','Creator','@ TikTok','Status','GMV','Comissão est.'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign: h === 'GMV' || h === 'Comissão est.' ? 'right' : 'left',
                      fontWeight:700, color:'#9CA3AF', fontSize:'11px', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={l.id} style={{ borderTop:'1px solid #F3F4F6', background: i % 2 === 1 ? '#F9FAFB' : 'white' }}>
                    <td style={{ padding:'10px 14px', color:'#9CA3AF', fontWeight:600 }}>{i+1}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:'#0D0D1A', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.nome || '—'}</td>
                    <td style={{ padding:'10px 14px', color:'#6B6B8A', fontSize:'12px', maxWidth:'140px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.handle ? l.handle.replace(/^@/, '') : '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:'11px', fontWeight:700, color: STATUS_COLOR[l.status] ?? '#9CA3AF',
                        background: (STATUS_COLOR[l.status] ?? '#9CA3AF') + '18', padding:'3px 8px', borderRadius:'100px' }}>
                        {STATUS_LABEL[l.status] ?? (l.status || 'Pendente')}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color: l.gmv > 0 ? '#0D0D1A' : '#9CA3AF' }}>
                      {INSIDE.has(l.status) ? fmtBRL(l.gmv) : '—'}
                    </td>
                    <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color: l.comissao > 0 ? '#0D0D1A' : '#9CA3AF' }}>
                      {INSIDE.has(l.status) ? fmtBRL(l.comissao) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* FOOTER */}
          <div style={{ padding:'10px 14px', background:'#EEF1FD', display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1fr', gap:'0', fontSize:'12px' }}>
            <span style={{ fontWeight:700, color:'#1B3FE4', gridColumn:'span 2' }}>TOTAL</span>
            <span style={{ color:'#1B3FE4', fontWeight:700 }}>{s.agenciados} agenciados</span>
            <span></span>
            <span style={{ fontWeight:700, color:'#1B3FE4', textAlign:'right' }}>{fmtBRL(s.totalGmv)}</span>
            <span style={{ fontWeight:700, color:'#1B3FE4', textAlign:'right' }}>{fmtBRL(s.totalCom)}</span>
          </div>
        </div>

        {/* LEGEND */}
        <div style={{ marginTop:'1rem', display:'flex', gap:'16px', flexWrap:'wrap' }}>
          {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'Convite Aceito').map(([k,v]) => (
            <span key={k} style={{ fontSize:'11px', fontWeight:700, color: STATUS_COLOR[k], display:'flex', alignItems:'center', gap:'4px' }}>
              ● {v}
            </span>
          ))}
        </div>

        {/* NOTE */}
        <div style={{ marginTop:'1.5rem', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'10px', padding:'12px 16px', fontSize:'12px', color:'#92400E' }}>
          <strong>Cálculo:</strong> GMV × 10% (comissão creator) × 10% (taxa Amplify) × 20% (sua comissão de referral) · Dados atualizados automaticamente a cada 5 minutos.
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, sub, color, bg }: { label:string, value:string, sub:string, color:string, bg:string }) {
  return (
    <div style={{ background:bg, borderRadius:'14px', padding:'1.25rem', border:'1px solid #E5E7EB' }}>
      <div style={{ fontSize:'10px', fontWeight:700, color:'#9CA3AF', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'6px' }}>{label}</div>
      <div style={{ fontSize:'1.75rem', fontWeight:800, color, lineHeight:1, letterSpacing:'-0.02em', marginBottom:'4px' }}>{value}</div>
      <div style={{ fontSize:'11px', color:'#9CA3AF', fontWeight:500 }}>{sub}</div>
    </div>
  )
}

function Loading() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F7F8FF', flexDirection:'column', gap:'12px' }}>
      <div style={{ width:'40px', height:'40px', border:'3px solid #EEF1FD', borderTop:'3px solid #1B3FE4', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}></div>
      <div style={{ fontSize:'13px', color:'#6B6B8A', fontWeight:600 }}>Carregando dados...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Error({ msg }: { msg: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F7F8FF', flexDirection:'column', gap:'8px' }}>
      <div style={{ fontSize:'2rem' }}>⚠️</div>
      <div style={{ fontSize:'14px', color:'#E4003A', fontWeight:600 }}>Erro ao carregar</div>
      <div style={{ fontSize:'12px', color:'#9CA3AF' }}>{msg}</div>
    </div>
  )
}
