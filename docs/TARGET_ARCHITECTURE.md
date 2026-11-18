# Arquitetura-alvo e organização incremental do código

**Decisão:** monólito modular Node.js ESM, com uma única distribuição MCP/CLI e adaptadores isolados. Preservar a API atual durante a migração. Não começar por NX/monorepo, múltiplos serviços, API HTTP pública ou UI própria.

## Responsabilidades arquiteturais

```text
Codex / Antigravity / qualquer cliente MCP
                 │
        Skill de direção audiovisual
                 │ decisões, orientações, uso de ferramentas
                 ▼
             Interfaces
           MCP / CLI / (UI futura)
                 │
              Aplicação
     stage engine · planejamento · execução
       aprovações · retomada · entrega
                 │
               Domínio
 story/revisions · bible · shots · assets
        approvals · accounts · jobs
                 │ ports explícitos
            Infraestrutura
  SQLite/WAL · filesystem · events · ffmpeg
      Google Flow adapter · Higgsfield
```

A Skill orienta e conversa. O MCP é fonte de verdade para progresso e next-action. O provedor produz mídia; não controla os estados canônicos nem altera a história. O FFmpeg é uma etapa de entrega, não o modelo de negócio.

## Estrutura proposta (alvo, não diretórios existentes)

```text
visual-production-mcp/
├── src/
│   ├── domain/
│   │   ├── story/             # StorySource/Revision, citações, invariantes
│   │   ├── creative/          # bible, character/location/style versions
│   │   ├── production/        # scene, shot, coverage, workflow DAG
│   │   ├── jobs/              # máquina de estados, custo, aprovações
│   │   └── contracts/         # schemas Zod + JSON schemas publicados
│   ├── application/
│   │   ├── guide/             # currentStage/nextAction/submitDecision
│   │   ├── prepare/           # story → briefs → storyboard → assets
│   │   ├── execute/           # scheduler e reconciliação por shot
│   │   └── deliver/           # QC, timeline, exportação
│   ├── ports/                 # storage, provider, event sink, media renderer
│   ├── adapters/
│   │   ├── storage/           # SQLite WAL e filesystem de blobs
│   │   ├── providers/
│   │   │   ├── google-flow/   # perfil, capability, bridge, receipts
│   │   │   └── higgsfield/   # futura integração oficial
│   │   ├── media/             # FFmpeg/FFprobe
│   │   └── events/            # event log + outbox de notificações
│   └── interfaces/
│       ├── mcp/               # registry, schemas, presenters
│       └── cli/               # comandos exclusivos do operador
├── skills/visual-production-director/SKILL.md
├── schemas/                     # JSON schemas versionados para agentes
├── examples/                    # história → projeto + fixtures de referência
├── tests/
│   ├── unit/                   # invariantes do domínio
│   ├── contract/               # compatibilidade de adapters/upstreams
│   ├── integration/            # storage/stdio/FFmpeg com mocks
│   ├── e2e/                    # fixture simulado e live opcional
│   └── fixtures/
├── scripts/                     # tarefas operacionais e checks
└── docs/                        # jornada, ADRs, implementação, segurança
```

Não criar todas as pastas vazias agora. Usar esta organização quando a responsabilidade correspondente for implementada e testada. Evitar importar `interfaces` ou `adapters` de dentro de `domain`.

## Mapeamento do código atual para o destino

| Módulo atual (v0.4) | Responsabilidade atual | Destino e refatoração segura |
|---|---|---|
| `src/core.mjs` | `StudioStore`, estado, jobs, biblioteca e contas | Extrair `storage` primeiro, depois `domain/jobs` e `application/prepare` |
| `src/story-guide.mjs` | validação cast/storyboard, persistência, guia e compilação | `domain/story`, `domain/creative`, `application/guide` e `application/prepare` |
| `src/workflows.mjs` | DAG, estados, orçamento, transições | `domain/production`, `domain/jobs`, `application/execute` |
| `src/workflow-adapter.mjs` | schema do upstream, mapeamento e dispatch | `ports/provider`, `adapters/providers/*`, `application/execute` |
| `src/upstream.mjs` | conexão MCP stdio com executável externo | `adapters/providers/google-flow/transport` (reutilizável por provider) |
| `src/media.mjs` | ingestão, verificação de arquivo, revisão | `adapters/media`, `application/deliver` |
| `src/preflight.mjs` | verificações locais/provider | `application/execute/preflight` |
| `src/flow-operations.mjs` | catálogo de operações documentadas | `adapters/providers/google-flow/capabilities`; cada capability com status verificado |
| `src/server.mjs` | schemas e handlers MCP | `interfaces/mcp` com registration modular |
| `src/cli.mjs` | comandos operador | `interfaces/cli`; não expor aprovações humanas a agentes autônomos |

