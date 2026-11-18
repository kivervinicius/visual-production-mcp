# Visual Production MCP

[![CI](https://github.com/kivervinicius/visual-production-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/kivervinicius/visual-production-mcp/actions/workflows/ci.yml)

**v0.6.0 (experimental) · MCP para transformar histórias em planos de produção audiovisual · Local-first · Google Flow como primeiro adaptador**

> **Comece com uma história, não com um JSON.** O usuário conta sua história ou fornece um arquivo `.md`/`.txt`; seu agente de IA (Codex, Antigravity ou outro cliente MCP) conduz a preparação passo a passo. O MCP preserva a fonte, valida a rastreabilidade do material proposto, organiza personagens/cenários/cenas e compila prompts e tarefas para produzir imagens e vídeos no provedor conectado.
>
> **Limite importante:** hoje o percurso **história → bíblia visual → storyboard → manifestos/workflow** funciona localmente e é testado. O percurso **workflow → geração real no Google Flow → download → edição final** ainda precisa de um adaptador autenticado e homologado. Não confunda *plano de produção* com *mídia gerada*.

## Plano de finalização e desenvolvimento

A versão atual é **v0.6.0 (planejamento guiado, biblioteca visual versionada e revisão por shot)**: ainda não é gerador de episódios completo. A estratégia de conclusão e os critérios para declarar v1.0 estão documentados em [Plano de finalização](docs/FINALIZATION_PLAN.md), [Jornada do produto](docs/PRODUCT_JOURNEY.md), [Arquitetura-alvo](docs/TARGET_ARCHITECTURE.md) e [Matriz de aceite](docs/ACCEPTANCE_MATRIX.md).

Para agentes, há uma [Skill de direção audiovisual](skills/visual-production-director/SKILL.md) que conduz a jornada usando ferramentas disponíveis e deixa explícitas as integrações ainda pendentes. Para implementar os próximos marcos, consulte o [Runbook](docs/IMPLEMENTATION_RUNBOOK.md) e [CONTRIBUTING.md](CONTRIBUTING.md). A documentação técnica está indexada em [docs/README.md](docs/README.md).

**Regra de produto:** uma pessoa fornece a história e aprova as decisões essenciais; o MCP guarda progresso, evidências e próxima ação. O Flow real e a montagem final dependem de trabalhos técnicos ainda não homologados.

## Acompanhamento da produção (v0.5)

A partir de uma história registrada, **o agente não precisa lembrar de conversas antigas**. Na entrada de cada sessão, use `production_get_status` e `production_get_next_action`. O StageEngine mostra dez fases, decisões pendentes, bloqueios e o trabalho imediato. Para saber o que mudou desde a última consulta, use `production_events` com o cursor retornado anteriormente; o servidor não envia notificações quando não há cliente conectado.

```bash
npm run operator -- production-status oficina-ep01
npm run operator -- production-next oficina-ep01
npm run operator -- production-events oficina-ep01 0
```

Após registrar elenco e storyboard, o comando de aprovação editorial recomendado é:

```bash
# Copie o reviewVersion real do production-status.
npm run operator -- production-decision oficina-ep01 approve <reviewVersion>
# Para pedir revisão antes de aprovar:
npm run operator -- production-decision oficina-ep01 request_changes <reviewVersion> "Justificativa"
```

Esses comandos existem **somente no CLI do operador**, não como aprovação MCP pelo agente. A etapa `DELIVERY` permanece `PENDING` até existir vídeo final validado, capacidade ainda não implementada. Consulte o [contrato detalhado do StageEngine](docs/STAGE_ENGINE.md) e as [limitações atuais](docs/IMPLEMENTATION_GAPS.md).

## Continuidade visual e reaproveitamento (v0.6 / F2)

A biblioteca visual agora mantém **personagens, cenários, estilos e objetos** com `libraryId`, versão imutável, SHA-256 de imagens, origem declarada e aprovação do operador. O agente pode **propor** uma referência, mas não autoaprovar sua qualidade. Para consultar: `studio_visual_list`, `studio_visual_get` e `studio_visual_project_readiness`; para reaproveitar entre episódios, fixe `libraryId`/`libraryVersion` no elenco e cenário.

Quando já houver uma versão aprovada que corresponde ao briefing, `studio_story_prepare` copia suas imagens para o pacote canônico e programa `asset.upload` para aquela conta Flow — **não recria a ficha visual**. O ID remoto permanece exclusivo da conta e deve ser verificado. O pacote não deixa de gerar os stills e vídeos de cenas; o Google Flow real ainda precisa de homologação.

Para cada imagem de cena, use `studio_visual_shot_submit` e, depois, a revisão humana `visual-shot-review` no CLI. As variantes rejeitadas permanecem preservadas e apenas o plano necessário precisa ser refeito. `studio_visual_impact` indica o que seria afetado por uma nova versão global, sem executar regeneração.

[**Tutorial detalhado da Biblioteca Visual**](docs/VISUAL_LIBRARY.md) — exemplos de JSON, aprovação de referência, revisão de shot, hashes, vínculo entre histórias e limitações de produção.

## 1. O que é — e o que o usuário precisa fornecer

A experiência pretendida é: **“Aqui está minha história. Ajude-me a transformá-la em um vídeo completo.”** Não é necessário começar sabendo programar, listar cenas, escolher um modelo Veo ou preencher um manifesto.

O agente conduz a conversa criativa; o MCP é a camada persistente e determinística. Ele não possui um LLM embutido e **não interpreta histórias sozinho** quando chamado diretamente por um script. A transformação do texto em decisões criativas é feita pelo agente conectado, com revisão humana.

```text
HISTÓRIA (texto / .txt / .md)
    │  preservar original + SHA-256
    ▼
1. ANÁLISE NARRATIVA          ← IA identifica; MCP exige citações literais
    │ elenco / locais / hipóteses criativas
    ▼
2. BÍBLIA VISUAL             ← estilo e aparência consistentes
    │ revisável antes de montar o storyboard
    ▼
3. STORYBOARD                ← cenas ordenadas, planos, duração e movimento
    │ revisão/ aprovação editorial explícita
    ▼
4. PACOTE LOCAL              ← production.json / workflow.json / guias
    │ cada etapa vinculada ao roteiro e à conta destino
    ▼
5. GOOGLE FLOW [ADAPTADOR]   ← imagens de personagens e cenários
    │ → frames das cenas → vídeos → composição opcional
    ▼
6. REVISÃO / ENTREGA         ← downloads, consistência e edição final
       (integração e montagem automatizadas ainda pendentes)
```

A pessoa permanece dona do roteiro e pode reutilizar a bíblia visual em novos episódios. Os projetos e IDs nativos de cada conta Google são **separados**; não há transferência de créditos nem clonagem mágica entre contas.

## 2. Estado real das funcionalidades

| Etapa | Estado na v0.5.0 | O que acontece de fato |
| --- | --- | --- |
| Receber história colada ou arquivo UTF-8 | **Implementado** | Salva snapshot local imutável com SHA-256 |
| Guiar análise de personagens e cenários | **Implementado com agente** | Ferramentas, validação de trechos e checkpoint; interpretação por LLM externo |
| Definir estilo, identidade, cenários e hipóteses | **Implementado com agente** | Bíblia proposta e audível antes da aprovação |
| Dividir roteiro em cenas e planos | **Implementado com agente** | Checa IDs, relações, citações da história e cobertura aproximada |
| Gerar `production.json`, `workflow.json`, storyboard e bíblia | **Implementado** | Compila arquivos determinísticos sem gastar créditos |
| Planejar referências → imagens → vídeos | **Implementado** | DAG com dependências e IDs limitados a uma conta |
| Descobrir schema de MCP upstream | **Implementado, se houver MCP configurado** | Testa disponibilidade da ferramenta e parâmetros, não login real |
| Criar personagens, imagens ou vídeos no Flow | **Não homologado** | Requer adaptador real, autenticação, ferramentas existentes e aprovação |
| Sincronizar referências entre contas | **Planejamento apenas** | Binding local; upload e hash remotos ainda não verificados |
| Download e revisão de clipes gerados por workflow | **Manual/parcial** | Há ingestão verificada para jobs legados; não está integrado automaticamente à DAG |
| Consultar 10 fases, próxima ação e eventos com retomada | **Implementado localmente** | Estado durável no StageEngine; não afirma que mídia remota foi validada |
| Renderizar episódio final (FFmpeg/áudio/legenda) | **Pendente** | Exporta ordem de montagem, não MP4 final |
| Biblioteca visual reutilizável e revisão de still por shot | **Implementado localmente (v0.6)** | Versões, fingerprints, referências SHA-256, aprovação no CLI e impacto seletivo; upload real ainda pendente |
| Higgsfield | **Arquitetura prevista** | Ainda não existe adaptador end-to-end verificado |

O catálogo em `src/flow-operations.mjs` descreve **23 tipos de operações do produto Flow**; não significa que tenhamos 23 ações de navegador implementadas. Consulte [pendências](docs/IMPLEMENTATION_GAPS.md).

## 3. Instalação para desenvolvedores e agentes

### Requisitos

- Node.js **20 ou superior** (CI usa Node 22), npm e um cliente que aceite MCP stdio.
- Acesso ao repositório: [kivervinicius/visual-production-mcp](https://github.com/kivervinicius/visual-production-mcp).
- Para planejar roteiros **não é necessário** ter conta no Flow nem instalar FFmpeg.
- Para usar o Flow de verdade, instale um MCP de Flow compatível, autentique a sessão manualmente no navegador e valide as condições do provedor.
- FFprobe/FFmpeg só são necessários para inspeção técnica de vídeos e pós-produção futura.

```bash
# Para testar a branch de desenvolvimento:
git clone https://github.com/kivervinicius/visual-production-mcp.git
cd visual-production-mcp
npm install
npm run check
npm test
npm run test:mcp # handshake real MCP após instalar dependências

mkdir -p .studio
cp examples/upstreams.example.json .studio/upstreams.json
cp examples/adapters.example.json .studio/adapters.json
```

> Se a branch já tiver sido integrada à `main`, faça um clone normal. **Não cole IDs, senhas, cookies nem tokens Google** nos arquivos JSON versionados.

### Executar como MCP no Codex

Use caminhos absolutos. Defina `STUDIO_HOME` de preferência para evitar que o mesmo servidor crie estados diferentes dependendo do diretório de execução do agente.

```bash
codex mcp add visual-production \
  --env STUDIO_HOME=/caminho/visual-production-mcp/.studio \
  -- node /caminho/visual-production-mcp/src/server.mjs
```

Para Antigravity, Cursor ou outro host MCP stdio, configure a mesma invocação:

```json
{
  "mcpServers": {
    "visual-production": {
      "command": "node",
      "args": ["/caminho/visual-production-mcp/src/server.mjs"],
      "env": { "STUDIO_HOME": "/caminho/visual-production-mcp/.studio" }
    }
  }
}
```

O formato externo de configuração depende da versão do cliente MCP. Inspecione suas configurações reais antes de sobrescrevê-las. Arquivos em `.studio/` são locais e ignorados pelo Git.

## 4. Início rápido: somente uma história

Copie a história abaixo para `minha-historia.md`, **ou cole a sua história diretamente na conversa com o agente**.

```text
Lia abre a porta da oficina. O relógio está parado. Ela vê a cidade submersa pela janela.

Lia acende uma lanterna e sai em silêncio.
```

Um exemplo pronto está em [`examples/story.example.md`](examples/story.example.md). No Codex/Antigravity, peça:

> **Transforme esta história em uma produção audiovisual vertical 9:16 usando Visual Production MCP.** Leia o texto integral, preserve o roteiro, proponha elenco/cenários e estilo, declare qualquer hipótese visual, monte um storyboard plano a plano, mostre o resultado para revisão e prepare os arquivos. Não consuma créditos nem produza vídeos antes da minha aprovação. Use os instrumentos `studio_story_*`; não crie dados nem IDs de mídia do Flow fictícios.

O agente deve seguir este roteiro de ferramentas:

### Passo 1 — Registrar a fonte

`studio_story_start` recebe `{ "id": "oficina-ep01", "title": "A Oficina", "storyText": "...", "aspectRatio": "9:16" }`, ou substitua `storyText` por `storyPath` para um arquivo já existente na máquina do MCP.

O servidor preserva o texto sob `.studio/stories/oficina-ep01/source.md`, calcula SHA-256 e retorna uma **próxima ação**. Para histórias grandes, `studio_story_source` disponibiliza blocos de até 12.000 caracteres, com `offset` e `hasMore`; o agente precisa ler **todos** os blocos antes de fazer o plano.

O mesmo ID com história diferente é recusado. Para novas versões do roteiro, utilize outro ID; nunca reescreva silenciosamente o que já foi aprovado.

### Passo 2 — Propor o elenco, os locais e a identidade visual

O agente lê a fonte e envia `studio_story_submit_cast` com `visualStyle`, `characters`, `locations` e `assumptions`. Veja o contrato completo em [`examples/cast.example.json`](examples/cast.example.json).

Cada personagem/local possui `sourceExcerpt`: **trecho literal que aparece no roteiro**. O sistema rejeita entradas sem evidência textual. A aparência (roupa, cabelo, paleta) que não estiver descrita no roteiro pode ser sugerida, **mas deve constar entre as hipóteses** e depende de revisão humana.

Os personagens recebem identidade global opcional `libraryId` e versão imutável. Isso permite reaproveitar a mesma identidade visual em episódios futuros, sem reescrever a descrição a cada geração. O MCP não cria automaticamente uma foto de personagem nesta etapa.

### Passo 3 — Montar o storyboard

`studio_story_submit_storyboard` recebe cenas e planos ordenados; exemplo em [`examples/storyboard.example.json`](examples/storyboard.example.json).

Cada plano contém:

| Campo | Propósito |
| --- | --- |
| `sourceExcerpt` | Trecho exato da história que justifica a ação |
| `visualPrompt` | Composição do quadro/imagem base |
| `motionPrompt` | Ação e movimento para o vídeo |
| `durationSeconds` | Duração pretendida (a disponibilidade real varia por modelo) |
| `characterIds` | Personagens do elenco autorizado que aparecem |
| `camera` / `audio` | Direção complementar, opcional |

O MCP valida IDs, personagens, localização, duplicação de planos, citações textuais e ordenação. Informa uma **cobertura aproximada do texto** pelas cenas; cobertura baixa é alerta para revisão, não sinal de que o LLM pode inventar material para preencher lacunas.

Para retomar a produção em outro cliente, `studio_story_draft` recupera o elenco e o storyboard persistidos, sem depender do histórico da conversa.

Antes da aprovação, o agente deve mostrar quais personagens e ambientes serão produzidos, quantos planos existem, a ordem das cenas e quais escolhas criativas foram acrescentadas.

### Passo 4 — Aprovar a direção editorial

A aprovação é **local e explícita**, no terminal do operador:

```bash
npm run operator -- story-status oficina-ep01
npm run operator -- production-status oficina-ep01
# Use reviewVersion retornado pelo status:
npm run operator -- production-decision oficina-ep01 approve <reviewVersion>
```

Não exponha a aprovação editorial como ferramenta autônoma do MCP. Depois de aprovar, a bíblia e o storyboard são congelados para a compilação; alterações significativas precisam de uma nova versão da história.

### Passo 5 — Escolher a conta de destino e preparar tudo

Primeiro, o usuário cadastra uma sessão Google Flow que já autorizou, usando `studio_register_account`. Isso é apenas um registro **lógico** do perfil, não login automático; informe orçamento estimado conscientemente. Por exemplo:

```json
{
  "id": "google-01",
  "provider": "google-flow",
  "label": "Flow — projeto pessoal",
  "authorized": true,
  "creditEstimate": 100,
  "upstreamId": "flow-account-01"
}
```

Em seguida, `studio_story_prepare` recebe:

```json
{
  "storyId": "oficina-ep01",
  "accountId": "google-01",
  "videoEstimatedCredits": 25,
  "imageEstimatedCredits": 0,
  "includeCharacterCreation": false,
  "includeSceneCompose": false
}
```

Os valores de créditos são **estimativas fornecidas pelo operador**; `imageEstimatedCredits: 0` não implica imagens ilimitadas ou gratuitas. Confirme no Flow as quotas e o custo exato da operação antes de aprová-la. `includeCharacterCreation`/`includeSceneCompose` são opcionais, pois nem todo upstream tem essas operações automatizadas.

O comando **não gera imagens ou vídeos**. Ele gera os arquivos necessários e os registra no banco local. A escolha de modelo, duração e formatos precisa ser verificada no Flow no momento da execução, sem substituições silenciosas.

### Passo 6 — O pacote que fica pronto

```text
.studio/stories/oficina-ep01/
├── source.md                    # história original / hash verificado
└── production/
    ├── CHARACTER_BIBLE.md       # estilo, personagens, cenários, evidências
    ├── STORYBOARD.md            # cenas, planos, câmera, movimento, áudio
    ├── production.json          # material canônico + personagens + shots
    ├── workflow.json            # DAG de imagens, frames e vídeos por conta
    ├── EDIT_MANIFEST.json       # ordem prevista para edição
    └── RUNBOOK.md               # roteiro operacional e limitações
```

Por exemplo, o workflow compila as dependências abaixo:

```text
character-image-lia   location-image-oficina
         \                 /
          \               /
           frame-abertura
                │
           video-abertura
                │
          scene-entrada (opcional)
```

O plano exige que a imagem do personagem seja produzida e identificada **antes** de gerar a imagem da cena; a imagem da cena é usada como quadro inicial do vídeo. IDs nativos pertencem à conta de destino e não podem ser reutilizados em outra. O sistema agora recusa adaptadores que descartem um `startFrame`, `referenceImages`, `aspectRatio` ou outro campo criativo sem avisar.

### Passo 7 — Executar no Flow (integração ainda a homologar)

O operador configura `.studio/upstreams.json` (processo MCP existente) e `.studio/adapters.json` (correspondência de cada operação com a ferramenta **real** anunciada pelo upstream). O exemplo de adapters tem placeholders deliberados; **não é um adaptador funcional pronto**.

O agente usa:

1. `studio_workflow_plan` — verificar pré-requisitos e dependências;
2. `studio_workflow_inspect_step` — verificar ferramenta MCP, schema e referências;
3. `npm run operator -- workflow-approve <workflowId> <stepId>` — aprovação local da etapa;
4. `studio_workflow_execute_step` — tentativa única de execução aprovada;
5. conferir no Flow o ID de operação e o asset realmente produzido;
6. `npm run operator -- workflow-reconcile ...` / `workflow-complete ...` somente após verificação externa.

**A aprovação editorial do passo 4 não equivale a autorizar gastos no passo 7.** Erros de rede, submissões sem ID confiável ou formulários apenas preparados resultam em estado `submission_unknown`, que bloqueia reenvios automáticos. O servidor não contorna CAPTCHA, limites de contas ou regras de serviço.

### Passo 8 — Revisar e finalizar

O workflow preserva a ordem das cenas no `EDIT_MANIFEST.json`, mas **não faz a montagem final de MP4** nesta versão. O processo ainda deve baixar os originais, conferir personagem a personagem, identificar cortes ruins e montar trilha, áudio, legendas e créditos num pipeline de pós-produção. Não se deve declarar um episódio entregue por ter somente job IDs do Flow.

## 5. Personagens reutilizáveis e múltiplas contas

- **Biblioteca canônica**: `libraryId@version`, descrição e hashes de referências ficam no workspace, independentes do fornecedor.
- **Projeto por conta**: uma conta do Flow mantém os seus próprios projetos, referências e IDs; o mesmo asset local precisa de vínculo específico no destino.
- **Sem pooling**: créditos não são somados nem transferidos. Estimativas, limites e autorizações são individuais.
- **Sem rotação evasiva**: este projeto não automatiza mudança de conta para contornar limites, bloqueios ou condições do Flow.
- **Paralelismo futuro**: a distribuição explícita de cenas entre contas autorizadas pode ser adicionada depois de validar sincronização de mídia real e os termos aplicáveis. Uma montagem que cruza contas deve usar arquivos exportados, não IDs de outra sessão.

`studio_sync_plan` informa o que precisa ser sincronizado para um *shot*; `studio_bind_project` registra os IDs que o operador verificou. Essas rotinas ainda **não comprovam** que upload/sincronização remota aconteceu.

## 6. Ferramentas MCP

### Assistente de história (novas na v0.4)

| Ferramenta | Para que serve | Consome créditos? |
| --- | --- | --- |
| `studio_story_start` | Recebe texto ou arquivo e preserva a história | Não |
| `studio_story_list` | Lista histórias e etapas | Não |
| `studio_story_status` | Mostra checklist/etapa e próxima ação | Não |
| `studio_story_draft` | Recupera elenco e storyboard para revisão ou troca de agente | Não |
| `studio_story_source` | Lê história por blocos com integridade | Não |
| `studio_story_submit_cast` | Registra elenco, cenários, estilo e hipóteses | Não |
| `studio_story_submit_storyboard` | Registra cenas e planos com rastreabilidade | Não |
| `studio_story_prepare` | Compila o pacote e o DAG de produção | Não |

### Produção existente (v0.2/v0.3)

- Projeto e conta: `studio_library`, `studio_status`, `studio_import_project`, `studio_register_account`, `studio_update_balance`, `studio_bind_project`, `studio_sync_plan`, `studio_plan`, `studio_bundle`.
- Verificação e mídia: `studio_preflight`, `studio_discover_upstream`, `studio_dispatch_job`, `studio_record_failure`, `studio_ingest_result`.
- Fluxo Google Flow: `studio_flow_capabilities`, `studio_workflow_import`, `studio_workflow_list`, `studio_workflow_status`, `studio_workflow_plan`, `studio_workflow_inspect_step`, `studio_workflow_execute_step`.

As ferramentas `studio_story_*` **não aprovam** sua própria qualidade nem gastos. A CLI local permite as operações de confiança separadas: `story-approve`, `workflow-approve`, `workflow-reconcile`, `workflow-complete`, `review`, etc. Use `npm run operator --` sem argumentos para ver os comandos.

## 7. Organização do código

```text
src/
  story-guide.mjs        Recebimento de história, stages, validação editorial, compilação
  core.mjs               Repositório canônico, personagens versionados, sessões e jobs
  workflows.mjs          DAG imutável, status, dependências, orçamento e aprovação
  workflow-adapter.mjs   Mapeamento de argumentos, preflight e execução fail-closed
  flow-operations.mjs    Catálogo de 23 operações documentadas (não garantia de suporte)
  upstream.mjs           Cliente MCP stdio para o provedor já instalado
  media.mjs              Ingestão e hash de resultados dos jobs legados
  preflight.mjs          Diagnóstico local, sem usar créditos
  server.mjs             Registro das ferramentas MCP
  cli.mjs                Aprovação, conciliação e revisão apenas pelo operador
examples/                História, cast, storyboard, templates e adapters de exemplo
tests/                   Testes locais (sem geração real no Flow)
docs/                    Arquitetura, backlog, riscos e contratos
```

**Persistência atual:** `.studio/state.json` protegido por lock de filesystem. Escalar para muitos workers simultâneos requer SQLite/WAL, versionamento de schema, backups, leases e recuperação após crash. Não use diretórios `.studio/` em discos compartilhados sem avaliar garantias de locking.

## 8. Testes e diagnóstico

```bash
npm run check
npm test
npm run operator -- story-start oficina-ep01 'A Oficina' examples/story.example.md
npm run operator -- story-status oficina-ep01
```

> Este exemplo usa o arquivo de história; a análise de elenco e storyboard é realizada pelo agente MCP, não pelo comando CLI. Os arquivos de `cast` e `storyboard` em `examples/` servem como contratos e referência para os argumentos das ferramentas.

Problemas típicos:

- **“Missing remote project binding”**: associe um projeto real na conta correta; nunca invente o ID.
- **“Adapter drops required creative input”**: ajuste o mapping para que o upstream receba a referência/duração/modelo ou escolha outra operação após nova aprovação.
- **“submission_unknown”**: não repita. Consulte histórico/IDs do Flow e reconcilie com evidência.
- **“sourceExcerpt is not an exact quotation”**: recopie o trecho literalmente do `studio_story_source`.
- **“Storyboard already approved”**: crie um novo ID/versionamento, não modifique silenciosamente a fonte aprovada.
- **“No authorized account”**: cadastre uma sessão lógica com `studio_register_account`; isso não garante login no Flow.
- **“Module not found @modelcontextprotocol/…”**: rode `npm install` num ambiente com acesso ao registro npm e verifique a compatibilidade do SDK.
- **“Flow UI changed / unsupported model”**: desabilite essa operação até que o adaptador seja atualizado e homologado.

## 9. Roadmap e contribuições

| Prioridade | Próximo marco | Evidência mínima para chamar de pronto |
| --- | --- | --- |
| P0 | Assistente guiado de história | **Implementado localmente**; contrato dos passos testado |
| P0 | Conta Flow autenticada + operação real | Imagem e vídeo efetivamente criados, IDs corretos, créditos conferidos |
| P0 | Upload incremental de referências | Hash canônico vinculado a mídia remota correta e reutilização comprovada |
| P1 | Recuperação/download de mídia | Reanexar job sem duplicar gasto, FFprobe/sha256, testes de falha |
| P1 | Revisão e montagem final | Contact sheets, versão aprovada, FFmpeg, trilha e legendas |
| P2 | Recursos avançados do Flow | Edit, Extend, Scenebuilder, Agent, Tools, avatars/voices por detecção real |
| P2 | Higgsfield e outros provedores | Contratos e testes de integração independentes |
| P2 | UI de acompanhamento | Somente depois de haver fluxo operacional confiável |

Acompanhe [issues](https://github.com/kivervinicius/visual-production-mcp/issues), [contrato do Flow](docs/FLOW_WORKFLOWS.md), [lacunas de implementação](docs/IMPLEMENTATION_GAPS.md) e [segurança](docs/SECURITY.md).

## 10. Referências oficiais e licenciamento

- [Google Flow — produto e recursos](https://labs.google/fx/tools/flow)
- [Criar vídeos no Flow](https://support.google.com/flow/answer/16353334)
- [Criar e editar imagens](https://support.google.com/flow/answer/16729550)
- [Editar vídeos e utilizar Scenebuilder](https://support.google.com/flow/answer/16935718)
- [Organizar projetos, assets e personagens](https://support.google.com/flow/answer/16935308)
- [Modelos e recursos disponíveis](https://support.google.com/flow/answer/16352836)

Projeto independente, **não oficial** e sem afiliação com Google ou Higgsfield. Operações e disponibilidade mudam por modelo, plano, região e política do provedor. Não remova marcas de procedência nem colete senhas, cookies, tokens de sessão ou códigos de autenticação.

**Licença:** MIT (código próprio). Estado, histórias, referências e mídias permanecem locais sob `.studio/` e não são enviados ao GitHub por padrão.
