import { NextResponse, NextRequest } from 'next/server'
import { Client } from '@notionhq/client'
import * as XLSX from 'xlsx'

const notion     = new Client({ auth: process.env.NOTION_TOKEN })
const INDIQUE_DB = '31ab0bbef15380a1ab97caa5c68e9813'
const FOLDER_ID  = process.env.GDRIVE_FOLDER_ID || '1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj'
const GDRIVE_KEY = process.env.GDRIVE_API_KEY   || ''
const INSIDE     = new Set(['Agenciado', 'Convite Aceito'])

// ── Notion ────────────────────────────────────────────────────
async function fetchLeads(utmFilter: string) {
  const results: any[] = []
  let cursor: string | undefined
  do {
    const res = await notion.databases.query({ database_id: INDIQUE_DB, start_cursor: cursor, page_size: 100 })
    results.push(...res.results)
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)

  const mapped = results.map((page: any) => {
    const p = page.properties
    const nome   = p['Nome Completo']?.title?.[0]?.plain_text ?? ''
    const handle = p['@ TikTok']?.rich_text?.[0]?.plain_text ?? ''
    const utm    = p['UTM_Source']?.rich_text?.[0]?.plain_text ?? ''
    const rollup = p['Qual a fase do agenciamento']?.rollup?.array ?? []
    const status = rollup.find((r: any) => r.select?.name)?.select?.name ?? ''
    return { id: page.id, handle: handle.replace(/^@/,'').trim(), nome, status, created: page.created_time, utm }
  })

  const filtered = utmFilter
    ? mapped.filter(l => l.utm.toLowerCase().includes(utmFilter.toLowerCase()))
    : mapped

  console.log(`Notion total: ${results.length} | filtered utm="${utmFilter}": ${filtered.length}`)
  return filtered
}

