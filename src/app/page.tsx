'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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
  'Em Progresso':             '#2563EB',
  'Em progresso':             '#2563EB',
  'Em progresso (Atendido)':  '#2563EB',
  'Enviar Convite':           '#7C3AED',
  'Enviar Convite (Atendido)':'#7C3AED',
}
const STATUS_LABEL: Record<string, string> = {
  'Agenciado':                'Agenciado',
  'Convite Aceito':           'Agenciado',
  'Convite Enviado':          'Convite Enviado',
  'Em Progresso':             'Em Progresso',
  'Em progresso':             'Em Progresso',
  'Em progresso (Atendido)':  'Em Progresso',
  'Enviar Convite':           'Enviar Convite',
  'Enviar Convite (Atendido)':'Enviar Convite',
}
const INSIDE = new Set(['Agenciado','Convite Aceito'])

const fmtBRL = (n: number) =>
  'R$' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })

export default function Dashboard() {
  const [data, setData] = useState<{ summary: Summary; leads: Lead[]; byDay: DayPoint[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all'|'inside'|'other'>('all')

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); } else { setData(d) }
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
      <style>{`
        * { box-sizing: border-box; }
        .grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid-gmv { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .container { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1rem; }
        .hide-mobile { display: table-cell; }
        @media (max-width: 640px) {
          .grid-4 { grid-template-columns: repeat(2,1fr); }
          .grid-2 { grid-template-columns: 1fr; }
          .grid-gmv { grid-template-columns: 1fr; gap: 12px; }
          .container { padding: 1rem 0.75rem; }
          .hide-mobile { display: none; }
          .header-logo { height: 28px !important; }
          .header-title { font-size: 10px !important; }
          .header-name { font-size: 12px !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={{ background:'#1B3FE4', padding:'0.875rem 1.25rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <img src="/amplify-logo.png" alt="Amplify" className="header-logo" style={{ height:'36px', objectFit:'contain' }} />
        <div style={{ textAlign:'right' }}>
          <div className="header-title" style={{ color:'rgba(255,255,255,.6)', fontSize:'11px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>Relatório Super Afiliada</div>
          <div className="header-name" style={{ color:'white', fontSize:'13px', fontWeight:700 }}>Gisele Correia · @delymarkets</div>
        </div>
      </header>

      <div className="container">
        <div style={{ marginBottom:'1.25rem', color:'#9CA3AF', fontSize:'11px', fontWeight:500 }}>
          ↻ Atualizado em {new Date(s.updatedAt).toLocaleString('pt-BR')}
        </div>

        {/* CARDS */}
        <div className="grid-4" style={{ marginBottom:'1rem' }}>
          <Card label="Total Indicações" value={String(s.total)} sub="leads gerados" color="#0D0D1A" bg="white" />
          <Card label="Agenciados" value={String(s.agenciados)} sub="contrato + convite aceito" color="#1B3FE4" bg="white" />
          <Card label="Conversão" value={`${s.conversion}%`} sub="indicados → agenciados" color="#1B3FE4" bg="#EEF1FD" />
          <Card label="Comissão estimada" value={fmtBRL(s.giseleEarn)} sub="período atual" color="#059669" bg="#ECFDF5" />
        </div>

        {/* GMV */}
        <div style={{ background:'white', borderRadius:'14px', padding:'1.25rem', marginBottom:'1rem', border:'1px solid #E5E7EB' }}>
          <div className="grid-gmv">
            <div>
              <div style={{ fontSize:'10px', fontWeight:700, color:'#9CA3AF', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'4px' }}>GMV total dos seus creators</div>
              <div style={{ fontSize:'1.75rem', fontWeight:800, color:'#0D0D1A', letterSpacing:'-0.02em' }}>{fmtBRL(s.totalGmv)}</div>
            </div>
            <div>
              <div style={{ fontSize:'10px', fontWeight:700, color:'#9CA3AF', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'4px' }}>Cálculo da sua comissão</div>
              <div style={{ fontSize:'12px', color:'#6B6B8A', lineHeight:1.8 }}>
                {fmtBRL(s.totalGmv)} × 10% = {fmtBRL(s.totalCom)}<br/>
                {fmtBRL(s.totalCom)} × 10% × 20% = <strong style={{ color:'#059669' }}>{fmtBRL(s.giseleEarn)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* CHARTS */}
        <div className="grid-2" style={{ marginBottom:'1rem' }}>
          <div style={{ background:'white', borderRadius:'14px', padding:'1.25rem', border:'1px solid #E5E7EB' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#1B3FE4', marginBottom:'0.75rem', letterSpacing:'0.05em', textTransform:'uppercase' }}>Indicações por dia</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={byDay} barCategoryGap="30%">
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize:9, fill:'#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => [v + ' indicações', '']} labelFormatter={l => fmtDate(l)} />
                <Bar dataKey="n" fill="#1B3FE4" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:'white', borderRadius:'14px', padding:'1.25rem', border:'1px solid #E5E7EB' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#1B3FE4', marginBottom:'0.75rem', letterSpacing:'0.05em', textTransform:'uppercase' }}>Top creators por GMV</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={leads.filter(l => l.gmv > 0).slice(0,5)} layout="vertical" barCategoryGap="30%">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="handle" width={90} tick={{ fontSize:9, fill:'#6B6B8A' }} axisLine={false} tickLine={false}
                  tickFormatter={h => h.replace('@','').slice(0,12)} />
                <Tooltip formatter={(v: number) => [fmtBRL(v), 'GMV']} />
                <Bar dataKey="gmv" fill="#E4003A" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TABLE */}
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E5E7EB', overflow:'hidden' }}>
          <div style={{ padding:'0.875rem 1rem', borderBottom:'1px solid #EEF1FD', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#1B3FE4', letterSpacing:'0.05em', textTransform:'uppercase' }}>
              Todas as {s.total} indicações
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              {(['all','inside','other'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'100px', border:'none', cursor:'pointer',
                    background: filter === f ? '#1B3FE4' : '#F3F4F6',
                    color: filter === f ? 'white' : '#6B6B8A' }}>
                  {f === 'all' ? 'Todos' : f === 'inside' ? 'Agenciados' : 'Pendentes'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:'#F7F8FF' }}>
                  <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'#9CA3AF', fontSize:'10px', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>#</th>
                  <th className="hide-mobile" style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'#9CA3AF', fontSize:'10px', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>Creator</th>
                  <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'#9CA3AF', fontSize:'10px', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>@ TikTok</th>
                  <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'#9CA3AF', fontSize:'10px', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>Status</th>
                  <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'#9CA3AF', fontSize:'10px', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>GMV</th>
                  <th className="hide-mobile" style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'#9CA3AF', fontSize:'10px', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>Comissão</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={l.id} style={{ borderTop:'1px solid #F3F4F6', background: i % 2 === 1 ? '#F9FAFB' : 'white' }}>
                    <td style={{ padding:'8px 10px', color:'#9CA3AF', fontWeight:600 }}>{i+1}</td>
                    <td className="hide-mobile" style={{ padding:'8px 10px', fontWeight:600, color:'#0D0D1A', maxWidth:'130px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.nome || '—'}</td>
                    <td style={{ padding:'8px 10px', color:'#6B6B8A', fontSize:'11px', maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.handle ? l.handle.replace(/^@/, '') : '—'}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{ fontSize:'10px', fontWeight:700, color: STATUS_COLOR[l.status] ?? '#9CA3AF',
                        background: (STATUS_COLOR[l.status] ?? '#9CA3AF') + '18', padding:'3px 7px', borderRadius:'100px', whiteSpace:'nowrap' }}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:600, color: l.gmv > 0 ? '#0D0D1A' : '#9CA3AF', whiteSpace:'nowrap' }}>
                      {INSIDE.has(l.status) ? fmtBRL(l.gmv) : '—'}
                    </td>
                    <td className="hide-mobile" style={{ padding:'8px 10px', textAlign:'right', fontWeight:600, color: l.comissao > 0 ? '#0D0D1A' : '#9CA3AF', whiteSpace:'nowrap' }}>
                      {INSIDE.has(l.status) ? fmtBRL(l.comissao) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:'8px 10px', background:'#EEF1FD', display:'flex', justifyContent:'space-between', fontSize:'11px', fontWeight:700, color:'#1B3FE4' }}>
            <span>TOTAL · {s.agenciados} agenciados</span>
            <span>{fmtBRL(s.totalGmv)}</span>
          </div>
        </div>

        <div style={{ marginTop:'0.75rem', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'10px', padding:'10px 14px', fontSize:'11px', color:'#92400E' }}>
          <strong>Cálculo:</strong> GMV × 10% (creator) × 10% (Amplify) × 20% (você) · Cache de 5 minutos.
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, sub, color, bg }: { label:string, value:string, sub:string, color:string, bg:string }) {
  return (
    <div style={{ background:bg, borderRadius:'12px', padding:'1rem', border:'1px solid #E5E7EB' }}>
      <div style={{ fontSize:'9px', fontWeight:700, color:'#9CA3AF', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'4px' }}>{label}</div>
      <div style={{ fontSize:'1.4rem', fontWeight:800, color, lineHeight:1, letterSpacing:'-0.02em', marginBottom:'3px' }}>{value}</div>
      <div style={{ fontSize:'10px', color:'#9CA3AF', fontWeight:500 }}>{sub}</div>
    </div>
  )
}

function Loading() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F7F8FF', flexDirection:'column', gap:'12px' }}>
      <div style={{ width:'36px', height:'36px', border:'3px solid #EEF1FD', borderTop:'3px solid #1B3FE4', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}></div>
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
