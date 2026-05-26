import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import * as XLSX from 'xlsx'

const notion    = new Client({ auth: process.env.NOTION_TOKEN })
const LEADS_DB  = process.env.NOTION_LEADS_DB_ID || '31ab0bbef15380a1ab97caa5c68e9813'
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID  || '1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj'
const GDRIVE_KEY= process.env.GDRIVE_API_KEY    || ''

async function fetchLatestXlsxFromFolder(): Promise<any[]> {
  try {
    const listUrl = `https://www.googleapis.com/drive/v3/files?` +
      `q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'` +
      `&orderBy=modifiedTime+desc&pageSize=1&fields=files(id,name,modifiedTime)` +
      `&key=${GDRIVE_KEY}`

    const listRes = await fetch(listUrl)
    if (!listRes.ok) { console.error('Drive list error:', await listRes.json()); return [] }
    const { files } = await listRes.json()
    if (!files?.length) return []

    const fileId = files[0].id
    console.log('Using Drive file:', files[0].name)

    const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GDRIVE_KEY}`)
    if (!dlRes.ok) return []

    const buf  = await dlRes.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 })
    if (rows.length < 2) return []

    const header = rows[0] as string[]
    const idx = (name: string) =>
      header.findIndex(h => String(h).toLowerCase().includes(name.toLowerCase()))

    const iNome = idx('nome do criador')
    const iGmv  = idx('gmv) de afiliado') !== -1 ? idx('gmv) de afiliado') : idx('gmv')
    const iCom  = idx('comissão estimada') !== -1 ? idx('comissão estimada') : idx('comiss')
    const iData = idx('data')

    console.log('Excel col indexes - Nome:', iNome, 'GMV:', iGmv, 'Com:', iCom, 'Data:', iData)

    return rows.slice(1)
      .filter(r => r[iData] && !['Resumo','--','-'].includes(String(r[iData])))
      .map(r => ({
        creator:  String(r[iNome] ?? '').toLowerCase().replace('@','').trim(),
        gmv:      parseBRL(r[iGmv]),
        comissao: parseBRL(r[iCom]),
      }))
      .filter(r => r.creator && r.creator !== '-' && r.creator !== '--')
  } catch (e) {
    console.error('fetchDrive error:', e)
    return []
  }
}

async function fetchGiseleLeads() {
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

  // Log das propriedades do primeiro resultado para debug
  if (results.length > 0) {
    const props = Object.keys((results[0] as any).properties)
    console.log('Notion properties:', props)
  }

  const allLeads = results.map((page: any) => {
    const p = page.properties
    // Tenta vários nomes possíveis para cada campo
    const handle =
      p['@ TikTok']?.rich_text?.[0]?.plain_text ??
      p['@TikTok']?.rich_text?.[0]?.plain_text ?? ''

    const nome =
      p['Novos Creators (Leads)']?.title?.[0]?.plain_text ??
      p['Nome']?.title?.[0]?.plain_text ?? ''

    const statusProp = p['Qual a fase do agenciamento']
    // Rollup pode vir como array de selects
    const status =
      statusProp?.select?.name ??
      statusProp?.status?.name ??
      statusProp?.rollup?.array?.[0]?.select?.name ??
      statusProp?.rollup?.array?.[0]?.status?.name ??
      statusProp?.rollup?.array?.[0]?.rich_text?.[0]?.plain_text ??
      statusProp?.rich_text?.[0]?.plain_text ?? ''
    if (!status && statusProp) console.log('Status raw:', JSON.stringify(statusProp))

    const utm =
      p['UTM_Source']?.rich_text?.[0]?.plain_text ??
      p['UTM_Campaign']?.rich_text?.[0]?.plain_text ?? ''

    const finalStatus = status || 'Em Progresso'
    const cleanHandle = handle.replace(/^@/, '').trim()
    return { id: page.id, handle: cleanHandle, nome, status: finalStatus, created: page.created_time, utm }
  })

  const giseleLeads = allLeads.filter(l => l.utm.toLowerCase().includes('gisele'))
  console.log('Total leads:', allLeads.length, '| Gisele leads:', giseleLeads.length)
  
  // Log dos primeiros para ver status
  giseleLeads.slice(0, 5).forEach(l => 
    console.log('Lead:', l.handle, '| Status:', l.status, '| UTM:', l.utm)
  )

  return giseleLeads
}

function parseBRL(v: any): number {
  if (!v) return 0
  const s = String(v).replace('R$','').replace(/\s/g,'').replace(/\./g,'').replace(',','.').trim()
  return parseFloat(s) || 0
}

function cleanHandle(h: string): string {
  h = h.toLowerCase().trim()
  const m = h.match(/tiktok\.com\/@([^/?&\s]+)/)
  if (m) return m[1]
  return h.replace('@','').split('?')[0].split('&')[0].trim()
}

function matchCreator(handle: string, sales: any[]): any | null {
  const h = cleanHandle(handle)
  let f = sales.find(s => s.creator === h)
  if (!f && h.length >= 5) f = sales.find(s => s.creator.includes(h) || h.includes(s.creator))
  if (!f && h.length >= 5) {
    const hc = h.replace(/[^a-z0-9_]/g,'')
    f = sales.find(s => s.creator.replace(/[^a-z0-9_]/g,'') === hc)
  }
  if (!f && h.length >= 8) f = sales.find(s => s.creator.startsWith(h.slice(0,8)))
  return f ?? null
}

const INSIDE = new Set(['Agenciado','Convite Aceito'])

export async function GET() {
  try {
    const [leads, sales] = await Promise.all([
      fetchGiseleLeads(),
      fetchLatestXlsxFromFolder(),
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

    const byDay: Record<string, number> = {}
    enriched.forEach(l => {
      const d = l.created?.slice(0,10)
      if (d) byDay[d] = (byDay[d] ?? 0) + 1
    })

    return NextResponse.json({
      summary: {
        total:      enriched.length,
        agenciados: agenciados.length,
        conversion: enriched.length ? Math.round(agenciados.length / enriched.length * 100) : 0,
        totalGmv, totalCom, giseleEarn,
        updatedAt: new Date().toISOString(),
      },
      leads: enriched.sort((a,b) => b.gmv - a.gmv),
      byDay: Object.entries(byDay)
               .sort(([a],[b]) => a.localeCompare(b))
               .map(([date,n]) => ({ date, n })),
    }, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' } })
  } catch (e: any) {
    console.error('GET /api/data error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
