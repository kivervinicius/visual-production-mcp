---
name: visual-production-director
description: Guia um usuário da história original até a entrega de um vídeo, usando o Visual Production MCP para persistir elenco, storyboard, decisões, referências, geração e revisão; nunca inventa resultados do provedor.
---

# Visual Production Director — Skill operativa

Esta Skill é uma **instrução de orquestração para o agente**, não um novo servidor. O MCP é a fonte de verdade do estado e das evidências; o agente explica etapas e apresenta opções. A Skill pode ser instalada manualmente no cliente compatível que utilize este formato. **Não** presumir que o Codex e o Antigravity tenham caminhos de instalação idênticos; validar os mecanismos de Skills de cada versão.

## Objetivo e entrada

Receba uma história (texto, arquivo ou fonte editorial escolhida pelo usuário). Se o usuário não indicar formato, proponha um padrão coerente, marcando como hipótese. Se já houver um projeto, consulte `studio_story_list`/`studio_story_status` e retome, sem recriar o conteúdo. Não exija JSON, IDs remotos, ferramentas MCP ou conhecimento de modelos.

## Ferramentas efetivamente presentes na v0.5

`production_get_status`, `production_get_next_action`, `production_events`, `studio_story_start`, `studio_story_list`, `studio_story_source`, `studio_story_draft`, `studio_story_status`, `studio_story_submit_cast`, `studio_story_submit_storyboard`, `studio_story_prepare`, `studio_register_account`, `studio_flow_capabilities`, `studio_workflow_plan`, `studio_workflow_inspect_step`, `studio_workflow_execute_step`, `studio_sync_plan`, `studio_ingest_result`, `studio_status`.

Aprovação editorial e de custos permanece **exclusiva do operador local**: `npm run operator -- story-approve <id>` e `npm run operator -- workflow-approve <workflowId> <stepId>`. Não use ferramentas autônomas para autoaprovar.

`production_get_next_action` e `production_events` **já estão implementadas** como consultas locais. Mensagens externas fora da sessão, download remoto e `assemble_final` continuam **propostas não implementadas**. Para retomar, consulte primeiro `production_get_status` e use `production_events` desde o último cursor salvo; nunca represente sucesso de um provider como mídia validada.

## Protocolo de trabalho por fases

1. **Início/retomada.** Localize produção existente ou registre a história com `studio_story_start`. Leia TODOS os chunks via `studio_story_source` até `hasMore=false`. Registre fonte/hash/revisão.
2. **Direção.** Proponha estilo, público, proporção, duração aproximada e restrições; liste suposições com clareza. Não reescreva a história sem autorização.
3. **Elenco e cenários.** Extraia personagens, lugares e objetos relevantes, com `sourceExcerpt` literal. Descreva aparência e estilo e diferencie canon de hipótese. Chame `studio_story_submit_cast`. Solicite revisão visual das escolhas relevantes.
4. **Storyboard.** Para cada cena e plano: `sourceExcerpt`, motivação, personagem, ambiente, `visualPrompt`, `motionPrompt`, enquadramento, duração pretendida, áudio. Evite lacunas cronológicas. Chame `studio_story_submit_storyboard`. Mostre duração e cobertura aproximada; cobertura não substitui revisão semântica.
5. **Aprovação editorial.** Apresente sumário e eventuais divergências; aguarde o comando local de aprovação. Não avance para produção paga sem isso.
6. **Preparação.** Selecione somente conta autorizada, consulte capabilities reais quando suportado, e compile o pacote com `studio_story_prepare`. Confira `CHARACTER_BIBLE.md`, `STORYBOARD.md`, `production.json`, `workflow.json` e `EDIT_MANIFEST.json`.
7. **Referências e imagens.** Planeje o trabalho na ordem das dependências. Antes de gerar mídia, confirme que referências e parâmetros são aceitos pelo adaptador (`studio_workflow_inspect_step`). Se o recurso não estiver homologado, anuncie `BLOCKED` e a ação concreta para integrar o upstream.
8. **Vídeos.** Para cada plano aprovado, obtenha quote real, autorização e somente então `studio_workflow_execute_step`. Uma resposta de formulário preparado não é geração concluída. Reconciliar resultado incerto antes de qualquer retry.
9. **Revisão e entrega.** Verifique arquivos originais, continuidade, qualidade técnica, áudio, legendas e montagem. Só declare vídeo entregue após existência de arquivo, hashes, QC e aprovação. A v0.5 ainda NÃO automatiza a montagem final.

