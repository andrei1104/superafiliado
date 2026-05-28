'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Area, AreaChart } from 'recharts'

interface Lead { id:string; handle:string; nome:string; status:string; created:string; gmv:number; comissao:number }
interface Summary { total:number; agenciados:number; conversion:number; totalGmv:number; totalCom:number; giseleEarn:number; updatedAt:string }
interface DayPoint { date:string; n:number }
interface WeekPoint { date:string; gmv:number; comissao:number; giseleEarn:number }
interface WeekPoint { date:string; gmv:number; comissao:number; giseleEarn:number }

const STATUS_COLOR: Record<string,string> = {
  'Agenciado':'#059669','Convite Aceito':'#059669','Convite Enviado':'#D97706',
  'Em Progresso':'#2563EB','Em progresso':'#2563EB','Em progresso (Atendido)':'#2563EB',
  'Enviar Convite':'#7C3AED','Enviar Convite (Atendido)':'#7C3AED',
}
const STATUS_LABEL: Record<string,string> = {
  'Agenciado':'Agenciado','Convite Aceito':'Agenciado','Convite Enviado':'Convite Enviado',
  'Em Progresso':'Em Progresso','Em progresso':'Em Progresso','Em progresso (Atendido)':'Em Progresso',
  'Enviar Convite':'Enviar Convite','Enviar Convite (Atendido)':'Enviar Convite',
}
const INSIDE = new Set(['Agenciado','Convite Aceito'])

