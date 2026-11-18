# Plano de finalização — Visual Production MCP

**Status:** plano de implementação; não confundir proposta arquitetural com funcionalidade já disponível.  
**Baseline auditada:** v0.4.0 na `main` em 2026-11-17, 39 testes de domínio passando; o handshake MCP foi validado anteriormente no GitHub Actions, sem execução real do Flow.

## Objetivo e limite de escopo

**Entrada:** uma história em texto/arquivo e, opcionalmente, preferências como duração, formato e estilo.  
**Saída:** `final.mp4` verificável, projeto portátil com todos os assets/manifestos e relatório de proveniência, decisões e custos.  
**Experiência:** o agente direciona a produção por fases, apresenta prévias e decisões relevantes, permite pausa/retomada e exibe `próxima ação`, bloqueios e progresso comprovado. Nenhum crédito é consumido antes de autorização explícita.

A primeira entrega de produto (v1.0) deve funcionar **com uma única conta Google Flow autorizada**. Reaproveitamento entre várias contas e Higgsfield são extensões posteriores; não podem bloquear a entrega do primeiro episódio completo. Projetos remotos por conta são independentes; não existe promessa de clonagem automática de projetos nem pooling de créditos.

## Evidências da baseline

| Área | Situação em v0.4.0 | Principal lacuna |
|---|---|---|
| História imutável / hash / chunks | Implementado | Ingestão robusta de PDF/DOCX, revisões e capítulos |
| Elenco, locais e storyboard | Planejamento orientado pelo agente + validação local | Avaliação de consistência, aprovação granular e geração das referências |
| Workflow de imagens e vídeo | DAG local, schema de upstream e proteção contra envios incertos | Homologação de ferramenta Flow real e recuperação dos assets |
| Contas e orçamento | Cadastros, estimativas e aprovações locais | Capacidades/quotes reais, reconciliação de gastos e sessões estáveis |
| Mídia | Ingestão de arquivo local e verificação de hash | Download automático, correlação inequívoca job→asset e previews |
| Finalização | `EDIT_MANIFEST.json` | Revisão por plano, áudio, legendas, FFmpeg e MP4 final |
| UX de acompanhamento | `studio_story_status` devolve uma próxima etapa | Motor de fases/eventos, inbox de ações, relatórios de progresso |
| Qualidade | 39 testes Node locais; teste de handshake MCP no CI anterior | E2E simulado de produção completa e E2E autenticado de um plano |

### Não fazer agora

- Reescrever todo o código para TypeScript, criar monorepo, UI desktop ou microserviços.
- Desenvolver três adaptadores incompletos simultaneamente.
- Prometer geração automática para todas as operações catalogadas do Flow (catálogo ≠ implementação).
- Copiar código de projetos externos sem licença, proveniência e suíte de testes verificadas.
- Automatizar evasão de CAPTCHA, restrição de conta ou rotação para contornar limites do provedor.

## Entregas ordenadas e gates de qualidade

### F0 — contratos, organização e baseline reproduzível (v0.5a)

**Implementar:** docs/arquitetura-alvo, decisão Skill/MCP, Skill inicial, schemas canônicos com versionamento, CI com docs e testes, lockfile gerado e revisado. Congelar exemplos para testes de regressão. Não trocar o layout inteiro de código neste marco.

**Gate:** onboarding em ambiente limpo executa `npm ci`, `npm run check`, `npm test`, `npm run test:mcp` e `npm run docs:check`; nenhum arquivo de segredos é versionado; README distingue suporte real de suporte futuro.

### F1 — jornada guiada e retomada independente do agente (v0.5)

**Entrega parcial implementada no PR F1:** projeção das dez fases, próximo passo, eventos com cursor, retomada e aprovação editorial versionada. A travessia simulada até MP4 final permanece PENDENTE de F3/F4: não declarar gate F1 totalmente verificado até testar workflow offline completo com ativos físicos.

**Implementar:** núcleo de fases `STORY → DIRECTING → BIBLE → STORYBOARD → REFERENCES → SHOT_IMAGES → VIDEOS → REVIEW → AUDIO_EDIT → DELIVERY`, com `GET_STATUS`, `GET_NEXT_ACTION` e `SUBMIT_DECISION`. Cada etapa retorna artefatos esperados, bloqueios, aprovações e estimativa de esforço/custo. `AWAITING_APPROVAL`, `BLOCKED` e `FAILED` não avançam automaticamente. Criar histórico de decisões e revisões; permitir retomar com outro cliente MCP.

