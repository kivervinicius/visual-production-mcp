# Google Flow → Media Composer (v0.8.1)

**Status:** integração local de **mídia já produzida e comprovadamente arquivada**. Não inicia geração, não acessa sessão Google, não consulta créditos nem conclui aprovação editorial. Um teste com conta real ainda está pendente; os testes atuais utilizam fixtures físicas de MP4 e estado de workflow.

## Por que essa etapa existe

O F3 guarda mídia baixada do Flow em `.studio/outputs/flow/<providerJobId>/<sha256>.<ext>` e registra um recibo no workflow correspondente. O F4 monta MP4 com o `RENDER_INPUTS.json`, porém não sabia selecionar automaticamente o **mesmo original** para um plano do storyboard. A nova ponte verifica a ligação entre job, conta, história aprovada, projeto canônico, plano, duração, proporção, SHA-256 e arquivo real no disco. Depois disso, **o operador escolhe** usar aquele clipe no render.

## Procedimento

Instale FFmpeg/FFprobe; conecte e opere o Google Flow seguindo [FLOW_LIVE_BRIDGE.md](FLOW_LIVE_BRIDGE.md). Os passos de geração podem depender de funcionalidades que ainda não são suportadas no adaptador F3 (`video.frames`, `asset.upload`); nunca troque por `video.text` sem decisão editorial explícita.

### 1. Verificar o resultado do job original

Use `studio_flow_reconcile_step` ou `npm run operator -- flow-live-reconcile <workflowId> <videoStepId>` e, se necessário, `studio_flow_download_step` / `flow-live-download`, sempre com o **mesmo UUID**. Somente o estado `completed` com `output.receipt.sha256` arquivado e verificado é aceito pela ponte. `submitted`, `submission_unknown` e respostas sem original não são aceitos.

### 2. Preparar o plano local

Use o pacote `production/` criado pelo StoryGuide após aprovação, ou o pacote `offline-render/` exportado pela CLI. Exemplo sem caminhos fixos de máquina:

```bash
npm run operator -- render-export ep01
npm run operator -- render-init .studio/stories/ep01/offline-render
```

Se o pacote `production/` já contiver `RENDER_INPUTS.json`, **não execute** novamente `render-init`. Se houver slots sem mídia, isso é esperado até que os arquivos sejam associados.

### 3. Conferir a associação, somente leitura

```bash
npm run operator -- render-flow-plan ep01-acc-flow video-plano1 .studio/stories/ep01/offline-render
```

Ou, pelo MCP, `production_render_flow_link_plan({workflowId,stepId,packageDir})`. Essa ferramenta retorna `status`, `sha256`, `mappingSha256`, `accountId`, `clipDurationSeconds`, `approvedShotDurationSeconds` e IDs de proveniência. Nenhuma mídia é alterada ou aprovada durante essa consulta.

### 4. Selecionar como operador

**Assista ao original antes de selecionar.** Preencha exatamente o SHA-256 do vídeo e o SHA-256 da versão atual de `RENDER_INPUTS.json` recebidos no passo anterior:

```bash
npm run operator -- render-flow-attach ep01-acc-flow video-plano1 \
  .studio/stories/ep01/offline-render <clipSha256> <mappingSha256>
```

O comando só existe no **CLI local**, não no conjunto de ferramentas MCP disponível ao agente. Ele copia o original para `media/video-plano1-<prefixoHash>.<ext>`, confere novamente o hash e altera apenas o slot correspondente. A revisão anterior de `RENDER_INPUTS.json` fica preservada em `render-history/<sha256>.json`. O arquivo original e os previews antigos não são sobrescritos. Se outro processo modificar o mapeamento entre os dois comandos, ocorre `STALE_RENDER_MAPPING` e o operador deve refazer o plano.

O fluxo permite selecionar uma nova variante mais tarde — novamente com novo hash e confirmação; o novo render usará um fingerprint diferente.

### 5. Pré-visualizar e renderizar

```bash
npm run operator -- render-plan .studio/stories/ep01/offline-render/RENDER_INPUTS.json
npm run operator -- render .studio/stories/ep01/offline-render/RENDER_INPUTS.json
```

O `QC_REPORT.json` e o `RENDER_MANIFEST.json` agora incluem a proveniência declarada da seleção (`workflowId`, conta, UUID do job, hash do original). O resultado permanece `PREVIEW_RENDERED`, sujeito à avaliação audiovisual e autorização de publicação.

## Invariantes de segurança

- A origem deve ser a mídia **já arquivada** em `.studio/outputs/flow/<providerJobId>/<sha256>.<ext>`; arquivos externos e symlinks não são aceitos.
- O estado da operação deve ser `completed` com recibo de vídeo; o `providerJobId` precisa corresponder ao job do passo e a conta deve ser Google Flow.
- Um StoryGuide aprovado precisa vincular o workflow. O shot `video-*` precisa existir exatamente uma vez no `EDIT_MANIFEST.json` e corresponder a `production.json` e ao registro canônico do workflow.
- A duração e proporção de entrada precisam atender às regras do storyboard aprovado. Nenhum trecho ausente é completado por IA nem pelo renderizador.
- Só são aceitos os pacotes originais do projeto dentro de `.studio/stories/<storyId>/{production,offline-render}`. Não se grava em diretórios arbitrários.
- Os hashes da mídia e do mapeamento são obrigatórios para anexação; um lock local serializa a alteração e a gravação do manifesto é atômica.
- Arquivos e hashes validam integridade técnica, **não** identidade visual, direitos autorais, custo real do Flow nem autenticidade criptográfica de quem executou a CLI. Prove aprovações editoriais por procedimento próprio.

## Limites atuais

- Esta ponte **não gera** imagens, clipes, áudio ou legendas; não baixa ativos por conta própria. Ela consome o recibo persistido pelo módulo F3.
- O StoryGuide gera `video.frames` por padrão, ainda não implementado pela bridge F3. Por isso o percurso completo de produção autenticada continua **bloqueado** até existir um upstream comprovado para essa operação. Não declarar F3 homologada com base nos testes offline desta ponte.
- Não existe sincronização entre contas nem associação automatizada de todos os clipes sem revisão. O operador seleciona cada plano e conserva a decisão explícita.
- Os metadados de proveniência em JSON são locais e editáveis: ajudam na auditoria, mas não equivalem a um recibo assinado por Google.

## Testes

`tests/flow-media-link.test.mjs` valida associação real com arquivos MP4, render com proveniência, idempotência, histórico, concorrência otimista, uso de conta correta, ausência de prova, symlinks, troca de arquivo, proporção e duração. Sem conta Google ou créditos. Em instalação com dependências npm, `npm run test:mcp` confere que o planejador read-only está publicado e o comando de anexação **não** está.
