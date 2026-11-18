# StageEngine (v0.5) — 10 fases, eventos, decisões e retomada

**Status:** implementado para o acompanhamento local. **Não** comprova geração autenticada no Google Flow, download, revisão de mídia ou MP4 final. Referências: [jornada](PRODUCT_JOURNEY.md), [aceite](ACCEPTANCE_MATRIX.md), [Epic #10](https://github.com/kivervinicius/visual-production-mcp/issues/10) e [issue #11](https://github.com/kivervinicius/visual-production-mcp/issues/11).

## Da história à entrega

As dez fases são `STORY`, `DIRECTING`, `BIBLE`, `STORYBOARD`, `REFERENCES`, `SHOT_IMAGES`, `VIDEOS`, `REVIEW`, `AUDIO_EDIT` e `DELIVERY`. A etapa ativa é determinada pelo **próximo bloqueio ou trabalho concreto**, não por um percentual artificial de renderização. Consulte `production_get_status` ou `production_get_next_action` sempre que retomar a conversa.

| Estado | Significado | Pode ser dito ao usuário? |
|---|---|---|
| `PENDING` | Sem material/verificação suficiente | Ainda não iniciado ou não comprovado |
| `IN_PROGRESS` | Preparação local ou operação remota registrada e em andamento | Em preparação / em processamento quando houver prova |
| `DRAFT_READY` | Proposta editorial enviada mas não aprovada | Rascunho aguardando revisão conjunta |
| `AWAITING_APPROVAL` | Elenco e storyboard prontos para decisão humana | Revisão necessária |
| `BLOCKED` | Decisão rejeitada ou submissão remota incerta | Não reexecutar até resolver |
| `AWAITING_VERIFICATION` | Provider marcou como concluído, **mídia ainda sem recibo local** | Nunca afirmar mídia validada |
| `NOT_APPLICABLE` | Nenhuma operação daquela categoria no workflow | Dispensado por desenho |
| `COMPLETED` | Origem SHA verificada ou material editorial aprovado | Só quando o gate atual possuir evidência |

Somente as fases `STORY`, `DIRECTING`, `BIBLE` e `STORYBOARD` podem atingir `COMPLETED` nesta versão. Os estados de mídia e delivery permanecerão conservadores até a implementação de ingestão e QC de workflow (F3–F5). Um `WorkflowStudio` com outputs de mídia informados pelo provedor **não** se converte em `COMPLETED` sem validação física e revisão editorial.

## Ferramentas MCP de consulta

- `production_get_status({"storyId":"oficina-ep01"})`: fases, estado, evidência, `nextAction`, `pendingActions`, progresso em **quantidade de fases**, bloqueios e `eventsCursor`.
- `production_get_next_action({"storyId":"oficina-ep01"})`: uma ação por vez, com `type`, `stage`, `tool`, `requiresHuman` e chave idempotente `key`.
- `production_events({"storyId":"oficina-ep01","cursor":0,"limit":25})`: eventos ordenados desde o cursor informado, `nextCursor`, `hasMore`. Se `hasMore=true`, continue a leitura; o intervalo de retenção é de 1.000 eventos por história. Se o cursor estiver expirado, recupere o status e reinicie a consulta usando o cursor atual.

Exemplo resumido após o storyboard (dados ilustrativos; `reviewVersion` deve vir da consulta real):

```json
{
  "storyId": "oficina-ep01",
  "stage": "STORYBOARD",
  "nextAction": {
    "type": "APPROVE_EDITORIAL",
    "requiresHuman": true,
    "command": "npm run operator -- production-decision oficina-ep01 approve <reviewVersion>"
  },
  "progress": {"completedStages": 1, "totalStages": 10},
  "estimatedCredits": {"value": null, "verified": false}
}
```

O número `completedStages` **não** inclui os rascunhos sem aprovação. A ferramenta `studio_story_status` da v0.4 continua disponível para compatibilidade. O StageEngine é a interface recomendada para progresso global.

## Comandos exclusivos do operador

```bash
npm run operator -- production-status oficina-ep01
npm run operator -- production-next oficina-ep01
npm run operator -- production-events oficina-ep01 0
# Copie o reviewVersion SHA-256 real retornado por production-status:
npm run operator -- production-decision oficina-ep01 approve <reviewVersion> "Storyboard revisado"
# OU solicite correções sem aprovar:
npm run operator -- production-decision oficina-ep01 request_changes <reviewVersion> "Alterar plano 2"
```

O `reviewVersion` protege contra uma aprovação obsoleta; se elenco ou storyboard mudar, a operação falha com `STALE_REVIEW`. Depois de `request_changes`, o mesmo conteúdo permanece bloqueado até nova revisão do storyboard. Caso o **elenco** precise mudar após o envio de storyboard, use um novo ID de revisão da história, já que a v0.4 congela o elenco após essa etapa. O comando legado `story-approve` continua disponível, mas também respeita rejeições por versão.

**Nenhum desses comandos é ferramenta MCP de aprovação.** A decisão é registrada como `actor: local-operator`. Isso é uma separação operacional, não uma autenticação criptográfica: o sistema local não comprova identidade de um humano e não impede um agente que tenha acesso irrestrito ao shell de invocar o CLI. Para aprovações fortes em ambientes compartilhados, implementar autorização/assinatura fora desta interface (escopo futuro).

## Eventos, reconciliação e segurança

Cada consulta `production_get_status` compara as evidências persistidas e publica somente mudanças de estado/ação. Eventos são gravados atomicamente em `.studio/state.json` com sequência crescente por história. Consultas repetidas sem mudança não criam novos eventos; o cliente salva `eventsCursor` e só apresenta novos avisos. `production_events` é **pull**, não notificação automática fora da conversa.

A fonte original é relida e seu SHA-256 é revalidado em cada reconciliação. A sequência mantém compatibilidade com histórias já existentes, criando o guia quando consultado pela primeira vez; não há migração destrutiva de `state.json`.

Não confundir `status: submitted` do provider com arquivo importado. Se surgir `submission_unknown`, a próxima ação obrigatória é `RECONCILE_SUBMISSION`, sem gastos adicionais ou mudança silenciosa de conta. Custos continuam manualmente estimados: sem conexão real, a interface responde `verified: false`.

## Limites e próximos marcos

- F2: aprovação **por versão de referência/personagem** e revisão seletiva de imagens.
- F3: preflight real de sessão, projeto, modelo e custo, ingestão/recuperação de mídia com IDs inequívocos.
- F4: timeline, FFmpeg, narração, legendas, QC, pacote final e etapa `DELIVERY` verificada.
- F5: prova de episódio completo real e testes em Codex/Antigravity.

A Skill do agente deve consultar o StageEngine ao início de toda sessão, explicar a etapa e o bloqueio em texto humano, e executar ações locais **não pagas** sem pedir permissão para cada operação. Gasto, aprovação criativa e reconciliação incerta permanecem sujeitos à decisão explícita do operador.
