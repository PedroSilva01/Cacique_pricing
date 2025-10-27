# Fetch Oil Prices Edge Function

Esta função busca os preços atuais do petróleo WTI e Brent usando a API oilpriceapi.com e salva automaticamente no banco de dados.

## Configuração

### 1. Configurar a API Key no Supabase

A chave da API já está configurada nos secrets do Supabase Cloud. Para desenvolvimento local ou reconfiguração:

```bash
# No Supabase Cloud (via dashboard)
# Vá em: Project Settings > Edge Functions > Secrets
# Adicione: OIL_PRICE_API_KEY = 354f15c289f1d44542a8acc194e5ce2fca0a7a71a55a01cd8b515b09d31ea452

# Para desenvolvimento local
supabase secrets set OIL_PRICE_API_KEY=354f15c289f1d44542a8acc194e5ce2fca0a7a71a55a01cd8b515b09d31ea452
```

### 2. Deploy da Função

```bash
supabase functions deploy fetch-oil-prices --no-verify-jwt
```

A flag `--no-verify-jwt` permite que a função seja chamada sem autenticação JWT (útil para chamadas do frontend).

## Estrutura da Resposta

A API retorna os preços no seguinte formato:

```json
{
  "data": {
    "WTI": {
      "price": 73.52,
      "currency": "USD",
      "unit": "barrel",
      "change": "+1.2%",
      "timestamp": "2024-07-20T18:30:00Z"
    },
    "BRENT": {
      "price": 76.88,
      "currency": "USD", 
      "unit": "barrel",
      "change": "+0.8%",
      "timestamp": "2024-07-20T18:30:00Z"
    }
  }
}
```

## Funcionalidades

- ✅ Busca preços em tempo real da API oilpriceapi.com
- ✅ Salva automaticamente no banco de dados (tabela `oil_prices`)
- ✅ Atualiza ou insere (upsert) baseado na data
- ✅ Suporte a CORS para chamadas do frontend
- ✅ Tratamento de erros robusto

## Banco de Dados

Os preços são salvos na tabela `oil_prices` com a seguinte estrutura:

```sql
- date (date): Data do registro (chave única)
- wti_price (real): Preço do WTI em USD/barril
- brent_price (real): Preço do Brent em USD/barril
- wti_change (text): Variação percentual do WTI (ex: "+1.2%")
- brent_change (text): Variação percentual do Brent
- timestamp (timestamp): Timestamp da coleta
```

## Agendamento Automático

Para atualizar os preços automaticamente a cada 30 minutos, você pode:

### Opção 1: Supabase Cron (Recomendado para produção)
Configure um job de cron no Supabase para invocar a função periodicamente.

### Opção 2: Frontend polling
O frontend já chama `fetchOilPrice()` no carregamento do Dashboard. Para atualizações periódicas, adicione um interval:

```javascript
useEffect(() => {
  fetchOilPrice(); // Busca inicial
  const interval = setInterval(fetchOilPrice, 30 * 60 * 1000); // A cada 30 min
  return () => clearInterval(interval);
}, [fetchOilPrice]);
```

### Opção 3: GitHub Actions
Crie um workflow que chama a função via HTTP a cada 30 minutos:

```yaml
name: Update Oil Prices
on:
  schedule:
    - cron: '*/30 * * * *'
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST https://your-project.supabase.co/functions/v1/fetch-oil-prices
```

## Testes Locais

Para testar localmente:

```bash
# Inicie o ambiente local do Supabase
supabase start

# Sirva a função
supabase functions serve fetch-oil-prices --env-file .env.local

# Em outro terminal, faça uma requisição
curl http://localhost:54321/functions/v1/fetch-oil-prices
```

## Limites da API

- **Plan atual**: Gratuito com limites
- **Requisições**: Verifique os limites em https://www.oilpriceapi.com/pricing
- **Recomendação**: Não fazer mais de 2 requisições por minuto

## Troubleshooting

### Erro: "OIL_PRICE_API_KEY not configured"
- Verifique se a secret foi configurada corretamente no Supabase

### Erro: API request failed
- Verifique se a API key está válida
- Confirme que não excedeu os limites de requisições

### Preços não aparecem no dashboard
- Verifique se a função foi deployada com `--no-verify-jwt`
- Confirme que a tabela `oil_prices` existe e tem os campos corretos
- Execute a migration `20251025001400_add_oil_price_fields.sql`
