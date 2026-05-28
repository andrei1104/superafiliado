'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts'
import { USERS } from '../lib/auth'

const fmtBRL = (n:number) => 'R$' + n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtWeek = (iso:string) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth()+1}` }
const fmtDate = (iso:string) => new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})

const AFFILIATES = Object.entries(USERS)
  .filter(([,v]) => v.role === 'affiliate')
  .map(([login, v]) => ({ login, ...v }))

const COLORS = ['#1B3FE4','#E4003A','#059669','#D97706','#7C3AED']

export default function Admin() {
  const router = useRouter()
  const [affiliatesData, setAffiliatesData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string|null>(null)
  const [activeMetric, setActiveMetric] = useState<'giseleEarn'|'gmv'>('giseleEarn')

  useEffect(() => {
    const stored = sessionStorage.getItem('amplify_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.role !== 'admin') { router.push('/dashboard'); return }

    // Busca dados de cada afiliado em paralelo
    Promise.all(
      AFFILIATES.map(a =>
        fetch(`/api/data?utm=${encodeURIComponent(a.utm)}`)
          .then(r => r.json())
          .then(d => ({ login: a.login, data: d }))
          .catch(() => ({ login: a.login, data: null }))
      )
    ).then(results => {
      const map: Record<string, any> = {}
      results.forEach(r => { map[r.login] = r.data })
      setAffiliatesData(map)
      setLoading(false)
    })
  }, [router])

  if (loading) return <LoadingScreen />

  // Consolidado
  const totals = AFFILIATES.reduce((acc, a) => {
    const d = affiliatesData[a.login]?.summary
    if (!d) return acc
    return {
      total: acc.total + d.total,
      agenciados: acc.agenciados + d.agenciados,
      totalGmv: acc.totalGmv + d.totalGmv,
      giseleEarn: acc.giseleEarn + d.giseleEarn,
    }
  }, { total:0, agenciados:0, totalGmv:0, giseleEarn:0 })

  // Evolução semanal consolidada
  const weeklyMap: Record<string, number> = {}
  AFFILIATES.forEach(a => {
    const wd = affiliatesData[a.login]?.weeklyData ?? []
    wd.forEach((w: any) => {
      weeklyMap[w.date] = (weeklyMap[w.date] ?? 0) + w.giseleEarn
    })
  })
  const consolidatedWeekly = Object.entries(weeklyMap)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([date, giseleEarn]) => ({ date, giseleEarn }))

  // Ranking afiliados
  const ranking = AFFILIATES.map(a => ({
    ...a,
    summary: affiliatesData[a.login]?.summary ?? null,
  })).sort((a,b) => (b.summary?.giseleEarn ?? 0) - (a.summary?.giseleEarn ?? 0))

  const selectedData = selected ? affiliatesData[selected] : null
  const selectedUser = AFFILIATES.find(a => a.login === selected)

  return (
    <div style={{background:'#F7F8FF',minHeight:'100vh',fontFamily:"'Inter',sans-serif"}}>
      <style>{`*{box-sizing:border-box}.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cont{max-width:1160px;margin:0 auto;padding:1.5rem 1rem}@media(max-width:640px){.g4{grid-template-columns:repeat(2,1fr)}.g2{grid-template-columns:1fr}.cont{padding:1rem .75rem}}`}</style>

      <header style={{background:'#0D1B8E',padding:'.875rem 1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{background:'#E4003A',borderRadius:'8px',width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 10L10 4L16 10L10 16L4 10Z" fill="white"/></svg>
          </div>
          <span style={{color:'white',fontWeight:800,fontSize:'1rem'}}>Amplify <span style={{opacity:.5,fontWeight:400}}>admin</span></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{color:'rgba(255,255,255,.6)',fontSize:'12px',fontWeight:600}}>Super Afiliados · Visão Consolidada</span>
          <button onClick={()=>{sessionStorage.clear();router.push('/')}}
            style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:'8px',padding:'6px 12px',color:'white',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
            Sair
          </button>
        </div>
      </header>

      <div className="cont">
        {/* KPIs consolidados */}
        <div style={{marginBottom:'1rem',marginTop:'.5rem'}}>
          <div style={{fontSize:'10px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>Consolidado — todos os super afiliados</div>
          <div className="g4">
            <Card label="Total indicações" value={String(totals.total)} sub="somados" color="#0D0D1A" bg="white"/>
            <Card label="Agenciados" value={String(totals.agenciados)} sub="somados" color="#1B3FE4" bg="white"/>
            <Card label="GMV total" value={fmtBRL(totals.totalGmv)} sub="período atual" color="#1B3FE4" bg="#EEF1FD"/>
            <Card label="Comissões pagas" value={fmtBRL(totals.giseleEarn)} sub="total afiliados" color="#059669" bg="#ECFDF5"/>
          </div>
        </div>

        {/* Evolução semanal consolidada */}
        {consolidatedWeekly.length > 1 && (
          <div style={{background:'white',borderRadius:'14px',padding:'1.25rem',marginBottom:'1rem',border:'1px solid #E5E7EB'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'#0D1B8E',letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:'1rem'}}>Evolução semanal — comissões pagas (todos)</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={consolidatedWeekly}>
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D1B8E" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#0D1B8E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="date" tickFormatter={fmtWeek} tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip formatter={(v:number)=>[fmtBRL(v),'Comissão total']} labelFormatter={l=>fmtDate(l)}/>
                <Area type="monotone" dataKey="giseleEarn" stroke="#0D1B8E" strokeWidth={2.5} fill="url(#cg)" dot={{r:3,fill:'#0D1B8E',strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* RANKING + DETALHE */}
        <div className="g2">
          {/* Ranking */}
          <div style={{background:'white',borderRadius:'14px',border:'1px solid #E5E7EB',overflow:'hidden'}}>
            <div style={{padding:'.875rem 1rem',borderBottom:'1px solid #EEF1FD'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:'#0D1B8E',letterSpacing:'0.05em',textTransform:'uppercase'}}>Ranking — super afiliados</div>
            </div>
            {ranking.map((a, i) => {
              const s = a.summary
              const isSelected = selected === a.login
              return (
                <div key={a.login} onClick={()=>setSelected(isSelected ? null : a.login)}
                  style={{padding:'12px 16px',borderBottom:'1px solid #F3F4F6',cursor:'pointer',
                    background: isSelected ? '#EEF1FD' : i%2===0 ? 'white' : '#F9FAFB',
                    transition:'background 0.15s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <div style={{width:'28px',height:'28px',borderRadius:'50%',background:COLORS[i]+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:800,color:COLORS[i]}}>
                      {i+1}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:'13px',color:'#0D0D1A'}}>{a.name}</div>
                      <div style={{fontSize:'11px',color:'#9CA3AF'}}>{a.handle} · {s?.agenciados ?? 0} agenciados</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:800,fontSize:'13px',color:'#059669'}}>{s ? fmtBRL(s.giseleEarn) : '—'}</div>
                      <div style={{fontSize:'10px',color:'#9CA3AF'}}>GMV {s ? fmtBRL(s.totalGmv) : '—'}</div>
                    </div>
                  </div>
                  {/* Mini progress bar */}
                  {s && totals.giseleEarn > 0 && (
                    <div style={{marginTop:'8px',background:'#F3F4F6',borderRadius:'100px',height:'4px'}}>
                      <div style={{background:COLORS[i],borderRadius:'100px',height:'4px',width:`${(s.giseleEarn/totals.giseleEarn*100).toFixed(1)}%`}}/>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Detalhe do afiliado selecionado */}
          <div>
            {selectedData && selectedUser ? (
              <div style={{background:'white',borderRadius:'14px',border:`2px solid ${COLORS[ranking.findIndex(a=>a.login===selected)]}`,overflow:'hidden'}}>
                <div style={{padding:'.875rem 1rem',borderBottom:'1px solid #EEF1FD',background:COLORS[ranking.findIndex(a=>a.login===selected)]+'11'}}>
                  <div style={{fontSize:'11px',fontWeight:700,color:COLORS[ranking.findIndex(a=>a.login===selected)],letterSpacing:'0.05em',textTransform:'uppercase'}}>
                    {selectedUser.name} · Detalhe
                  </div>
                </div>
                <div style={{padding:'1rem'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'1rem'}}>
                    <MiniCard label="Indicações" value={String(selectedData.summary?.total ?? 0)} color="#0D0D1A"/>
                    <MiniCard label="Agenciados" value={String(selectedData.summary?.agenciados ?? 0)} color="#1B3FE4"/>
                    <MiniCard label="GMV" value={fmtBRL(selectedData.summary?.totalGmv ?? 0)} color="#1B3FE4"/>
                    <MiniCard label="Comissão" value={fmtBRL(selectedData.summary?.giseleEarn ?? 0)} color="#059669"/>
                  </div>
                  {/* Weekly chart do afiliado selecionado */}
                  {(selectedData.weeklyData?.length ?? 0) > 1 && (
                    <>
                      <div style={{fontSize:'10px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'8px'}}>Evolução semanal — comissão</div>
                      <ResponsiveContainer width="100%" height={120}>
                        <AreaChart data={selectedData.weeklyData}>
                          <XAxis dataKey="date" tickFormatter={fmtWeek} tick={{fontSize:9,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                          <YAxis hide/>
                          <Tooltip formatter={(v:number)=>[fmtBRL(v),'Comissão']} labelFormatter={l=>fmtDate(l)}/>
                          <Area type="monotone" dataKey="giseleEarn" stroke={COLORS[ranking.findIndex(a=>a.login===selected)]} strokeWidth={2} fill={COLORS[ranking.findIndex(a=>a.login===selected)]+'15'} dot={{r:2,fill:COLORS[ranking.findIndex(a=>a.login===selected)],strokeWidth:0}}/>
                        </AreaChart>
                      </ResponsiveContainer>
                    </>
                  )}
                  {/* Top 5 creators */}
                  {(selectedData.leads?.length ?? 0) > 0 && (
                    <>
                      <div style={{fontSize:'10px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'8px',marginTop:'12px'}}>Top creators</div>
                      {selectedData.leads.filter((l:any)=>l.gmv>0).slice(0,5).map((l:any, i:number) => (
                        <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<4?'1px solid #F3F4F6':'none'}}>
                          <span style={{fontSize:'12px',color:'#6B6B8A'}}>{l.handle || l.nome || '—'}</span>
                          <span style={{fontSize:'12px',fontWeight:700,color:'#0D0D1A'}}>{fmtBRL(l.gmv)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{background:'white',borderRadius:'14px',border:'1px solid #E5E7EB',height:'100%',minHeight:'300px',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'8px'}}>
                <div style={{fontSize:'1.5rem'}}>👆</div>
                <div style={{fontSize:'13px',color:'#9CA3AF',fontWeight:600}}>Clique em um afiliado para ver o detalhe</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({label,value,sub,color,bg}:{label:string,value:string,sub:string,color:string,bg:string}) {
  return (
    <div style={{background:bg,borderRadius:'12px',padding:'1rem',border:'1px solid #E5E7EB'}}>
      <div style={{fontSize:'9px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:'4px'}}>{label}</div>
      <div style={{fontSize:'1.3rem',fontWeight:800,color,lineHeight:1,letterSpacing:'-0.02em',marginBottom:'3px'}}>{value}</div>
      <div style={{fontSize:'10px',color:'#9CA3AF',fontWeight:500}}>{sub}</div>
    </div>
  )
}

function MiniCard({label,value,color}:{label:string,value:string,color:string}) {
  return (
    <div style={{background:'#F7F8FF',borderRadius:'8px',padding:'8px 10px'}}>
      <div style={{fontSize:'9px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'2px'}}>{label}</div>
      <div style={{fontSize:'1rem',fontWeight:800,color,letterSpacing:'-0.01em'}}>{value}</div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F7F8FF',flexDirection:'column',gap:'12px'}}>
      <div style={{width:'36px',height:'36px',border:'3px solid #EEF1FD',borderTop:'3px solid #0D1B8E',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
      <div style={{fontSize:'13px',color:'#6B6B8A',fontWeight:600}}>Carregando todos os afiliados...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