**UX:** perguntar apenas o indispensável (formato/duração/estilo se não puder inferir, aprovação editorial, aprovação de referência, crédito, seleção final). Para cada fase, oferecer resumo claro, próximas ações e prévia. Uma passagem que termina em `awaiting_approval` é resultado normal, não erro.

**Gate:** uma única história fornecida ao agente permite percorrer todas as fases com provedor simulado, interromper o processo a cada fase, reiniciá-lo em outro processo e concluir sem perder eventos/identidades; nenhuma pergunta já respondida é refeita.

### F2 — biblioteca visual versionada, referências e QC editorial (v0.6)

**Implementar:** `CharacterVersion`, `LocationVersion`, `StyleVersion`, `Asset` e `ReferenceSet` com hashes, direitos/proveniência, uso em cenas e aprovação por versão. Mostrar uma matriz de continuidade e produzir pacotes de referências reutilizáveis. Separar *brief visual* de *arte aprovada* e *ID remoto*. Oferecer mecanismo para rejeitar/refazer **um** plano, não um episódio inteiro.

**Gate:** personagem aprovado é reaproveitado em duas cenas sem mudar a identidade canônica; alteração de aparência gera nova versão com dependências invalidadas explicitamente. Uma referência incompleta bloqueia o plano que depende dela.

### F3 — um adaptador Google Flow operacional (v0.7, prioridade externa #1)

**Implementar:** provedor por conta com sessão autorizada e saúde, capability discovery, `project.ensure`, `asset.ensure`, geração de **uma imagem** e de **um vídeo usando frame**. Mapear chamada → operação → mídia pelo ID real. Obter quote antes da aprovação; respeitar controle de gastos, erros e restrições. Usar upstream MCP existente se confiável; automação de navegador fica confinada ao adaptador, nunca ao domínio.

**Gate de evidência ao vivo:** criar imagem, inspecionar/recuperar resultado, gerar vídeo aprovado da imagem, obter o arquivo original e validar SHA-256/duração/dimensões. Falha antes de pagamento é reexecutável; falha após submissão incerta exige reconciliação, nunca retry cego. Capturar logs sanitizados e versão do upstream. Registrar qual combinação conta/plano/modelo foi realmente testada.

### F4 — scheduler, mídia, revisão e exportação final (v0.8)

**Entrega parcial na v0.8:** Media Composer local com template baseado no StoryGuide, storyboard obrigatório, imagens com movimentos discretos, clipes existentes, áudio opcional, SRT e MP4, hashes e QC técnico. Testes offline geram MP4 físico e verificam FFprobe. **Ainda pendentes:** scheduler durável, aprovação editorial de delivery, revisão audiovisual automática/humana, narração/áudio como produção e integração direta do download Flow ao slot de edição. Confira [MEDIA_COMPOSER.md](MEDIA_COMPOSER.md).

**Implementar:** filas duráveis, leases, reconciliação, download retomável, storage com hashes, FFprobe, previews/contact sheets, aprovação por shot, áudio/narração por fonte configurável, legendas `srt/vtt`, timeline/EDL e FFmpeg determinístico. O `EDIT_MANIFEST` vira contrato executável; assets brutos nunca são alterados.

**Gate:** E2E local com fixtures produz `final.mp4`, `subtitles.srt`, relatório QC e manifesto de proveniência; retomada de falha após download não aciona nova geração paga; áudio ausente é explicitado, não inventado.

### F5 — episódio real de ponta a ponta e release (v1.0)

**Implementar:** validação em um episódio curto aprovado, do texto ao MP4 real, testes em Codex e Antigravity, métricas de custo/tempo, instruções de instalação/suporte e critérios de manutenção. Exigir evidências por cena e assinatura editorial da entrega.

**Gate:** com uma conta autorizada, um usuário consegue fornecer uma história, revisar decisões e receber um vídeo completo com arquivos auditáveis, sem construir JSONs manualmente. Recovery entre sessões comprovado. CI verde e documentação reproduzível em nova máquina.

### F6 — pós-v1.0: contas adicionais, Higgsfield e cobertura avançada (v1.1+)

