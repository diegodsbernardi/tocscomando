#!/usr/bin/env bash
# Fix aprovado pelo Diego em 07/07:
# 1. Recria cash_movements (schema antigo, tabela VAZIA — verificado) — destrava movimentações de caixa
# 2. Apaga snapshot de teste sem loja (drawer_name null) que duplicava médias
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN=$(tr -d '\n' < ~/.supabase/access-token)
URL="https://api.supabase.com/v1/projects/khwjhfkolicttuxbugiz/database/query"
HDR=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "User-Agent: supabase-cli/2.0")

echo "1/3 conferindo que cash_movements está vazia..."
COUNT=$(curl -s -X POST "$URL" "${HDR[@]}" --data '{"query":"select count(*) from public.cash_movements;"}')
echo "   $COUNT"
[[ "$COUNT" == '[{"count":0}]' ]] || { echo "ABORTADO: tabela não está vazia!"; exit 1; }

echo "2/3 aplicando migration_cash_movements_fix.sql..."
python3 -c "import json;print(json.dumps({'query': open('supabase/migration_cash_movements_fix.sql').read()}))" > /tmp/mig_fix.json
curl -s -X POST "$URL" "${HDR[@]}" --data @/tmp/mig_fix.json
echo

echo "3/3 apagando snapshot de teste (drawer_name null)..."
curl -s -X POST "$URL" "${HDR[@]}" --data '{"query":"delete from public.saipos_snapshots where drawer_name is null returning work_date, total_sales;"}'
echo

echo "== schema novo de cash_movements =="
curl -s -X POST "$URL" "${HDR[@]}" --data '{"query":"select column_name from information_schema.columns where table_name = '\''cash_movements'\'' order by ordinal_position;"}'
echo
echo "PRONTO ✓"