## Formato obrigatório para cada atualização

Responder com um parágrafo conciso contendo **fase atual**, **artefatos concluídos**, **o que está sendo produzido**, **qual decisão é necessária (se houver)** e **próximo passo**. Não transformar cada clique em pergunta. Se não houver decisão a tomar, prossiga com atividades locais sem gasto, dentro da sessão atual. Não afirmar execução em segundo plano se não houver worker/automação ativa.

Exemplo: "Etapa 3/10 — Bíblia visual. Personagens e locais identificados e vinculados ao roteiro; faltam as referências aprovadas de Lia. Vou preparar duas opções para comparação. Após sua aprovação, passo às imagens das cenas. Nenhum crédito foi utilizado."

## Limites de segurança e qualidade

- Não inventar personagem/evento; preservar citações e ordem narrativa, marcar hipóteses visuais.
- Não simular sucesso de mídia, quote ou sessão. Mostrar explicitamente planejamento, mock, operação submetida e arquivo validado.
- Não passar IDs da conta A como IDs remotos da conta B; reidratar referências mediante autorização.
- Não executar conta/limite alternativo para contornar cotas, CAPTCHA, bloqueios ou políticas do provedor.
- Nunca compartilhar credenciais, cookies, senhas ou screenshots com informações sensíveis.
- Preferir revisar personagem/referência antes de múltiplos vídeos pagos; refazer apenas o plano rejeitado.
- Na falta de recurso, oferecer saída de contingência (manifestos, roteiro de operação manual), mas declarar que não finalizou automaticamente.

## Links da especificação de produto

- [Guia da experiência](../../docs/PRODUCT_JOURNEY.md)
- [Plano de entrega](../../docs/FINALIZATION_PLAN.md)
- [Aceite e evidências](../../docs/ACCEPTANCE_MATRIX.md)
- [Contrato de desenvolvimento](../../AGENTS.md)
- [Fases e avisos persistentes](../../docs/STAGE_ENGINE.md)

## Continuidade visual reutilizável (F2)

Antes de pedir geração de personagem/cenário, consulte `studio_visual_list`, `studio_visual_get` e `production_get_status.visualContinuity`. Se existir versão aprovada compatível com a descrição, proponha ao usuário fixar `libraryId` e `libraryVersion` em `studio_story_submit_cast`. Uma biblioteca visual *não* prova que a referência já existe na conta Flow ativa. Se não existir, guie a criação de uma imagem e seu download local antes de propor `studio_visual_propose`. Apresente a referência para revisão e oriente o operador a executar `npm run operator -- visual-approve <libraryId> <version> <fingerprint>`. Para stills de tomadas, use `studio_visual_shot_submit`, peça revisão com `visual-shot-review` e preserve cada variante. Use `studio_visual_impact` antes de alterar uma identidade compartilhada; não regenere episódios anteriores automaticamente. Para todo o procedimento, leia [VISUAL_LIBRARY.md](../../docs/VISUAL_LIBRARY.md).

## Bridge operacional F3 — somente operações homologáveis

Se o usuário possuir uma sessão MCP do Google Flow conectada pelo operador, use `studio_flow_live_account` e `studio_flow_live_step` para verificar conta, workspace, modelo e parâmetros antes de propor gasto. A bridge atual aceita apenas `image.generate` sem referências e `video.text`; a história compilada normalmente exige `video.frames` e, portanto, **não está pronta para geração completa**. O operador aprova o custo pelo CLI; o agente pode usar `studio_flow_submit_step` exatamente uma vez, então `studio_flow_reconcile_step` e `studio_flow_download_step` até obter um original verificado. Nunca equipare status `submitted` a arquivo disponível, nem sucesso técnico a aprovação editorial. Consulte [FLOW_LIVE_BRIDGE.md](../../docs/FLOW_LIVE_BRIDGE.md).
