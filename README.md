# Amplify Super Afiliada Dashboard

Dashboard ao vivo — Notion + Google Drive → Vercel.

## Variáveis de ambiente (Vercel → Settings → Env Vars)

| Variável | Valor |
|---|---|
| `NOTION_TOKEN` | Token da integration "Dashboard Aquisição" |
| `NOTION_LEADS_DB_ID` | `2efb0bbef153813a92a5c3e20c6130b2` |
| `GDRIVE_FOLDER_ID` | `1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj` |
| `GDRIVE_API_KEY` | API Key do Google Cloud (Drive API ativada) |

## Como pegar o GDRIVE_API_KEY

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto ou use um existente
3. Ative a **Google Drive API**
4. Credenciais → **Criar credenciais → Chave de API**
5. Copie a chave — cole na variável `GDRIVE_API_KEY`
6. (Recomendado) Restrinja a chave ao domínio do Vercel

## Como pegar o NOTION_TOKEN

1. [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Abra a integration "Dashboard Aquisição" → copie o token `secret_...`
3. No database de Leads → `...` → **Connections** → confirme que "Dashboard Aquisição" está ativa

## Atualizar o relatório

Basta fazer upload do novo XLSX na pasta **Export Partner Center** do Drive.  
O dashboard busca automaticamente o arquivo mais recente (ordenado por data de modificação).  
Cache de 5 minutos no Vercel.
