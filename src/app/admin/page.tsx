'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { USERS } from '../lib/auth'

const fmtBRL  = (n:number) => 'R$' + n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtWeek = (iso:string) => { const d = new Date(iso+'T00:00:00'); return `${d.getDate()}/${d.getMonth()+1}` }
const fmtDate = (iso:string) => new Date(iso+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})

const AFFILIATES = Object.entries(USERS)
  .filter(([,v]) => v.role === 'affiliate')
  .map(([login, v]) => ({ login, ...v }))

const COLORS = ['#1B3FE4','#E4003A','#059669','#D97706','#7C3AED']

type Metric = 'giseleEarn' | 'gmv' | 'comissao' | 'amplifyGmv' | 'amplifyRevenue'
const METRIC_LABELS: Record<string, string> = { giseleEarn:'Comissão afiliado', gmv:'GMV dos indicados', comissao:'Comissão TikTok', amplifyGmv:'GMV total Amplify', amplifyRevenue:'Receita Amplify' }

export default function Admin() {
  const router = useRouter()
  const [affiliatesData, setAffiliatesData] = useState<Record<string, any>>({})
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<string|null>(null)
  const [metric, setMetric]     = useState<string>('gmv')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedDates, setAppliedDates] = useState({ start:'', end:'' })

  useEffect(() => {
    const stored = sessionStorage.getItem('amplify_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.role !== 'admin') { router.push('/dashboard'); return }

    Promise.all(
      AFFILIATES.map(a =>
        fetch(`/api/data?utm=${encodeURIComponent(a.utm)}${appliedDates.start?'&startDate='+appliedDates.start:''}${appliedDates.end?'&endDate='+appliedDates.end:''}`)
          .then(r => r.json())
          .then(d => ({ login: a.login, data: d }))
          .catch(() => ({ login: a.login, data: null }))
      )
    ).then(results => {
      const map: Record<string, any> = {}
      results.forEach(r => { map[r.login] = r.data })
      setAffiliatesData(map)
      // Seleciona o primeiro por padrão
      setSelected(AFFILIATES[0]?.login ?? null)
      setLoading(false)
    })
  }, [router, appliedDates])

  if (loading) return <LoadingScreen />

  // Consolidado
  const totals = AFFILIATES.reduce((acc, a) => {
    const d = affiliatesData[a.login]?.summary
    if (!d) return acc
    return { total: acc.total+d.total, agenciados: acc.agenciados+d.agenciados, totalGmv: acc.totalGmv+d.totalGmv, giseleEarn: acc.giseleEarn+d.giseleEarn }
  }, { total:0, agenciados:0, totalGmv:0, giseleEarn:0 })

  // Amplify GMV total (usa dados do primeiro afiliado — mesmos arquivos)
  const firstAffData      = affiliatesData[AFFILIATES[0]?.login]
  const weeklyAmplifyData = firstAffData?.weeklyAmplifyData ?? []
  const amplifyTotalGmv   = firstAffData?.summary?.amplifyTotalGmv ?? 0
  const amplifyTotalRev   = firstAffData?.summary?.amplifyTotalRevenue ?? 0

  // Dados do afiliado selecionado (ou consolidado)
  const selectedAffiliate = AFFILIATES.find(a => a.login === selected)
  const selectedData      = selected ? affiliatesData[selected] : null
  const selectedColor     = selected ? COLORS[AFFILIATES.findIndex(a => a.login === selected) % COLORS.length] : '#1B3FE4'

  // Gráfico: se tem afiliado selecionado, mostra dados dele; senão consolidado
  const consolidatedChartData = (() => {
    // Mescla weeklyData dos afiliados + weeklyAmplifyData
    const map: Record<string, any> = {}
    AFFILIATES.forEach(a => {
      const wd = affiliatesData[a.login]?.weeklyData ?? []
      wd.forEach((w: any) => {
        if (!map[w.date]) map[w.date] = { date: w.date, giseleEarn:0, gmv:0, comissao:0, amplifyGmv:0, amplifyRevenue:0 }
        map[w.date].giseleEarn += w.giseleEarn
        map[w.date].gmv       += w.gmv
        map[w.date].comissao  += w.comissao
      })
    })
    weeklyAmplifyData.forEach((w: any) => {
      if (!map[w.date]) map[w.date] = { date: w.date, giseleEarn:0, gmv:0, comissao:0, amplifyGmv:0, amplifyRevenue:0 }
      map[w.date].amplifyGmv     = w.gmv
      map[w.date].amplifyRevenue = w.amplifyRevenue
    })
    return Object.values(map).sort((a:any,b:any) => a.date.localeCompare(b.date))
  })()

  const chartData = selected ? (selectedData?.weeklyData ?? []) : consolidatedChartData
  const availableMetrics: string[] = selected
    ? ['giseleEarn','gmv','comissao']
    : ['gmv','giseleEarn','comissao','amplifyGmv','amplifyRevenue']

  // Ranking
  const ranking = AFFILIATES
    .map(a => ({ ...a, summary: affiliatesData[a.login]?.summary ?? null }))
    .sort((a,b) => (b.summary?.giseleEarn ?? 0) - (a.summary?.giseleEarn ?? 0))

  return (
    <div style={{background:'#F7F8FF',minHeight:'100vh',fontFamily:"'Inter',sans-serif"}}>
      <style>{`*{box-sizing:border-box}.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cont{max-width:1160px;margin:0 auto;padding:1.5rem 1rem}@media(max-width:640px){.g4{grid-template-columns:repeat(2,1fr)}.g2{grid-template-columns:1fr}.cont{padding:1rem .75rem}}`}</style>

      <header style={{background:'#0D1B8E',padding:'.875rem 1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center'}}>
          <img src="/amplify-logo.png" alt="Amplify" style={{height:'34px',objectFit:'contain'}} />
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
          <span style={{color:'rgba(255,255,255,.6)',fontSize:'11px',fontWeight:600}}>Período:</span>
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
            style={{fontSize:'11px',padding:'3px 7px',borderRadius:'6px',border:'none',background:'rgba(255,255,255,.15)',color:'white',outline:'none',fontFamily:'inherit'}}/>
          <span style={{color:'rgba(255,255,255,.4)',fontSize:'11px'}}>até</span>
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
            style={{fontSize:'11px',padding:'3px 7px',borderRadius:'6px',border:'none',background:'rgba(255,255,255,.15)',color:'white',outline:'none',fontFamily:'inherit'}}/>
          <button onClick={()=>{setLoading(true);setAffiliatesData({});setAppliedDates({start:startDate,end:endDate})}}
            style={{fontSize:'11px',fontWeight:700,padding:'3px 10px',borderRadius:'6px',border:'none',background:'white',color:'#0D1B8E',cursor:'pointer'}}>
            Filtrar
          </button>
          {(appliedDates.start||appliedDates.end) && (
            <button onClick={()=>{setStartDate('');setEndDate('');setLoading(true);setAffiliatesData({});setAppliedDates({start:'',end:''})}}
              style={{fontSize:'11px',fontWeight:600,padding:'3px 8px',borderRadius:'6px',border:'none',background:'rgba(255,255,255,.15)',color:'white',cursor:'pointer'}}>
              Limpar ×
            </button>
          )}
        </div>
          <button onClick={()=>{sessionStorage.clear();router.push('/')}}
            style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:'8px',padding:'6px 12px',color:'white',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
            Sair
          </button>
        </div>
      </header>

      <div className="cont">

        {/* KPIs consolidados */}
        <div style={{marginTop:'.5rem',marginBottom:'1rem'}}>
          <div style={{fontSize:'10px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>Consolidado — todos os super afiliados</div>
          <div className="g4">
            <Card label="Total indicações" value={String(totals.total)} sub="somados" color="#0D0D1A" bg="white"/>
            <Card label="Agenciados" value={String(totals.agenciados)} sub="somados" color="#1B3FE4" bg="white"/>
            <Card label="GMV indicados" value={fmtBRL(totals.totalGmv)} sub="creators de super afiliados" color="#1B3FE4" bg="#EEF1FD"/>
            <Card label="Comissões pagas" value={fmtBRL(totals.giseleEarn)} sub="total afiliados" color="#059669" bg="#ECFDF5"/>
          </div>
        </div>

        {/* KPIs Amplify */}
        {amplifyTotalGmv > 0 && (
          <div style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'10px',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>Performance Amplify — todos os creators</div>
            <div className="g4">
              <Card label="GMV total da base" value={fmtBRL(amplifyTotalGmv)} sub="todos os creators" color="#0D1B8E" bg="white"/>
              <Card label="Receita Amplify" value={fmtBRL(amplifyTotalRev)} sub="10% do GMV" color="#0D1B8E" bg="#EEF1FD"/>
              <Card label="Comissões pagas" value={fmtBRL(totals.giseleEarn)} sub="para super afiliados" color="#E4003A" bg="#FFF1F3"/>
              <Card label="Margem líquida" value={fmtBRL(amplifyTotalRev - totals.giseleEarn)} sub="receita − comissões" color="#059669" bg="#ECFDF5"/>
            </div>
          </div>
        )}

        {/* GRÁFICO DINÂMICO — muda conforme afiliado clicado */}
        <div style={{background:'white',borderRadius:'14px',padding:'1.25rem',marginBottom:'1rem',border:`2px solid ${selected ? selectedColor : '#E5E7EB'}`,transition:'border-color 0.2s'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:'8px'}}>
            <div>
              <div style={{fontSize:'11px',fontWeight:700,color: selected ? selectedColor : '#0D1B8E',letterSpacing:'0.05em',textTransform:'uppercase'}}>
                {selected ? `${selectedAffiliate?.name} — Evolução semanal` : 'Evolução semanal — consolidado'}
              </div>
              {selected && selectedData?.summary && (
                <div style={{fontSize:'12px',color:'#6B6B8A',marginTop:'2px'}}>
                  {selectedData.summary.agenciados} agenciados · GMV {fmtBRL(selectedData.summary.totalGmv)} · Comissão {fmtBRL(selectedData.summary.giseleEarn)}
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {selected && (
                <button onClick={()=>setSelected(null)}
                  style={{fontSize:'11px',fontWeight:700,padding:'4px 10px',borderRadius:'100px',border:`1px solid ${selectedColor}`,cursor:'pointer',background:'white',color:selectedColor}}>
                  Ver consolidado
                </button>
              )}
              {availableMetrics.map(m => (
                <button key={m} onClick={()=>setMetric(m as any)}
                  style={{fontSize:'11px',fontWeight:700,padding:'4px 10px',borderRadius:'100px',border:'none',cursor:'pointer',
                    background: metric===m ? (selected ? selectedColor : '#0D1B8E') : '#F3F4F6',
                    color: metric===m ? 'white' : '#6B6B8A'}}>
                  {(METRIC_LABELS as Record<string, string>)[m]}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 1 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="agrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selected ? selectedColor : '#0D1B8E'} stopOpacity={0.12}/>
                      <stop offset="95%" stopColor={selected ? selectedColor : '#0D1B8E'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                  <XAxis dataKey="date" tickFormatter={fmtWeek} tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip formatter={(v:number)=>[fmtBRL(v),(METRIC_LABELS as Record<string, string>)[metric]]} labelFormatter={l=>fmtDate(l)}/>
                  <Area type="monotone" dataKey={metric} stroke={selected ? selectedColor : '#0D1B8E'} strokeWidth={2.5} fill="url(#agrad)"
                    dot={{r:3,fill:selected ? selectedColor : '#0D1B8E',strokeWidth:0}}/>
                </AreaChart>
              </ResponsiveContainer>
              {chartData.length >= 2 && (() => {
                const last = chartData[chartData.length-1]
                const prev = chartData[chartData.length-2]
                const diff = (last[metric]??0) - (prev[metric]??0)
                const pct  = prev[metric] ? (diff/prev[metric]*100) : 0
                return (
                  <div style={{marginTop:'10px',display:'flex',gap:'16px',flexWrap:'wrap',fontSize:'12px'}}>
                    <span style={{color:'#6B6B8A'}}>Última semana: <strong style={{color:'#0D0D1A'}}>{fmtBRL(last[metric]??0)}</strong></span>
                    <span style={{fontWeight:700,color:diff>=0?'#059669':'#E4003A'}}>
                      {diff>=0?'▲':'▼'} {fmtBRL(Math.abs(diff))} ({Math.abs(pct).toFixed(1)}%) vs semana anterior
                    </span>
                  </div>
                )
              })()}
            </>
          ) : (
            <div style={{height:'180px',display:'flex',alignItems:'center',justifyContent:'center',color:'#9CA3AF',fontSize:'13px'}}>
              Dados insuficientes para gráfico
            </div>
          )}
        </div>

        {/* RANKING */}
        <div className="g2">
          <div style={{background:'white',borderRadius:'14px',border:'1px solid #E5E7EB',overflow:'hidden'}}>
            <div style={{padding:'.875rem 1rem',borderBottom:'1px solid #EEF1FD',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:'#0D1B8E',letterSpacing:'0.05em',textTransform:'uppercase'}}>Ranking — clique para filtrar</div>
              {selected && (
                <button onClick={()=>setSelected(null)}
                  style={{fontSize:'11px',color:'#9CA3AF',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>
                  Limpar filtro ×
                </button>
              )}
            </div>
            {ranking.map((a,i) => {
              const s = a.summary
              const color = COLORS[i % COLORS.length]
              const isSelected = selected === a.login
              return (
                <div key={a.login} onClick={()=>setSelected(isSelected ? null : a.login)}
                  style={{padding:'12px 16px',borderBottom:'1px solid #F3F4F6',cursor:'pointer',
                    background: isSelected ? color+'15' : i%2===0 ? 'white' : '#F9FAFB',
                    borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
                    transition:'all 0.15s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <div style={{width:'28px',height:'28px',borderRadius:'50%',background:color+'22',display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:'12px',fontWeight:800,color, flexShrink:0}}>
                      {i+1}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'13px',color: isSelected ? color : '#0D0D1A'}}>{a.name}</div>
                      <div style={{fontSize:'11px',color:'#9CA3AF'}}>{a.handle} · {s?.agenciados ?? 0} agenciados</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontWeight:800,fontSize:'13px',color:'#059669'}}>{s ? fmtBRL(s.giseleEarn) : '—'}</div>
                      <div style={{fontSize:'10px',color:'#9CA3AF'}}>GMV {s ? fmtBRL(s.totalGmv) : '—'}</div>
                    </div>
                  </div>
                  {s && totals.giseleEarn > 0 && (
                    <div style={{marginTop:'8px',background:'#F3F4F6',borderRadius:'100px',height:'3px'}}>
                      <div style={{background:color,borderRadius:'100px',height:'3px',width:`${Math.min(s.giseleEarn/totals.giseleEarn*100,100).toFixed(1)}%`,transition:'width 0.3s'}}/>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Detalhe do selecionado */}
          <div>
            {selectedData && selectedAffiliate ? (
              <div style={{background:'white',borderRadius:'14px',border:`2px solid ${selectedColor}`,overflow:'hidden'}}>
                <div style={{padding:'.875rem 1rem',borderBottom:'1px solid #EEF1FD',background:selectedColor+'11'}}>
                  <div style={{fontSize:'11px',fontWeight:700,color:selectedColor,letterSpacing:'0.05em',textTransform:'uppercase'}}>
                    {selectedAffiliate.name} · Top Creators
                  </div>
                </div>
                <div style={{padding:'1rem'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'1rem'}}>
                    <MiniCard label="Indicações" value={String(selectedData.summary?.total ?? 0)} color="#0D0D1A"/>
                    <MiniCard label="Agenciados" value={String(selectedData.summary?.agenciados ?? 0)} color="#1B3FE4"/>
                    <MiniCard label="GMV creators" value={fmtBRL(selectedData.summary?.totalGmv ?? 0)} color="#1B3FE4"/>
                    <MiniCard label="Comissão TikTok" value={fmtBRL(selectedData.summary?.totalCom ?? 0)} color="#7C3AED"/>
                    <MiniCard label="Receita Amplify" value={fmtBRL(selectedData.summary?.affiliateAmplifyRevenue ?? 0)} color="#0D1B8E"/>
                    <MiniCard label="Comissão afiliado" value={fmtBRL(selectedData.summary?.giseleEarn ?? 0)} color="#059669"/>
                  </div>
                  {(selectedData.leads?.filter((l:any)=>l.gmv>0).length ?? 0) > 0 ? (
                    selectedData.leads.filter((l:any)=>l.gmv>0).slice(0,8).map((l:any,i:number,arr:any[]) => (
                      <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                        padding:'7px 0',borderBottom:i<arr.length-1?'1px solid #F3F4F6':'none'}}>
                        <div>
                          <div style={{fontSize:'12px',fontWeight:600,color:'#0D0D1A'}}>{l.nome || l.handle || '—'}</div>
                          <div style={{fontSize:'10px',color:'#9CA3AF'}}>{l.handle}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:'12px',fontWeight:700,color:'#0D0D1A'}}>{fmtBRL(l.gmv)}</div>
                          <div style={{fontSize:'10px',color:'#059669'}}>{fmtBRL(l.comissao)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{textAlign:'center',padding:'1rem',color:'#9CA3AF',fontSize:'12px'}}>
                      Sem GMV registrado ainda
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{background:'white',borderRadius:'14px',border:'1px solid #E5E7EB',minHeight:'300px',
                display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'8px'}}>
                <div style={{fontSize:'1.5rem'}}>👆</div>
                <div style={{fontSize:'13px',color:'#9CA3AF',fontWeight:600}}>Clique num afiliado para ver o detalhe</div>
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
