# Monitoramento rápido — spam / duplicidade SDR Outbound

## n8n (instância ao vivo)

1. Abrir o workflow **SDR Outbound** e a aba **Executions**.
2. Filtrar pelo intervalo de horário do incidente.
3. Verificar se há **execuções sobrepostas** (duas “Running” ao mesmo tempo no mesmo workflow).
4. Abrir uma execução: contar quantos itens passaram por **Um lead por vez** e anotar o **Execution ID** (comparar com `outbound_cadencia_eventos.n8n_execution_id` no Supabase).
5. Confirmar que o gatilho **Cron cadência 15min** está ligado a **Supabase — candidatos** (o JSON exportado no repo foi corrigido para alinhar nome do nó).

## Supabase

- Rodar consultas em [`FORENSE_OUTBOUND_CADENCIA.sql`](FORENSE_OUTBOUND_CADENCIA.sql) (rajadas, inbound x outbound, timeline).
- Verificar migrations 015/016 aplicadas: [`../supabase/verify_outbound_migrations_015_016.sql`](../supabase/verify_outbound_migrations_015_016.sql).

## Após deploy do lease (migration 015)

- Se `outbound_dispatch_lease_until` ficar preenchido por muito tempo sem envio, investigar execução travada ou ramo sem liberação do lease.
