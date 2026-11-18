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
