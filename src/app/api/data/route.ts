import { NextResponse, NextRequest } from 'next/server'
import { Client } from '@notionhq/client'
import * as XLSX from 'xlsx'

const notion    = new Client({ auth: process.env.NOTION_TOKEN })

// Database correto: Creators I Indique & Ganhe
const INDIQUE_DB = '31ab0bbef15380a1ab97caa5c68e9813'
const FOLDER_ID  = process.env.GDRIVE_FOLDER_ID || '1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj'
const GDRIVE_KEY = process.env.GDRIVE_API_KEY   || ''

const INSIDE = new Set(['Agenciado', 'Convite Aceito'])

// ── Notion: database Creators I Indique & Ganhe ──────────────
async function fetchLeads(utmFilter: string) {
  const results: any[] = []
  let cursor: string | undefined
  do {
    const res = await notion.databases.query({
      database_id: INDIQUE_DB,
      start_cursor: cursor,
      page_size: 100,
    })
    results.push(...res.results)
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)

  const mapped = results.map((page: any) => {
    const p = page.properties

    // Nome Completo = title
    const nome   = p['Nome Completo']?.title?.[0]?.plain_text ?? ''
    // @ TikTok = text
    const handle = p['@ TikTok']?.rich_text?.[0]?.plain_text ?? ''
    // UTM_Source = text
    const utm    = p['UTM_Source']?.rich_text?.[0]?.plain_text ?? ''

    // Qual a fase do agenciamento = rollup (array de selects)
    const rollup = p['Qual a fase do agenciamento']?.rollup?.array ?? []
    const status = rollup.find((r: any) => r.select?.name)?.select?.name ?? ''

    return {
      id:      page.id,
      handle:  handle.replace(/^@/,'').trim(),
      nome,
      status,
      created: page.created_time,
      utm,
    }
  })

  const filtered = utmFilter
    ? mapped.filter(l => l.utm.toLowerCase().includes(utmFilter.toLowerCase()))
    : mapped

  console.log(`Total: ${results.length} | utm="${utmFilter}": ${filtered.length}`)
  if (filtered.length > 0) console.log('Sample:', filtered[0])

  return filtered
}

// ── Drive: arquivos a partir da data da primeira indicação ────
async function fetchXlsxFromFolder(sinceDate: string) {
  try {
    const listUrl = `https://www.googleapis.com/drive/v3/files?` +
      `q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'` +
      `&orderBy=modifiedTime+desc&pageSize=50&fields=files(id,name,modifiedTime)` +
      `&key=${GDRIVE_KEY}`

    const listRes = await fetch(listUrl)
    if (!listRes.ok) return { sales: [], weeklySalesMap: {} }
    const { files } = await listRes.json()
    if (!files?.length) return { sales: [], weeklySalesMap: {} }

    const relevantFiles = files.filter((f: any) => {
      const m = f.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
      return m && m[2] >= sinceDate
    })

    console.log(`Drive: ${files.length} total | ${relevantFiles.length} since ${sinceDate}`)
    if (!relevantFiles.length) return { sales: [], weeklySalesMap: {} }

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

          const sales = rows.slice(1)
            .filter(r => r[iNome] && !['Resumo','--','-'].includes(String(r[iNome])))
            .map(r => ({
              creator:  String(r[iNome] ?? '').toLowerCase().replace('@','').trim(),
              gmv:      parseBRL(r[iGmv]),
              comissao: parseBRL(r[iCom]),
            }))
            .filter(r => r.creator && r.creator !== '-' && r.creator !== '--')

          const m = file.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
          return { weekEnd: m?.[2] ?? null, sales }
        } catch { return null }
      })
    )

    const valid = processed.filter(Boolean) as any[]
    const sortedDesc = valid.sort((a,b) => (b.weekEnd ?? '').localeCompare(a.weekEnd ?? ''))
    const latestSales = sortedDesc[0]?.sales ?? []

    const weeklySalesMap: Record<string, any[]> = {}
    sortedDesc.forEach(v => { if (v.weekEnd) weeklySalesMap[v.weekEnd] = v.sales })

    return { sales: latestSales, weeklySalesMap }
  } catch (e) {
    console.error('fetchDrive error:', e)
    return { sales: [], weeklySalesMap: {} }
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

function matchCreator(handle: string, sales: any[]): any | null {
  const h = cleanHandle(handle)
  if (!h) return null
  let f = sales.find(s => s.creator === h)
  if (!f && h.length >= 5) f = sales.find(s => s.creator.includes(h) || h.includes(s.creator))
  if (!f && h.length >= 5) {
    const hc = h.replace(/[^a-z0-9_]/g,'')
    f = sales.find(s => s.creator.replace(/[^a-z0-9_]/g,'') === hc)
  }
  if (!f && h.length >= 8) f = sales.find(s => s.creator.startsWith(h.slice(0,8)))
  return f ?? null
}

// ── GET ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const utm = req.nextUrl.searchParams.get('utm') ?? ''

    const leads = await fetchLeads(utm)

    const dates = leads.map(l => l.created?.slice(0,10)).filter(Boolean).sort()
    const firstDate = dates[0] ?? new Date().toISOString().slice(0,10)

    const { sales, weeklySalesMap } = await fetchXlsxFromFolder(firstDate)

    const enriched = leads.map(l => {
      const inside = INSIDE.has(l.status)
      const sale   = inside ? matchCreator(l.handle, sales) : null
      return { ...l, gmv: sale?.gmv ?? 0, comissao: sale?.comissao ?? 0 }
    })

    const agenciados = enriched.filter(l => INSIDE.has(l.status))
    const totalGmv   = agenciados.reduce((s,l) => s + l.gmv, 0)
    const totalCom   = agenciados.reduce((s,l) => s + l.comissao, 0)
    const giseleEarn = totalCom * 0.10 * 0.20

    // Gráfico semanal filtrado só pelos creators agenciados dela
    const agenciadoHandles = agenciados.map(l => cleanHandle(l.handle)).filter(Boolean)
    const weeklyData = Object.entries(weeklySalesMap)
      .map(([date, weekSales]) => {
        const filtered = weekSales.filter((s: any) =>
          agenciadoHandles.some(h => {
            const sc = s.creator
            return sc === h ||
              (h.length >= 5 && (sc.includes(h) || h.includes(sc))) ||
              (h.length >= 5 && sc.replace(/[^a-z0-9_]/g,'') === h.replace(/[^a-z0-9_]/g,'')) ||
              (h.length >= 8 && sc.startsWith(h.slice(0,8)))
          })
        )
        const gmv = filtered.reduce((s: number, r: any) => s + r.gmv, 0)
        const com = filtered.reduce((s: number, r: any) => s + r.comissao, 0)
        return { date, gmv, comissao: com, giseleEarn: com * 0.10 * 0.20 }
      })
      .sort((a,b) => a.date.localeCompare(b.date))

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
        updatedAt: new Date().toISOString(), firstDate,
      },
      leads:  enriched.sort((a,b) => b.gmv - a.gmv),
      byDay:  Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b)).map(([date,n]) => ({ date, n })),
      weeklyData,
    }, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' } })
  } catch (e: any) {
    console.error('GET /api/data error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