## Regras de dependências

- Domínio usa funções puras, schemas e tipos sem importar SDK MCP, browser, sistema de arquivos ou FFmpeg.
- Aplicação orquestra operações através de `ports`: `ProviderPort`, `AssetStorePort`, `StateStorePort`, `MediaPort`, `EventPort`.
- Adapters implementam ports e normalizam resultados; a UI do Google Flow e seus seletores não vazam para `domain`.
- Ferramentas MCP são *thin controllers*: parse de input, autenticação/contexto, use case, resultado estruturado; não guardam workflow em closures da sessão.
- Aprovação editorial, autorização de gastos e reconciliação manual são comandos exclusivos do operador; um agente não pode autoconcedê-los.
- Uma versão canônica imutável pode gerar várias tentativas/variantes; nenhuma tentativa sobrescreve o asset original.
- Eventos de progresso representam **evidência**, não porcentagem arbitrária; `pendingActions` permite avisar e retomar sem histórico de chat.

## Modelo persistente sugerido

`StorySource(id, revision, sha256, uri, language)`; `Production(id, storyRevision, status)`; `CharacterVersion(libraryId, version, description, referenceHashes, approvedAt)`; `LocationVersion`; `Scene(id, sourceSpans)`; `Shot(id, sceneId, order, sourceExcerpt, visualPlan, motionPlan)`; `Asset(sha256, kind, origin, rights, mediaInfo)`; `AssetBinding(assetSha, provider, accountId, remoteProjectId, remoteAssetId)`; `ProviderSession`; `Job(id, idempotencyKey, state, operationId, accountId, creditQuote, resultHash)`; `Approval(actor, scope, targetVersion, decision, timestamp)`; `Event(seq, projectId, type, causationId, payload)`; `Delivery(version, files, qcReport)`.

Schemas devem ser versionados no próprio manifest (`schemaVersion`). Migração de `state.json` para SQLite: ferramenta de importação e backup, teste de rollback, isolamento por workspace, WAL, unique key em idempotência, lease/heartbeat, outbox de eventos. **Não** migrar de uma vez sem fixture de compatibilidade.

## Contrato mínimo do adaptador

```ts
interface ProviderPort {
  inspectSession(accountId): Promise<SessionEvidence>;
  capabilities(accountId): Promise<CapabilityEvidence>;
  ensureProject(accountId, localProjectId): Promise<ProviderProjectBinding>;
  ensureReference(accountId, projectId, assetSha): Promise<ProviderAssetBinding>;
  quote(accountId, operation): Promise<CreditQuote | UnsupportedFeature>;
  submitOnce(accountId, approvedOperation): Promise<SubmissionReceipt | SubmissionUnknown>;
  reconcile(accountId, operationId): Promise<ProviderJobStatus>;
  download(accountId, mediaId, destination): Promise<DownloadedAsset>;
}
```

É um **contrato-alvo ilustrativo**, não uma interface já implementada. `submitOnce` exige idempotência local e nunca repete um gasto depois de resposta ambígua. Quando o provedor não oferecer API oficial para uma capability, documentar a limitação e a estratégia de fail-closed.

## Estratégia de migração e manutenção

1. Primeiro testes caracterizadores dos módulos atuais (entradas, estados e saídas). Não alterar nomes de ferramentas MCP nessa etapa.
2. Extrair repositórios de estado e contratos de domínio, preservando facades `Studio`, `StoryGuide` e `WorkflowStudio` para compatibilidade.
3. Introduzir `StageEngine` e `NextAction` como novo caso de uso, com eventos de auditoria e integrações opcionais.
4. Introduzir adapter específico Google Flow e fixtures de contrato; jamais tentar implementar todas as operações catalogadas em uma só alteração.
5. Migrar persistência para SQLite quando houver concorrência/leases; testar restore de `state.json` legado.
6. Adicionar delivery FFmpeg e só depois ampliar provider/hardware/interface.

PRs de refatoração estrutural **não** devem ao mesmo tempo adicionar geração paga: isso torna regressões e cobrança indevida difíceis de diagnosticar. Para cada PR: um módulo + regressões + migration note + docs + possibilidade de rollback.
