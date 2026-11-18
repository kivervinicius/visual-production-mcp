# Contribuição e organização

## Antes de implementar

Leia [AGENTS.md](AGENTS.md), [docs/FINALIZATION_PLAN.md](docs/FINALIZATION_PLAN.md), [docs/TARGET_ARCHITECTURE.md](docs/TARGET_ARCHITECTURE.md) e [docs/ACCEPTANCE_MATRIX.md](docs/ACCEPTANCE_MATRIX.md). Faça uma mudança por responsabilidade e use branch de `main`. Não use o MCP como desculpa para misturar regras de negócio com browser selectors ou handlers HTTP/MCP.

## Processo de PR

- Associe a mudança a um gate de release e a critérios `Axx`.
- Escreva testes de regressão; diferencie mocks, integração real e operação paga.
- Preserve nomes e schemas dos tools existentes, a menos que exista migração documentada.
- Atualize README, exemplos e CHANGELOG quando alterar comportamento.
- Execute `npm ci`, `npm run check`, `npm run docs:check`, `npm test`, `npm run test:mcp`.
- Verifique ausência de credenciais, cookies, endpoints privados e mídia sem permissão.

**Padrão de nome:** `feat/<entrega>`, `fix/<problema>`, `docs/<tema>`. Preferir commits pequenos e PRs facilmente revertíveis.

## Regras de negócio não negociáveis

História e assets aprovados são versionados; IDs remotos pertencem a uma conta/projeto; nenhum `SUBMISSION_UNKNOWN` é reenviado automaticamente; gastos exigem autorização humana; `DONE` exige evidências; erro de recurso não suportado é explícito. Não tentar contornar CAPTCHAs, suspensões, políticas de uso ou proteções de provedores.

## Qualidade

A suíte Node sem rede é a referência para domínio; handshake MCP e dependências são checados no CI. Testes live devem usar uma conta autorizada e orçamento delimitado, separados da CI padrão. Documente a versão de upstream, provedor, modelo, comportamento observado e data, sempre sem tokens ou dados de sessão.