// ── Drive: carrega todos os arquivos desde sinceDate ─────────
// Retorna:
//   accumulatedSales: GMV acumulado por creator (soma de todas as semanas)
//   weeklySalesMap:   GMV por semana por creator (para gráfico evolutivo)
async function fetchXlsxFromFolder(sinceDate: string) {
  try {
    const listUrl = `https://www.googleapis.com/drive/v3/files?` +
      `q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'` +
      `&orderBy=modifiedTime+desc&pageSize=50&fields=files(id,name,modifiedTime)` +
      `&key=${GDRIVE_KEY}`

    const listRes = await fetch(listUrl)
    if (!listRes.ok) return { accumulatedSales: {}, weeklySalesMap: {} }
    const { files } = await listRes.json()
    if (!files?.length) return { accumulatedSales: {}, weeklySalesMap: {} }

    // Só arquivos cujo período cobre desde sinceDate
    const relevantFiles = files.filter((f: any) => {
      const m = f.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
      return m && m[2] >= sinceDate
    })

    console.log(`Drive: ${files.length} total | ${relevantFiles.length} since ${sinceDate}`)
    if (!relevantFiles.length) return { accumulatedSales: {}, weeklySalesMap: {} }

    // Baixa todos em paralelo
    const processed = await Promise.all(
      relevantFiles.map(async (file: any) => {
        try {
          const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_KEY}`)
          if (!dlRes.ok) return null
          const buf  = await dlRes.arrayBuffer()
          const wb   = XLSX.read(buf, { type: 'array' })
          const ws   = wb.Sheets[wb.SheetNames[0]]
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 })
          if (rows.length < 2) return null

          const header = rows[0] as string[]
          const idx    = (n: string) => header.findIndex(h => String(h).toLowerCase().includes(n.toLowerCase()))
          const iNome  = idx('criador')
          const iGmv   = idx('GMV de Afiliado') !== -1 ? idx('GMV de Afiliado') : idx('GMV')
          const iCom   = idx('Comissão estimada') !== -1 ? idx('Comissão estimada') : idx('Comiss')

          // Linha de resumo tem GMV total da Amplify
          const resumo = rows.find(r => String(r[0]).includes('Resumo') || String(r[1]) === '--')
          const amplifyGmvTotal  = resumo ? parseBRL(resumo[iGmv])  : 0
          const amplifyComTotal = resumo ? parseBRL(resumo[iCom]) : 0

          const sales = rows.slice(1)
            .filter(r => r[iNome] && !['Resumo','--','-'].includes(String(r[iNome])))
            .map(r => ({
              creator:  String(r[iNome] ?? '').toLowerCase().replace('@','').trim(),
              gmv:      parseBRL(r[iGmv]),
              comissao: parseBRL(r[iCom]),
            }))
            .filter(r => r.creator && r.creator !== '-' && r.creator !== '--')

          const m = file.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
          return { 
            weekStart: m?.[1] ?? null, 
            weekEnd: m?.[2] ?? null, 
            sales,
            amplifyGmv: amplifyGmvTotal,
            amplifyCom: amplifyComTotal,
          }
        } catch { return null }
      })
    )

    const valid = processed.filter(Boolean) as any[]

    // accumulatedSales: soma GMV de cada creator em TODOS os arquivos
    // Isso dá o GMV acumulado total desde sinceDate
    const accumulatedSales: Record<string, { gmv: number, comissao: number }> = {}
    valid.forEach(v => {
      v.sales.forEach((s: any) => {
        if (!accumulatedSales[s.creator]) accumulatedSales[s.creator] = { gmv: 0, comissao: 0 }
        accumulatedSales[s.creator].gmv      += s.gmv
        accumulatedSales[s.creator].comissao += s.comissao
      })
    })

    // weeklySalesMap: GMV por semana (para gráfico evolutivo)
    const weeklySalesMap: Record<string, any[]> = {}
    valid.forEach(v => { if (v.weekEnd) weeklySalesMap[v.weekEnd] = v.sales })

    // GMV e comissão total da Amplify por semana (para admin)
    const weeklyAmplify: Record<string, { gmv: number, com: number }> = {}
    valid.forEach(v => {
      if (v.weekEnd) weeklyAmplify[v.weekEnd] = { gmv: v.amplifyGmv, com: v.amplifyCom }
    })

    console.log(`Accumulated: ${Object.keys(accumulatedSales).length} creators across ${valid.length} files`)
    return { accumulatedSales, weeklySalesMap, weeklyAmplify }
  } catch (e) {
    console.error('fetchDrive error:', e)
    return { accumulatedSales: {}, weeklySalesMap: {}, weeklyAmplify: {} }
  }
}

// ── Helpers ──────────────────────────────────────────────────
function parseBRL(v: any): number {
  if (!v) return 0
  return parseFloat(String(v).replace('R$','').replace(/\s/g,'').replace(/\./g,'').replace(',','.').trim()) || 0
}

function cleanHandle(h: string): string {
  h = h.toLowerCase().trim()
  const m = h.match(/tiktok\.com\/@([^/?&\s]+)/)
  if (m) return m[1]
  return h.replace('@','').split('?')[0].split('&')[0].trim()
}

function matchCreator(handle: string, accumulatedSales: Record<string, any>): any | null {
  const h = cleanHandle(handle)
  if (!h) return null
  // Exact
  if (accumulatedSales[h]) return accumulatedSales[h]
  // Contains
  if (h.length >= 5) {
    const key = Object.keys(accumulatedSales).find(k => k.includes(h) || h.includes(k))
    if (key) return accumulatedSales[key]
  }
  // Fuzzy
  if (h.length >= 5) {
    const hc = h.replace(/[^a-z0-9_]/g,'')
    const key = Object.keys(accumulatedSales).find(k => k.replace(/[^a-z0-9_]/g,'') === hc)
    if (key) return accumulatedSales[key]
  }
  // Startswith
  if (h.length >= 8) {
    const key = Object.keys(accumulatedSales).find(k => k.startsWith(h.slice(0,8)))
    if (key) return accumulatedSales[key]
  }
  return null
}

// ── GET ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const utm = req.nextUrl.searchParams.get('utm') ?? ''
    const leads = await fetchLeads(utm)

    const dates = leads.map(l => l.created?.slice(0,10)).filter(Boolean).sort()
    const firstDate = dates[0] ?? new Date().toISOString().slice(0,10)

    const { accumulatedSales, weeklySalesMap, weeklyAmplify } = await fetchXlsxFromFolder(firstDate)

    // Enriquece leads com GMV acumulado
    const enriched = leads.map(l => {
      const inside = INSIDE.has(l.status)
      const sale   = inside ? matchCreator(l.handle, accumulatedSales) : null
      return { ...l, gmv: sale?.gmv ?? 0, comissao: sale?.comissao ?? 0 }
    })

    const agenciados = enriched.filter(l => INSIDE.has(l.status))
    const totalGmv   = agenciados.reduce((s,l) => s + l.gmv, 0)
    const totalCom   = agenciados.reduce((s,l) => s + l.comissao, 0)
    const giseleEarn = totalCom * 0.10 * 0.20

    // Gráfico semanal: só creators agenciados, GMV acumulado semana a semana
    const agenciadoHandles = agenciados.map(l => cleanHandle(l.handle)).filter(Boolean)

    function matchHandle(creator: string, handles: string[]): boolean {
      return handles.some(h => {
        const sc = creator
        return sc === h ||
          (h.length >= 5 && (sc.includes(h) || h.includes(sc))) ||
          (h.length >= 5 && sc.replace(/[^a-z0-9_]/g,'') === h.replace(/[^a-z0-9_]/g,'')) ||
          (h.length >= 8 && sc.startsWith(h.slice(0,8)))
      })
    }

    const weeklyData = Object.entries(weeklySalesMap)
      .map(([date, weekSales]) => {
        const filtered = (weekSales as any[]).filter(s => matchHandle(s.creator, agenciadoHandles))
        const gmv = filtered.reduce((s, r) => s + r.gmv, 0)
        const com = filtered.reduce((s, r) => s + r.comissao, 0)
        return { date, gmv, comissao: com, giseleEarn: com * 0.10 * 0.20 }
      })
      .sort((a,b) => a.date.localeCompare(b.date))

    // GMV total Amplify por semana (para admin)
    const weeklyAmplifyData = Object.entries(weeklyAmplify ?? {})
      .map(([date, v]: [string, any]) => ({ date, gmv: v.gmv, com: v.com, amplifyRevenue: v.com * 0.10 }))
      .sort((a,b) => a.date.localeCompare(b.date))

    // Totais Amplify no período
    const amplifyTotalGmv     = weeklyAmplifyData.reduce((s,w) => s + w.gmv, 0)
    const amplifyTotalRevenue = weeklyAmplifyData.reduce((s,w) => s + w.amplifyRevenue, 0)

    const byDay: Record<string,number> = {}
    enriched.forEach(l => {
      const d = l.created?.slice(0,10)
      if (d) byDay[d] = (byDay[d] ?? 0) + 1
    })

    return NextResponse.json({
      summary: {
        total: enriched.length, agenciados: agenciados.length,
        conversion: enriched.length ? Math.round(agenciados.length / enriched.length * 100) : 0,
        totalGmv, totalCom, giseleEarn,
        amplifyTotalGmv, amplifyTotalRevenue,
        updatedAt: new Date().toISOString(), firstDate,
      },
      leads:  enriched.sort((a,b) => b.gmv - a.gmv),
      byDay:  Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b)).map(([date,n]) => ({ date, n })),
      weeklyData,
      weeklyAmplifyData,
    }, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' } })
  } catch (e: any) {
    console.error('GET /api/data error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