- Sincronizar referências canônicas com outro projeto/conta **somente após validar autorização e termos aplicáveis**; nunca transferir IDs locais do provedor como se fossem portáveis.
- Adaptador Higgsfield por API/MCP oficial, utilizando mesma biblioteca canônica; declarar recursos não equivalentes.
- Evoluir recursos avançados do Flow (edição/extend/Scenebuilder/Agent/Tools) por matriz de capacidades verificada, não em lote especulativo.
- UI de acompanhamento somente se a experiência CLI/MCP estiver estável; notificações fora da sessão exigem serviço de entrega integrado, não são efeito automático do MCP.

## Sequência de PRs (pequenos, revisáveis)

1. **PR-A — documentação + Skill + CI de documentação:** sem movimentar arquivos de runtime; este plano.
2. **PR-B — stage engine + decisões/eventos:** API de status/next-action com fixtures e migração compatível de `state.json`.
3. **PR-C — biblioteca canônica e aprovações:** personagens, locais, estilo e vínculos de referências; contratos de continuidade.
4. **PR-D — adaptar um Flow real:** browser/upstream worker isolado, preflight/quote, imagem e vídeo, correlação e download.
5. **PR-E — delivery:** QC, legendas, FFmpeg, revisão e pacote final.
6. **PR-F — E2E e release:** narrativa real, documentação de operação e validação por outro operador.

Para refatorar arquivos de `src/`, usar padrão *strangler*: extrair uma responsabilidade por PR, manter a API MCP antiga ativa, adicionar teste de regressão e só remover export antigo na versão maior adequada. Detalhes em [TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md).

## Responsabilidades e dependências

| Decisão/ator | Responsabilidade |
|---|---|
| Usuário/editor | História original, aprovações criativas e gastos, validação final |
| Agente/Skill | Analisar história, propor opções, explicar etapas, chamar ferramentas MCP autorizadas |
| Núcleo MCP | Persistir identidade/estado, validar contratos, calcular next-action, impedir gasto indevido |
| Adaptador de provedor | Descobrir capacidades, operar sessão autorizada, enviar/receber mídia e reportar evidências |
| Pipeline de mídia | Hash, QC técnico, timeline, exportação e artefatos finais |

**Semântica de conclusão:** status local `DONE` só para artefato local validado e aprovado; `PROVIDER_SUBMITTED` não significa vídeo final; `READY_FOR_REVIEW` não significa aprovado. Cada transição deve ter evento de auditoria.

## Riscos que podem bloquear a entrega

1. Alterações de UI/APIs do Flow: capability checks, testes de contrato, screenshots sanitizadas; em quebra, erro explícito `PROVIDER_UI_CHANGED`.
2. Créditos e operação incerta: limite por conta e plano, estado `SUBMISSION_UNKNOWN` e reconciliação read-only; nunca repetir automaticamente geração paga.
3. Continuidade visual imperfeita: referências e aprovação por shot, sem prometer *face lock* universal.
4. Aderência ao roteiro: cada plano aponta para `sourceExcerpt`; comparar cobertura e revisar cenas com omissões; cobertura quantitativa não equivale a qualidade semântica.
5. Concorrência e integridade: migrar lock de arquivo para SQLite WAL antes de workers paralelos, com backup e migração testada.
6. Direitos e privacidade: metadados de licença/autorização de vozes/imagens, credenciais fora de logs e Git.

## Definição de pronto de produto

Não marcar v1.0 como finalizada antes de todos os cenários e evidências de [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md), incluindo vídeo exportado real, revisão e recuperação. A apresentação de progresso deve mostrar `DONE`, `PLANNED`, `BLOCKED` e `UNVERIFIED` sem confundi-los.

## Situação F2 (v0.6, branch de revisão)

A biblioteca visual local agora suporta identidades imutáveis `libraryId@version`, imagens por SHA-256, aprovação/rejeição pelo operador, alternativas de still por shot, análise de impacto e reutilização de referências aprovadas no compilador. O `asset.upload` é planejado, e o ID remoto só é registrado após o operador conferir a conclusão. **Não houve homologação em conta Flow real**, nem garantia automática de fidelidade visual. Consulte [Biblioteca Visual](VISUAL_LIBRARY.md) e a issue [#12](https://github.com/kivervinicius/visual-production-mcp/issues/12). O gate F3 continua aberto.
