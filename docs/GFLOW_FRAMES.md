# Frames e ingredientes no Google Flow — contrato de pré-verificação

**Estado: planejamento e pré-verificação implementados; geração paga ainda NÃO homologada.**

O adaptador `miyakejima` continua suportando somente `image.generate` sem referências e `video.text` sem frames. Ele aceita `referenceFiles`, mas sua implementação não diferencia de forma comprovável `Frames to Video` de `Ingredients to Video`: usar esse parâmetro para um `video.frames` perderia o contrato criativo.

A nova ferramenta `studio_gflow_frame_plan` e o comando `flow-frame-plan` usam o contrato distinto do [gflow-cli](https://github.com/ffroliva/gflow-cli), que declara explicitamente `gflow_generate_video(mode="i2v", initial_frame=...)` e `mode="r2v", reference_images=[...]`. Nenhum desses comandos dispara uma geração. Essa separação é **intencional** até serem comprovados: modo selecionado de fato, ID nativo do projeto, preço real, recibo durável e arquivo final no ambiente do operador.

## Configuração por operador

Instale `gflow-cli` separadamente, faça login no seu navegador de acordo com a documentação dele e configure o upstream MCP `gflow mcp run` em `.studio/upstreams.json` (arquivo privado, não versionado). Exemplo do conteúdo por operador:

```json
{
  "gflow-operator": {
    "command": "gflow",
    "args": ["mcp", "run"]
  }
}
```

Registre no Visual Production MCP uma conta autorizada com `upstreamId: "gflow-operator"` e associe `remoteProjectId` ao **ID nativo do projeto**. O título do projeto não é suficiente. A conta que usa `miyakejima` e nome do projeto pode continuar existindo separadamente.

Crie `.studio/gflow-cli-profiles.json`:

```json
{
  "flow-personal": {
    "profile": "personal",
    "projectId": "234e4567-e89b-42d3-a456-426614174000",
    "model": "veo_fast"
  }
}
```

`profile` é o nome local do perfil de browser do gflow-cli; `projectId` é um **exemplo**, substitua pelo identificador real. Valores permitidos no mapeamento de modelo: `veo_lite`, `veo_fast`, `veo_quality`, `omni_flash`, `omni_1_2_flash`. A versão do modelo e a duração são revalidadas conforme o contrato publicado, mas o servidor remoto pode ter controles diferentes por conta. Nenhum valor de crédito ou disponibilidade ao vivo é inferido dessa configuração.

## Pré-verificação

```bash
npm run operator -- flow-frame-plan <workflowId> <videoStepId>

# Realiza adicionalmente consulta somente leitura a gflow_auth_status e ao schema da ferramenta
npm run operator -- flow-frame-plan <workflowId> <videoStepId> --live
```

Alternativamente, a Skill/cliente MCP usa `studio_gflow_frame_plan` com `probeUpstream: true` para conferir a identidade e o esquema. O preflight não marca `approved`, `submitted` nem `completed` e nunca chama `gflow_generate_video`.

### Vinculação das referências

- `video.frames.inputs.startFrame` e `endFrame` (opcional) podem indicar `step:<id>` para imagem **concluída**, com recibo, bytes e SHA-256 presentes em `.studio/outputs/flow/<jobId>/<sha>.png|jpg|webp`; o passo produtor deve ser uma imagem da mesma conta e uma dependência explícita.
- `video.frames` **não** aceita `referenceImages` simultaneamente: não há conversão automática para um modo misto.
- `video.ingredients.inputs.ingredients` usa de 1 a 3 referências verificadas, mapeadas para `mode="r2v"` e `reference_images`; nunca converte para `mode="i2v"`.
- `asset:<id>` também é permitido quando o manifesto canônico já importou a imagem em `.studio/assets/<sha>.<ext>` com hash compatível. Esses arquivos são enviados a partir de seus bytes locais, sem reutilizar IDs remotos de outra conta.
- Arquivos ausentes, fora do workspace, com symlink, SHA incorreto, nomes não canônicos ou origem sem recibo bloqueiam a preparação **antes de qualquer conexão com o provedor**.

O retorno declara `liveSchemaVerified`, `liveAuthenticationVerified`, `nativeProjectVerified:false`, `liveCreditQuoteVerified:false` e `paidExecutionImplemented:false`. A ausência de cotação e a falta de homologação da geração não são substituídas por estimativas.

## O que falta antes da primeira geração com frames

1. Validar em uma conta autorizada que o gflow-cli da versão instalada realmente expõe os parâmetros `initial_frame` / `reference_images` e preserva o modo de execução.
2. Confirmar projeto nativo e orçamento na interface do Google Flow, não apenas no JSON local.
3. Criar um mecanismo de submissão paga **somente após aprovação do operador**, que persiste um recibo idempotente. O serviço gflow-cli usa caminhos distintos para `wait=true` e tasks; uma desconexão depois de submeter exige reconciliação, nunca retry automático.
4. Baixar a mídia original, verificar o hash e a duração e então associar o resultado aprovado ao Media Composer.

**Não tente contornar bloqueios de conta, CAPTCHA, políticas do provedor ou limites de créditos.**
