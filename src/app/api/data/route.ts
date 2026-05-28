import { NextResponse, NextRequest } from 'next/server'
import { Client } from '@notionhq/client'
import * as XLSX from 'xlsx'

const notion    = new Client({ auth: process.env.NOTION_TOKEN })
const LEADS_DB  = process.env.NOTION_LEADS_DB_ID || '2efb0bbef153813a92a5c3e20c6130b2'
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID  || '1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj'
const GDRIVE_KEY= process.env.GDRIVE_API_KEY    || ''

// ── Drive: todos os XLSX, agrega por semana ───────────────────
async function fetchAllXlsxFromFolder() {
  try {
    const listUrl = `https://www.googleapis.com/drive/v3/files?` +
      `q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'` +
      `&orderBy=modifiedTime+desc&pageSize=50&fields=files(id,name,modifiedTime)` +
      `&key=${GDRIVE_KEY}`

    const listRes = await fetch(listUrl)
    if (!listRes.ok) return { sales: [], weeklyData: [] }
    const { files } = await listRes.json()
    if (!files?.length) return { sales: [], weeklyData: [] }

    const weeklyMap: Record<string, { gmv:number; com:number }> = {}
    let latestSales: any[] = []

    for (const file of files) {
      try {
        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_KEY}`)
        if (!dlRes.ok) continue
        const buf  = await dlRes.arrayBuffer()
        const wb   = XLSX.read(buf, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 })
        if (rows.length < 2) continue

        const header = rows[0] as string[]
        const idx = (n:string) => header.findIndex(h => String(h).toLowerCase().includes(n.toLowerCase()))
        const iNome = idx('criador')
        const iGmv  = idx('GMV de Afiliado') !== -1 ? idx('GMV de Afiliado') : idx('GMV')
        const iCom  = idx('Comissão estimada') !== -1 ? idx('Comissão estimada') : idx('Comiss')

        const sales = rows.slice(1)
          .filter(r => r[iNome] && !['Resumo','--','-'].includes(String(r[iNome])))
          .map(r => ({
            creator:  String(r[iNome] ?? '').toLowerCase().replace('@','').trim(),
            gmv:      parseBRL(r[iGmv]),
            comissao: parseBRL(r[iCom]),
          }))
          .filter(r => r.creator && r.creator !== '-' && r.creator !== '--')

        if (latestSales.length === 0) latestSales = sales

        const m = file.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
        if (m) {
          weeklyMap[m[2]] = {
            gmv: sales.reduce((s,r) => s + r.gmv, 0),
            com: sales.reduce((s,r) => s + r.comissao, 0),
          }
        }
      } catch { continue }
    }

    const weeklyData = Object.entries(weeklyMap)
      .map(([date, d]) => ({ date, ...d }))
      .sort((a,b) => a.date.localeCompare(b.date))

    return { sales: latestSales, weeklyData }
  } catch { return { sales: [], weeklyData: [] } }
}

// ── Notion: leads filtrados por UTM ──────────────────────────
async function fetchLeads(utmFilter: string) {
  const results: any[] = []
  let cursor: string | undefined
  do {
    const res = await notion.databases.query({
      database_id: LEADS_DB,
      start_cursor: cursor,
      page_size: 100,
    })
    results.push(...res.results)
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results
    .map((page: any) => {
      const p = page.properties
      const handle = p['@ TikTok']?.rich_text?.[0]?.plain_text ?? ''
      const nome   = p['Novos Creators (Leads)']?.title?.[0]?.plain_text ?? ''
      const status = p['Qual a fase do agenciamento']?.select?.name ?? 'Em Progresso'
      const utm    = p['UTM_Source']?.rich_text?.[0]?.plain_text ?? p['UTM_Campaign']?.rich_text?.[0]?.plain_text ?? ''
      return { id: page.id, handle: handle.replace(/^@/,'').trim(), nome, status, created: page.created_time, utm }
    })
    .filter(l => utmFilter ? l.utm.toLowerCase().includes(utmFilter.toLowerCase()) : true)
}

// ── Helpers ──────────────────────────────────────────────────
function parseBRL(v:any): number {
  if (!v) return 0
  return parseFloat(String(v).replace('R$','').replace(/\s/g,'').replace(/\./g,'').replace(',','.').trim()) || 0
}

function cleanHandle(h:string): string {
  h = h.toLowerCase().trim()
  const m = h.match(/tiktok\.com\/@([^/?&\s]+)/)
  if (m) return m[1]
  return h.replace('@','').split('?')[0].split('&')[0].trim()
}

function matchCreator(handle:string, sales:any[]): any|null {
  const h = cleanHandle(handle)
  let f = sales.find(s => s.creator === h)
  if (!f && h.length>=5) f = sales.find(s => s.creator.includes(h) || h.includes(s.creator))
  if (!f && h.length>=5) {
    const hc = h.replace(/[^a-z0-9_]/g,'')
    f = sales.find(s => s.creator.replace(/[^a-z0-9_]/g,'') === hc)
  }
  if (!f && h.length>=8) f = sales.find(s => s.creator.startsWith(h.slice(0,8)))
  return f ?? null
}

const INSIDE = new Set(['Agenciado','Convite Aceito'])

// ── GET ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const utm = req.nextUrl.searchParams.get('utm') ?? ''
    const [leads, { sales, weeklyData }] = await Promise.all([
      fetchLeads(utm),
      fetchAllXlsxFromFolder(),
    ])

    const enriched = leads.map(l => {
      const inside = INSIDE.has(l.status)
      const sale   = inside ? matchCreator(l.handle, sales) : null
      return { ...l, gmv: sale?.gmv ?? 0, comissao: sale?.comissao ?? 0 }
    })

    const agenciados = enriched.filter(l => INSIDE.has(l.status))
    const totalGmv   = agenciados.reduce((s,l) => s + l.gmv, 0)
    const totalCom   = agenciados.reduce((s,l) => s + l.comissao, 0)
    const giseleEarn = totalCom * 0.10 * 0.20

    const byDay: Record<string,number> = {}
    enriched.forEach(l => {
      const d = l.created?.slice(0,10)
      if (d) byDay[d] = (byDay[d] ?? 0) + 1
    })

    return NextResponse.json({
      summary: { total: enriched.length, agenciados: agenciados.length,
        conversion: enriched.length ? Math.round(agenciados.length/enriched.length*100) : 0,
        totalGmv, totalCom, giseleEarn, updatedAt: new Date().toISOString() },
      leads:  enriched.sort((a,b) => b.gmv - a.gmv),
      byDay:  Object.entries(byDay).sort(([a],[b])=>a.localeCompare(b)).map(([date,n])=>({date,n})),
      weeklyData: weeklyData.map(w => ({ date:w.date, gmv:w.gmv, comissao:w.com, giseleEarn: w.com*0.10*0.20 })),
    }, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' } })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
