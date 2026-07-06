# Plano: Logins individuais da equipe (contas + papéis)

> **Como usar**: abra uma sessão de Claude Code em `~/tocscomando` e mande: *"executa o plano docs/planos/logins-equipe.md"*.
> **Leia primeiro** `docs/planos/_convencoes.md` — regras do repo, SQL via Management API e aprovações obrigatórias do Diego.

## Problema

Hoje a equipe provavelmente compartilha login. Com os cupons (`reports`) somando por equipe e registrando autor (`user_id`), e com os papéis já implementados (admin / operator escopado por caixa), cada funcionário precisa da própria conta — senão se perde quem lançou o quê e todo mundo opera como o mesmo usuário.

## O que já existe (reusar, não recriar)

- **Papéis prontos** em `lib/profile.ts`: `role` (`admin`/`operator`) + `default_drawer_id` → operator com caixa vira escopado (`visibleDrawerFilter`), operador do Salão (`LTDA`) não vê Motoboys (`canSeeMotoboys`), badge Delivery/Salão via `roleLabel`.
- **Primeiro login cria o perfil sozinho**: `getCurrentProfileImpl` insere `user_profiles` como `operator` sem caixa no primeiro acesso — não precisa criar perfil manualmente, só a conta de auth.
- **Tela de gestão já existe**: `/cadastros?tab=equipe` (admin-only) lista membros via RPC `team_members()` e edita nome/papel/caixa via `updateUserProfile` (app/cadastros/actions.ts).

## Passo a passo

1. **Levantar a lista com o Diego** (perguntar no chat): nome de cada funcionário, e-mail (pode ser `nome.tocs@gmail.com` ou subendereço `diegodsbernardi+nome@gmail.com`), papel e caixa (Delivery/Salão/nenhum). Perguntar também se o login compartilhado atual deve ser mantido (recomendação: manter como conta do caixa físico ou desativar depois da transição).
2. **Criar as contas** via Supabase Auth Admin API (service_role do `.env.local`; não precisa do dashboard):
   ```bash
   curl -s -X POST "https://khwjhfkolicttuxbugiz.supabase.co/auth/v1/admin/users" \
     -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     --data '{"email":"<email>","password":"<senha-inicial>","email_confirm":true}'
   ```
   - Gerar senha inicial forte por pessoa (ex.: `tocs-<nome>-<4 dígitos>`); NUNCA colar senhas na conversa em texto que o Diego não pediu — gravar num arquivo local `~/tocs-senhas-iniciais.txt` (chmod 600) e avisar o Diego pra distribuir e depois apagar.
3. **Definir papel/caixa**: ou o Diego faz na tela `/cadastros?tab=equipe` (mandar passo a passo de cliques), ou direto via SQL (Management API) em `user_profiles` (`role`, `default_drawer_id` — ids dos drawers: `select id, name from cash_drawers`). Obs.: o perfil só existe depois do primeiro login da pessoa OU pode ser inserido antecipado com o `user_id` retornado na criação da conta.
4. **Conferir os escopos**: logar (ou pedir pro Diego logar) com uma conta de teste de cada papel e verificar: operador Salão sem aba Motoboys; operador escopado vê só o caixa dele em `/caixa` e `/fechar-o-dia`; admin vê `/painel` e tab Equipe.
5. **Comunicação**: gerar mensagem de WhatsApp por funcionário (login + senha inicial + "troca a senha no primeiro acesso em OLÁ → Alterar minha senha" — o menu existe no app Saipos, no TOCS a troca é via "Esqueci a senha" do Supabase; conferir se a tela de login tem esse fluxo e, se não tiver, anotar como pendência) + parágrafo novo pro tutorial da equipe.

## Verificação

1. `team_members()` retorna todos os novos usuários com papel/caixa certos.
2. Um cupom fotografado por conta nova aparece no total da home de outra conta (leitura de equipe funcionando).
3. Escopos do passo 4 conferidos.
4. Sem deploy (não há mudança de código, a menos que o fluxo de troca de senha precise de ajuste — nesse caso, build + "sim" do Diego).

## Fora de escopo

- SSO/convite por e-mail (senha inicial manual resolve pro tamanho da equipe).
- Auditoria retroativa de quem lançou o quê antes das contas individuais.
- Desativar contas antigas sem confirmação explícita do Diego.
