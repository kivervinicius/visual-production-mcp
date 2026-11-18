# Runbook para Codex/Antigravity — execução da finalização

## Instrução inicial para o agente implementador

> Você está trabalhando em `kivervinicius/visual-production-mcp`. Antes de alterar qualquer coisa, confira a `main`, leia `AGENTS.md`, `README.md`, `docs/FINALIZATION_PLAN.md`, `docs/TARGET_ARCHITECTURE.md`, `docs/PRODUCT_JOURNEY.md` e `docs/ACCEPTANCE_MATRIX.md`. O objetivo é uma jornada story-to-video auditável; não criar apenas ferramentas MCP decorativas. Inspecione testes e código existentes, selecione o menor marco incompleto, crie branch `feat/<marco>`, implemente com testes e documentação, rode todos os checks e abra PR. Não faça merge automático nem consuma créditos de provedores. Não mova toda a estrutura do repositório num único PR. Pare para pedir aprovação somente em ações externas pagas, exclusões, mudanças de segurança e decisões editoriais essenciais. Ao final apresente diff, critérios de aceite atendidos, limites e próximos bloqueios.

## Rotina por PR

1. **Sync:** `git fetch`, confira base, branches, CI atual e issues. Preserve alterações não commitadas. Branch de `main`, jamais de artefato local desatualizado.
2. **Escopo:** associe PR a um marco e critérios Axx. Delimite o contrato novo e o contrato mantido.
3. **Testes primeiro:** cubra caminhos feliz, parcial, erro, retry, conflito, autorização e invariantes de proveniência.
4. **Implementação:** extraia somente os módulos necessários; nenhuma alteração de comportamento silenciosa em operação paga.
5. **Verificação:** `npm ci && npm run check && npm run docs:check && npm test && npm run test:mcp`; invocações live são **opt-in**.
6. **Documentação:** atualizar README de capacidade, CHANGELOG e exemplos; adicionar ADR se mudou fronteira de domínio.
7. **Revisão:** conferir credenciais, logs, URLs de download, permissões de arquivos, dependências e riscos de duplicação de créditos.
8. **Entrega:** PR pequeno, status da CI, matriz de aceite com evidência e plano de rollback.

## Primeiros tickets sugeridos

| Ticket | Dependência | Implementação mínima |
|---|---|---|
| T01 StageEngine / NextAction | PR de planejamento | **Parcialmente implementado na v0.5**: 10 fases, eventos, nextAction e decisões versionadas. E2E offline com MP4 ainda pendente |
| T02 Skill de direção | T01 | Contrato de conversação, retomada, aprovações, parâmetros do MCP reais |
| T03 Biblioteca e continuidade | T01 | Versões de personagem/estilo/referências, aprovação e invalidação de dependências |
| T04 Flow capability/session worker | T03 e #1 | uma conta, inspeção live, upload de ref e imagem real |
| T05 Vídeo + recibos/download | T04 e #3 | frame→video, status, original, hash e proteção contra retry |
| T06 FFmpeg delivery | T05 e #4 | QC, áudio, legendas, timeline, MP4 final |
| T07 E2E e release | T06 | fixture offline, episódio live e checklist A01–A15 |

Usar os tickets/PRs existentes: [#1](https://github.com/kivervinicius/visual-production-mcp/issues/1) Flow real, [#2](https://github.com/kivervinicius/visual-production-mcp/issues/2) sincronização de contas, [#3](https://github.com/kivervinicius/visual-production-mcp/issues/3) job e download, [#4](https://github.com/kivervinicius/visual-production-mcp/issues/4) montagem e [#5](https://github.com/kivervinicius/visual-production-mcp/issues/5) Higgsfield. Não gerar dezenas de issues duplicadas.

## Critério de saída por execução de agente

Descrever de maneira estruturada: `baseline`, `escopo`, `arquivos alterados`, `comandos executados`, `testes/evidências`, `itens não validados`, `risco`, `nextAction`. Se não houver credencial/login Flow, implementar mocks e apontar impedimento real, **sem** simular uma geração bem-sucedida.

## Política de pesquisa de dependências externas

Usar as implementações públicas somente como referências candidatas até auditar licença, versões, manutenção e comportamento em sandbox: `BitraAI/ai-film-director` (processo), `leynos/visual-storytelling-skills` (personagens/continuidade), `XucroYuri/take` (Skill/MCP/CLI), `bakhtiarrifai/flow-studio` (storyboard local). Não incorporar código AGPL ou repositórios sem licença confirmada por simples cópia. Registrar decisão, versão e origem de qualquer código incorporado.

## Implementando F2 (revisão local)

O código foi adicionado incrementalmente em `src/application/library/visual-library.mjs`, sem refatorar em massa o armazenamento. Execute `npm test` para verificação da biblioteca, hashes, versões e análise de impacto. Depois de `studio_story_prepare`, uma imagem global aprovada é exportada como asset canônico e gerará `asset.upload`; o operador ainda precisa verificar o upload no Flow real e registrar o ID local da conta. Revisão de shot permanece no CLI, e a geração de vídeos reais pertence a F3. Consulte [Biblioteca Visual](VISUAL_LIBRARY.md).
