import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import * as XLSX from 'xlsx'

const notion    = new Client({ auth: process.env.NOTION_TOKEN })
const LEADS_DB  = process.env.NOTION_LEADS_DB_ID || '2efb0bbef153813a92a5c3e20c6130b2'
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID  || '1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj'

// ── Google Drive OAuth2 Token Management ────────────────────────────
async function getGoogleAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth2 credentials not configured')
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Google OAuth2 error:', error)
      throw new Error(`Failed to get access token: ${error.error_description}`)
    }

    const data = await response.json()
    return data.access_token
  } catch (e) {
    console.error('getGoogleAccessToken error:', e)
    throw e
  }
}

// ── 1. Busca o XLSX mais recente da pasta do Drive ────────────
async function fetchLatestXlsxFromFolder(): Promise<any[]> {
  try {
    const accessToken = await getGoogleAccessToken()

    // Lista arquivos da pasta ordenados por data de modificação
    const listUrl = `https://www.googleapis.com/drive/v3/files?` +
      `q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'` +
      `&orderBy=modifiedTime+desc&pageSize=1&fields=files(id,name,modifiedTime)` +
      `&access_token=${accessToken}`

    const listRes = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!listRes.ok) {
      const error = await listRes.json()
      console.error('Drive list error:', error)
      return []
    }

    const { files } = await listRes.json()
    if (!files?.length) {
      console.log('No Excel files found in Drive folder')
      return []
    }

    const fileId = files[0].id
    console.log('Using Drive file:', files[0].name, fileId)

    // Baixa o arquivo
    const dlUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    const dlRes = await fetch(dlUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!dlRes.ok) {
      console.error('Download error:', dlRes.status, dlRes.statusText)
      return []
    }

    const buf  = await dlRes.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    if (rows.length < 2) {
      console.log('Excel file has insufficient data')
      return []
    }

    const header = rows[0] as string[]
    const idx    = (name: string) => header.findIndex(h => String(h).toLowerCase().includes(name.toLowerCase()))
    const iNome  = idx('criador')
    const iGmv   = idx('GMV de Afiliado')   !== -1 ? idx('GMV de Afiliado')  : idx('GMV')
    const iCom   = idx('Comissão estimada') !== -1 ? idx('Comissão estimada'): idx('Comiss')
    const iData  = idx('Data')

    return rows.slice(1)
      .filter(r => r[iData] && String(r[iData]) !== 'Resumo' && String(r[iData]) !== '--')
      .map(r => ({
        creator:  String(r[iNome] ?? '').toLowerCase().replace('@','').replace(/\\_/g,'_').trim(),
        gmv:      parseBRL(r[iGmv]),
        comissao: parseBRL(r[iCom]),
      }))
      .filter(r => r.creator && r.creator !== '--')
  } catch (e) {
    console.error('fetchLatestXlsxFromFolder error:', e)
    return []
  }
}

// ── 2. Busca leads da Gisele no Notion ────────────────────────
async function fetchGiseleLeads() {
  const results: any[] = []
  let cursor: string | undefined

  do {
    const res = await notion.databases.query({
      database_id: LEADS_DB,
      start_cursor: cursor,
      page_size: 100,
      filter: {
        or: [
          { property: 'UTM_Source', rich_text: { contains: 'gisele' } },
          { property: 'UTM_Source', rich_text: { contains: 'Gisele' } },
          { property: 'UTM_Campaign', rich_text: { contains: 'gisele' } },
        ]
      }
    })
    results.push(...res.results)
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results.map((page: any) => {
    const p = page.properties
    return {
      id:      page.id,
      handle:  p['@ do Tiktok']?.title?.[0]?.plain_text ?? '',
      nome:    p['Nome do contato']?.rich_text?.[0]?.plain_text ?? '',
      status:  p['Qual fase do agenciamento?']?.select?.name ?? '',
      created: page.created_time,
    }
  })
}

// ── Helpers ───────────────────────────────────────────────────
function parseBRL(v: any): number {
  if (!v) return 0
  const s = String(v).replace('R$','').replace(/\s/g,'').replace(/\./g,'').replace(',','.').trim()
  return parseFloat(s) || 0
}

function cleanHandle(h: string): string {
  h = h.toLowerCase().trim()
  const m = h.match(/tiktok\.com\/@([^/?&\s]+)/)
  if (m) return m[1]
  return h.replace('@','').split('?')[0].split('&')[0]
    .replace(/^www\./,'').replace(/^tiktok\.com\//,'').replace(/\\_/g,'_').trim()
}

function matchCreator(handle: string, sales: any[]): any | null {
  const h = cleanHandle(handle)
  let f = sales.find(s => s.creator === h)
  if (!f && h.length >= 5) f = sales.find(s => s.creator.includes(h) || h.includes(s.creator))
  if (!f && h.length >= 5) {
    const hc = h.replace(/[^a-z]/g,'')
    f = sales.find(s => s.creator.replace(/[^a-z]/g,'') === hc)
  }
  if (!f && h.length >= 8) f = sales.find(s => s.creator.startsWith(h.slice(0,8)))
  return f ?? null
}

const INSIDE = new Set(['Agenciado','Convite Aceito'])

// ── GET ───────────────────────────────────────────────────────
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
        totalGmv,
        totalCom,
        giseleEarn,
        updatedAt: new Date().toISOString(),
      },
      leads: enriched.sort((a,b) => b.gmv - a.gmv),
      byDay: Object.entries(byDay)
               .sort(([a],[b]) => a.localeCompare(b))
               .map(([date,n]) => ({ date, n })),
    }, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' }
    })
  } catch (e: any) {
    console.error('GET /api/data error:', e)
    return NextResponse.json({ 
      error: e.message,
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 })
  }
}
