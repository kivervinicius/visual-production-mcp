# F3 — Google Flow real: bridge de uma conta (piloto v0.7)

Este guia descreve a **integração efetivamente implementada** em `src/providers/google-flow/miyakejima.mjs`. Não é a homologação do Flow inteiro. A implementação F3 suporta somente `image.generate` **sem referências** e `video.text` **sem frames**, usando um upstream [miyakejima/google-flow-mcp](https://github.com/miyakejima/google-flow-mcp) compatível com as ferramentas descritas na documentação desse projeto.

## Matriz de suporte (v0.7)

| Recurso | Estado | Comprovação exigida |
| --- | --- | --- |
| Identificar a conta upstream selecionada | Implementado (inspeção read-only) | `flow_list_accounts` contém o perfil solicitado |
| Verificar workspace e modelos disponíveis | Implementado (inspeção read-only) | `flow_inspect_account`: `signedIn`, `workspaceAvailable`, modelos/ratios/durações |
| Inspecionar schema das ferramentas | Implementado (inspeção read-only) | `listTools()` + argumentos exatos |
| `image.generate` sem referência | Bridge implementada; **não homologada ao vivo** | Job UUID, arquivo local, SHA-256, revisão editorial |
| `video.text` sem referência | Bridge implementada; **não homologada ao vivo** | Job UUID, arquivo local, FFprobe, revisão editorial |
| Poll de job existente | Implementado (sem geração) | `flow_job_status` mesmo UUID/perfil |
| Download de job existente | Implementado (sem nova geração) | `flow_download_job` mesmo UUID/perfil |
| Arquivo original content-addressed | Implementado (SHA-256 + assinatura ou FFprobe) | `.studio/outputs/flow/<uuid>/<sha>.<ext>` |
| `asset.upload` / `video.frames` / `video.ingredients` | **Não implementado neste bridge** | Exigirá transporte de referências/frames validado, sem perder semântica |
| Clonar projetos nativos, edição, Scenebuilder, Flow Agent | **Não implementado** | Homologação por operação independente |
| Quote exato de créditos | **Não implementado** | Capturar cotação da UI do provedor antes da execução paga |
| Submissão autenticada nesta entrega | **Não executada pelo mantenedor** | Operador local deve conectar sua própria conta e registrar evidência |

O produto oficial Flow permite texto, frames e ingredientes para vídeos, mas **isso não significa que este upstream MCP exponha um contrato separado confiável para cada modo**. Nunca fazer `video.frames` enviando um ID remoto no lugar de um arquivo local, nem descartar referências do personagem para conseguir chamar `video.text`.

## 1. Instale e autentique o upstream no seu Windows

Siga o [README e INSTALL do upstream](https://github.com/miyakejima/google-flow-mcp/blob/main/INSTALL.md). Instale Node.js 20+; clone o projeto em um diretório estável, execute os comandos indicados pelo upstream e construa `dist/index.js`. Faça a conexão manual da conta existente em Chrome/Chromium seguindo o Flow Login Bridge do upstream. **Não passe cookies, credenciais ou códigos 2FA ao nosso MCP.**

Na primeira conexão, o upstream pode pedir ação manual na extensão e seleção da identidade Google. Até que `flow_list_accounts` identifique o perfil como conectado e `flow_inspect_account` alcance um workspace, a integração deve ficar bloqueada. Não automatizar CAPTCHA nem resolver barreiras de segurança com outras contas.

## 2. Configure os arquivos locais

Crie um `STUDIO_HOME` persistente que não esteja dentro de arquivos versionados, ou use `.studio/` (ignorado por Git). Exemplo Windows PowerShell:

```powershell
$env:STUDIO_HOME = "$PWD/.studio"
New-Item -Force -ItemType Directory $env:STUDIO_HOME | Out-Null
```

No arquivo `.studio/upstreams.json`, configure o **MCP já instalado**, não um navegador genérico:

```json
{
  "flow-runtime": {
    "command": "node",
    "args": ["C:/Users/SEU_USUARIO/dev/google-flow-mcp/dist/index.js"],
    "env": {}
  }
}
```

Copie `examples/flow-profiles.example.json` para `.studio/flow-profiles.json` e atualize o nome do perfil conectado e do projeto Flow:

```json
{
  "flow-01": {
    "upstreamAccountId": "personal",
    "flowProject": "A Oficina — EP01"
  }
}
```

O `flow-01` é a identidade **lógica local**. `personal` é o perfil **no upstream MCP**. `flowProject` é o **nome do projeto Flow de destino**, não um ID inventado. Uma única conta lógica referencia exatamente um perfil, sem seleção automática de outra identidade. Cada sessão possui orçamento independente. O nome precisa coincidir com o `remoteProjectId` registrado no binding; nessa versão, o binding é **conferência do operador por nome**, não prova da identidade nativa do projeto do Google.

## 3. Prepare uma produção canônica e um workflow

Comece normalmente pela Skill `visual-production-director`: `studio_story_start`, elenco, storyboard, aprovação editorial e `studio_story_prepare`. Registre no núcleo um `studio_register_account` com `{id:"flow-01",provider:"google-flow",upstreamId:"flow-runtime",authorized:true,creditEstimate:...}`. Vincule a produção e a conta com `studio_bind_project` usando como `remoteProjectId` exatamente o nome configurado no arquivo de perfis.

**Importante:** o storyboard padrão compila `asset.upload`, imagens com referências e `video.frames`. Esses passos continuarão bloqueados no upstream atual até que suas integrações específicas sejam homologadas. Para o piloto, crie um workflow próprio contendo apenas `image.generate` simples ou `video.text` simples, mantendo o roteiro original como fonte canônica. Jamais modifique um workflow aprovado in-place; use um novo ID.

O workflow declara, por exemplo, um passo:

```json
{
  "id": "pilot-image",
  "operation": "image.generate",
  "accountId": "flow-01",
  "estimatedCredits": 1,
  "dependsOn": [],
  "inputs": {
    "prompt": "Retrato em plano médio de personagem...",
    "aspectRatio": "9:16"
  }
}
```

A quantidade de créditos acima é **estimativa informada pelo operador, não cotação real**. O provedor pode cobrar mais, ou disponibilizar gratuitamente uma opção; confirme na interface antes de aprovar. Se o Flow apresentar preço divergente, cancele e atualize o planejamento aprovado.

## 4. Inspecione sem gastar créditos

```bash
npm run operator -- flow-live-account flow-01
npm run operator -- workflow-plan <workflowId>
npm run operator -- flow-live-step <workflowId> <stepId>
```

Ou pelo agente: `studio_flow_live_account`, `studio_flow_live_step`. O bridge rejeita automaticamente: perfil desconectado, landing page, modelo ou proporção indisponível, ausência de schema da ferramenta, projeto local com nome divergente, duração não exibida e referências que não consegue transportar.

## 5. Aprovação humana e execução única

Depois da revisão do roteiro e do valor exibido pelo Flow, o operador aprova explicitamente aquele passo:

```bash
npm run operator -- workflow-approve <workflowId> <stepId>
```

O agente somente então pode chamar `studio_flow_submit_step`. O método revalida a sessão em duas fases, reivindica o passo persistindo `submitting` e faz **uma** chamada de `flow_generate_image` ou `flow_generate_video` com `confirmCreditSpend:true`. Depois registra o UUID específico do job no estado `submitted`. **Uma resposta ambígua vira `submission_unknown`; não reenviar**.

Não se deve usar `studio_workflow_execute_step` genérico como substituto da validação específica desse bridge para a mesma operação.

## 6. Consultar, baixar e verificar

```bash
npm run operator -- flow-live-reconcile <workflowId> <stepId>
npm run operator -- flow-live-download <workflowId> <stepId>
npm run operator -- flow-live-reconcile <workflowId> <stepId>
```

O agente tem as ferramentas equivalentes `studio_flow_reconcile_step` e `studio_flow_download_step`. Nenhuma delas submete nova geração. O arquivo deve estar no diretório atribuído ao passo e pertencer ao mesmo UUID/perfil. O sistema verifica o conteúdo (assinatura de imagem ou FFprobe para vídeo), hash e arquiva uma cópia por conteúdo em `.studio/outputs/flow/`.

`completed` significa **arquivo técnico disponível e verificado**, não aprovação da qualidade da imagem, consistência dos personagens nem entrega do episódio. Para usar a imagem como referência aprovada, execute a revisão visual via biblioteca (`studio_visual_propose` e `visual-approve`). Para vídeo, ainda é necessária a edição e QA final de F4.

## 7. Pendências para fechar o gate F3

1. Homologar `project.ensure` ou equivalente sem confundir nome de projeto com identificador nativo.
2. Validar e implementar `asset.upload` e referência incremental por hash, no projeto da conta correta.
3. Reutilizar o still aprovado como start frame real (`video.frames`) sem perder texto, referência ou modo de geração.
4. Cotação de créditos no Flow e comparação com a autorização antes da chamada paga.
5. Testar uma imagem e um vídeo reais, na sua própria conta autorizada, com custo, job, arquivo e hash documentados.
6. Garantir persistência do upstream, recuperação após reinício e diagnósticos de UI alterada. O bridge atual cria conexões stdio conforme a implementação existente e ainda não possui worker durável de navegador.

Testes automatizados cobrem comportamento com **upstream MCP simulado**. Isso é evidência de contrato, não demonstra uma geração real no Flow.

### Referências

- [miyakejima/google-flow-mcp](https://github.com/miyakejima/google-flow-mcp) — ferramentas `flow_list_accounts`, `flow_inspect_account`, `flow_generate_image`, `flow_generate_video`, `flow_job_status`, `flow_download_job`.
- [Google Flow — Criar vídeos](https://support.google.com/flow/answer/16353334)
- [Google Flow — Modelos e recursos](https://support.google.com/flow/answer/16352836)
