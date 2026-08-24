#!/usr/bin/env bash
# Chamado pelo cron. Carrega o PATH do node e o ~/.motoboys.env — o cron roda
# com ambiente quase vazio.
#
#   scripts/cron_motoboys.sh              → semana passada (seg a dom)
#   MOTOBOYS_INICIO=... scripts/cron_motoboys.sh
set -euo pipefail
export PATH="/home/diego/.nvm/versions/node/v24.15.0/bin:/usr/local/bin:/usr/bin:/bin"
set -a; . /home/diego/.motoboys.env; set +a
cd /home/diego/tocscomando
exec node scripts/relatorio_motoboys_semanal.mjs "$@"