const fmtBRL = (n:number) => 'R$' + n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtDate = (iso:string) => new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})
const fmtWeek = (iso:string) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth()+1}` }

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState<{summary:Summary;leads:Lead[];byDay:DayPoint[];weeklyData:WeekPoint[];weeklyDataByCreator:Record<string,WeekPoint[]>}|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all'|'inside'|'other'>('all')
  const [selectedCreator, setSelectedCreator] = useState<Lead|null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedDates, setAppliedDates] = useState({ start:'', end:'' })
  const [activeChart, setActiveChart] = useState<'gmv'|'giseleEarn'>('giseleEarn')

  useEffect(() => {
    const stored = sessionStorage.getItem('amplify_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.role === 'admin') { router.push('/admin'); return }
    setUser(u)
    setData(null)
    fetch(`/api/data?utm=${encodeURIComponent(u.utm)}${appliedDates.start?'&startDate='+appliedDates.start:''}${appliedDates.end?'&endDate='+appliedDates.end:''}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar.'); setLoading(false) })
  }, [router, appliedDates])

  if (!user || loading) return <LoadingScreen />
  if (error || !data) return <ErrorScreen msg={error} />

  const { summary:s, leads, byDay, weeklyData, weeklyDataByCreator } = data
  const filtered = leads.filter(l => filter==='all' ? true : filter==='inside' ? INSIDE.has(l.status) : !INSIDE.has(l.status))

  const chartLabels: Record<string,string> = { gmv:'GMV dos creators', giseleEarn:'Sua comissão' }
  const chartColors: Record<string,string> = { gmv:'#1B3FE4', giseleEarn:'#059669' }

  return (
    <div style={{background:'#F7F8FF',minHeight:'100vh',fontFamily:"'Inter',sans-serif"}}>
      <style>{`
        *{box-sizing:border-box}
        .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .cont{max-width:1100px;margin:0 auto;padding:1.5rem 1rem}
        .hm{display:table-cell}
        @media(max-width:640px){.g4{grid-template-columns:repeat(2,1fr)}.g2{grid-template-columns:1fr}.cont{padding:1rem .75rem}.hm{display:none}}
      `}</style>

      {/* HEADER */}
      <header style={{background:'#1B3FE4',padding:'.875rem 1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center'}}>
          <img src="/amplify-logo.png" alt="Amplify" style={{height:'34px',objectFit:'contain'}} />
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <div style={{textAlign:'right'}}>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:'10px',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase'}}>Super Afiliada</div>
            <div style={{color:'white',fontSize:'13px',fontWeight:700}}>{user.name} · {user.handle}</div>
          </div>
          <button onClick={()=>{sessionStorage.clear();router.push('/')}}
            style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:'8px',padding:'6px 12px',color:'white',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
            Sair
          </button>
        </div>
      </header>

      <div className="cont">
        <div style={{marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
          <div style={{color:'#9CA3AF',fontSize:'11px',fontWeight:500}}>
            ↻ Atualizado em {new Date(s.updatedAt).toLocaleString('pt-BR')}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
            <span style={{fontSize:'11px',color:'#6B6B8A',fontWeight:600}}>Período:</span>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
              style={{fontSize:'11px',padding:'4px 8px',borderRadius:'8px',border:'1.5px solid #E5E7EB',outline:'none',fontFamily:'inherit'}}/>
            <span style={{fontSize:'11px',color:'#9CA3AF'}}>até</span>
            <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
              style={{fontSize:'11px',padding:'4px 8px',borderRadius:'8px',border:'1.5px solid #E5E7EB',outline:'none',fontFamily:'inherit'}}/>
            <button onClick={()=>{setLoading(true);setAppliedDates({start:startDate,end:endDate})}}
              style={{fontSize:'11px',fontWeight:700,padding:'4px 12px',borderRadius:'8px',border:'none',background:'#1B3FE4',color:'white',cursor:'pointer'}}>
              Filtrar
            </button>
            {(appliedDates.start||appliedDates.end) && (
              <button onClick={()=>{setStartDate('');setEndDate('');setLoading(true);setAppliedDates({start:'',end:''})}}
                style={{fontSize:'11px',fontWeight:700,padding:'4px 10px',borderRadius:'8px',border:'none',background:'#F3F4F6',color:'#6B6B8A',cursor:'pointer'}}>
                Limpar ×
              </button>
            )}
          </div>
        </div>

        {/* CARDS */}
        <div className="g4" style={{marginBottom:'1rem'}}>
          <Card label="Total Indicações" value={String(s.total)} sub="leads gerados" color="#0D0D1A" bg="white"/>
          <Card label="Agenciados" value={String(s.agenciados)} sub="contrato + convite aceito" color="#1B3FE4" bg="white"/>
          <Card label="Conversão" value={`${s.conversion}%`} sub="indicados → agenciados" color="#1B3FE4" bg="#EEF1FD"/>
          <Card label="Comissão estimada" value={fmtBRL(s.giseleEarn)} sub="período atual" color="#059669" bg="#ECFDF5"/>
        </div>

        {/* GMV CARD */}
        <div style={{background:'white',borderRadius:'14px',padding:'1.25rem',marginBottom:'1rem',border:'1px solid #E5E7EB'}}>
          <div className="g2">
            <div>
              <div style={{fontSize:'10px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'4px'}}>GMV total dos seus creators</div>
              <div style={{fontSize:'1.75rem',fontWeight:800,color:'#0D0D1A',letterSpacing:'-0.02em'}}>{fmtBRL(s.totalGmv)}</div>
            </div>
            <div>
              <div style={{fontSize:'10px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'4px'}}>Sua comissão estimada</div>
              <div style={{fontSize:'1.75rem',fontWeight:800,color:'#059669',letterSpacing:'-0.02em'}}>{fmtBRL(s.giseleEarn)}</div>
            </div>
          </div>
        </div>

        {/* EVOLUÇÃO SEMANAL */}
        {selectedCreator && (
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'-4px',padding:'0 2px'}}>
            <span style={{fontSize:'11px',color:'#1B3FE4',fontWeight:600}}>📊 Mostrando evolução de:</span>
            <span style={{fontSize:'11px',fontWeight:700,color:'#0D0D1A'}}>{selectedCreator.nome || selectedCreator.handle}</span>
            <button onClick={()=>setSelectedCreator(null)}
              style={{fontSize:'11px',color:'#9CA3AF',background:'#F3F4F6',border:'none',borderRadius:'100px',padding:'2px 8px',cursor:'pointer',fontWeight:600}}>
              Limpar ×
            </button>
          </div>
        )}
        {(weeklyData.length > 1 || (selectedCreator && weeklyDataByCreator[selectedCreator.handle]?.length > 1)) && (
          <div style={{background:'white',borderRadius:'14px',padding:'1.25rem',marginBottom:'1rem',border:`1px solid ${selectedCreator ? '#1B3FE4' : '#E5E7EB'}`}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:'8px'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:'#1B3FE4',letterSpacing:'0.05em',textTransform:'uppercase'}}>
                {selectedCreator ? `Evolução — ${selectedCreator.nome || selectedCreator.handle}` : 'Evolução semanal'}
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                {(['giseleEarn','gmv'] as const).map(k => (
                  <button key={k} onClick={()=>setActiveChart(k)}
                    style={{fontSize:'11px',fontWeight:700,padding:'4px 10px',borderRadius:'100px',border:'none',cursor:'pointer',
                      background:activeChart===k ? chartColors[k] : '#F3F4F6',
                      color:activeChart===k ? 'white' : '#6B6B8A'}}>
                    {chartLabels[k]}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={selectedCreator && weeklyDataByCreator[selectedCreator.handle] ? weeklyDataByCreator[selectedCreator.handle] : weeklyData} margin={{top:4,right:4,bottom:0,left:0}}>
                <defs>
                  <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors[activeChart]} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={chartColors[activeChart]} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="date" tickFormatter={fmtWeek} tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip formatter={(v:number)=>[fmtBRL(v),chartLabels[activeChart]]} labelFormatter={l=>fmtDate(l)}/>
                <Area type="monotone" dataKey={activeChart} stroke={chartColors[activeChart]} strokeWidth={2.5} fill="url(#colorGrad)" dot={{r:3,fill:chartColors[activeChart],strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
            {/* Destaque semana mais recente vs anterior */}
            {(() => {
              const chartPoints = selectedCreator && weeklyDataByCreator[selectedCreator.handle] ? weeklyDataByCreator[selectedCreator.handle] : weeklyData
              if (chartPoints.length < 2) return null
              const last = chartPoints[chartPoints.length-1]
              const prev = chartPoints[chartPoints.length-2]
              const diff = last[activeChart] - prev[activeChart]
              const pct  = prev[activeChart] ? (diff/prev[activeChart]*100) : 0
              return (
                <div style={{marginTop:'12px',display:'flex',gap:'16px',flexWrap:'wrap'}}>
                  <div style={{fontSize:'12px',color:'#6B6B8A'}}>
                    Última semana: <strong style={{color:'#0D0D1A'}}>{fmtBRL(last[activeChart])}</strong>
                  </div>
                  <div style={{fontSize:'12px',color: diff>=0 ? '#059669' : '#E4003A',fontWeight:700}}>
                    {diff>=0 ? '▲' : '▼'} {fmtBRL(Math.abs(diff))} ({Math.abs(pct).toFixed(1)}%) vs semana anterior
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* CHARTS ROW */}
        <div className="g2" style={{marginBottom:'1rem'}}>
          <div style={{background:'white',borderRadius:'14px',padding:'1.25rem',border:'1px solid #E5E7EB'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'#1B3FE4',marginBottom:'0.75rem',letterSpacing:'0.05em',textTransform:'uppercase'}}>Indicações por dia</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={byDay} barCategoryGap="30%">
                <XAxis dataKey="date" tickFormatter={d=>d.slice(5)} tick={{fontSize:9,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip formatter={v=>[v+' indicações','']} labelFormatter={l=>fmtDate(l)}/>
                <Bar dataKey="n" fill="#1B3FE4" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:'white',borderRadius:'14px',padding:'1.25rem',border:'1px solid #E5E7EB'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'#1B3FE4',marginBottom:'0.75rem',letterSpacing:'0.05em',textTransform:'uppercase'}}>Top creators por GMV</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={leads.filter(l=>l.gmv>0).slice(0,5)} layout="vertical" barCategoryGap="30%">
                <XAxis type="number" hide/>
                <YAxis type="category" dataKey="handle" width={90} tick={{fontSize:9,fill:'#6B6B8A'}} axisLine={false} tickLine={false}
                  tickFormatter={h=>h.replace('@','').slice(0,12)}/>
                <Tooltip formatter={(v:number)=>[fmtBRL(v),'GMV']}/>
                <Bar dataKey="gmv" fill="#E4003A" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TABLE */}
        <div style={{background:'white',borderRadius:'14px',border:'1px solid #E5E7EB',overflow:'hidden'}}>
          <div style={{padding:'.875rem 1rem',borderBottom:'1px solid #EEF1FD',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'#1B3FE4',letterSpacing:'0.05em',textTransform:'uppercase'}}>Todas as {s.total} indicações</div>
            <div style={{display:'flex',gap:'6px'}}>
              {(['all','inside','other'] as const).map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  style={{fontSize:'11px',fontWeight:700,padding:'4px 10px',borderRadius:'100px',border:'none',cursor:'pointer',
                    background:filter===f?'#1B3FE4':'#F3F4F6',color:filter===f?'white':'#6B6B8A'}}>
                  {f==='all'?'Todos':f==='inside'?'Agenciados':'Pendentes'}
                </button>
              ))}
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
              <thead>
                <tr style={{background:'#F7F8FF'}}>
                  {['#','Creator','@ TikTok','Status','GMV','Comissão'].map((h,i)=>(
                    <th key={h} className={i===1||i===5?'hm':''} style={{padding:'8px 10px',textAlign:i>=4?'right':'left',fontWeight:700,color:'#9CA3AF',fontSize:'10px',letterSpacing:'0.08em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l,i)=>(
                  <tr key={l.id}
                    onClick={()=>{ if(!INSIDE.has(l.status)) return; setSelectedCreator(selectedCreator?.id===l.id ? null : l) }}
                    style={{borderTop:'1px solid #F3F4F6',
                      background: selectedCreator?.id===l.id ? '#EEF1FD' : i%2===1?'#F9FAFB':'white',
                      cursor:INSIDE.has(l.status)?'pointer':'default',
                      borderLeft: selectedCreator?.id===l.id ? '3px solid #1B3FE4' : '3px solid transparent',
                      transition:'all 0.1s'}}>
                    <td style={{padding:'8px 10px',color:'#9CA3AF',fontWeight:600}}>{i+1}</td>
                    <td className="hm" style={{padding:'8px 10px',fontWeight:600,color:'#0D0D1A',maxWidth:'130px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.nome||'—'}</td>
                    <td style={{padding:'8px 10px',color:'#6B6B8A',fontSize:'11px',maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.handle||'—'}</td>
                    <td style={{padding:'8px 10px'}}>
                      <span style={{fontSize:'10px',fontWeight:700,color:STATUS_COLOR[l.status]??'#9CA3AF',background:(STATUS_COLOR[l.status]??'#9CA3AF')+'18',padding:'3px 7px',borderRadius:'100px',whiteSpace:'nowrap'}}>
                        {STATUS_LABEL[l.status]??l.status}
                      </span>
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600,color:l.gmv>0?'#0D0D1A':'#9CA3AF',whiteSpace:'nowrap'}}>{INSIDE.has(l.status)?fmtBRL(l.gmv):'—'}</td>
                    <td className="hm" style={{padding:'8px 10px',textAlign:'right',fontWeight:600,color:l.comissao>0?'#0D0D1A':'#9CA3AF',whiteSpace:'nowrap'}}>{INSIDE.has(l.status)?fmtBRL(l.comissao):'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:'8px 10px',background:'#EEF1FD',display:'flex',justifyContent:'space-between',fontSize:'11px',fontWeight:700,color:'#1B3FE4'}}>
            <span>TOTAL · {s.agenciados} agenciados</span>
            <span>{fmtBRL(s.totalGmv)}</span>
          </div>
        </div>
        style={{background:'#F3F4F6',border:'none',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center',color:'#6B6B8A'}}>×</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'1rem'}}>
                {[
                  {label:'Status', value: (STATUS_LABEL[selectedCreator.status]??selectedCreator.status), color: STATUS_COLOR[selectedCreator.status]??'#9CA3AF'},
                  {label:'GMV acumulado', value: fmtBRL(selectedCreator.gmv), color:'#1B3FE4'},
                  {label:'Comissão TikTok', value: fmtBRL(selectedCreator.comissao), color:'#7C3AED'},
                  {label:'Sua comissão', value: fmtBRL(selectedCreator.comissao*0.10*0.20), color:'#059669'},
                ].map(({label,value,color}) => (
                  <div key={label} style={{background:'#F7F8FF',borderRadius:'10px',padding:'10px 12px'}}>
                    <div style={{fontSize:'9px',fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'3px'}}>{label}</div>
                    <div style={{fontSize:'1rem',fontWeight:800,color}}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:'11px',color:'#9CA3AF',textAlign:'center'}}>
                Indicado em {new Date(selectedCreator.created).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}
              </div>
            </div>
          </div>
        )}

        <div style={{marginTop:'.75rem',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:'10px',padding:'10px 14px',fontSize:'11px',color:'#92400E'}}>
          <strong>Cálculo:</strong> GMV × 10% (creator) × 10% (Amplify) × 20% (você) · Cache de 5 minutos.
        </div>
      </div>
    </div>
  )
}

function Card({label,value,sub,color,bg}:{label:string,value:string,sub:string,color:string,bg:string}) {
  return (
    <div style={{background:bg,borderRadius:'12px',padding:'1rem',border:'1px solid #E5E7EB'}}>
      <div style={{fontSize:'9px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:'4px'}}>{label}</div>
      <div style={{fontSize:'1.4rem',fontWeight:800,color,lineHeight:1,letterSpacing:'-0.02em',marginBottom:'3px'}}>{value}</div>
      <div style={{fontSize:'10px',color:'#9CA3AF',fontWeight:500}}>{sub}</div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F7F8FF',flexDirection:'column',gap:'12px'}}>
      <div style={{width:'36px',height:'36px',border:'3px solid #EEF1FD',borderTop:'3px solid #1B3FE4',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
      <div style={{fontSize:'13px',color:'#6B6B8A',fontWeight:600}}>Carregando...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function ErrorScreen({msg}:{msg:string}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F7F8FF',flexDirection:'column',gap:'8px'}}>
      <div style={{fontSize:'2rem'}}>⚠️</div>
      <div style={{fontSize:'14px',color:'#E4003A',fontWeight:600}}>Erro ao carregar</div>
      <div style={{fontSize:'12px',color:'#9CA3AF'}}>{msg}</div>
    </div>
  )
}
