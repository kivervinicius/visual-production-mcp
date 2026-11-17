# Jornada guiada — de uma história até o vídeo final

## Princípio central

Uma pessoa não precisa escrever JSON nem escolher ferramentas MCP. Ela entrega uma história; o agente explica o plano, faz perguntas só quando falta um dado essencial, prepara artefatos, atualiza o progresso e apresenta decisões aprováveis. O backend mantém as fases e as evidências; trocar de agente não reinicia a produção.

## Fluxo pretendido (não está todo implementado na v0.4)

| Fase | Ação automática do agente | O que mostrar ao usuário | Gate para avançar |
|---|---|---|---|
| 1. História | Importar fonte, SHA, idioma e duração aproximada | Sinopse fiel, personagens/cenários detectados, ambiguidades | Confirmar interpretação se houver conflito material |
| 2. Direção | Propor formato, estilo e referências apropriadas | 2–3 direções visuais fundamentadas; premissas explicitadas | Escolha do estilo somente se não houver padrão aprovado |
| 3. Bíblia visual | Descrever personagens, locais, objetos e regras de continuidade | Fichas e versões para referência | Aprovar visual/bíblia antes de gerar mídia em lote |
| 4. Storyboard | Decompor cenas e planos, quotes e duração prevista | Plano ordenado, duração total, cobertura do texto, lacunas | Aprovação editorial; congelar revisão |
| 5. Referências | Criar/recuperar sprites, character sheets, ambientes | Prévia e custo quando aplicável | Aprovar a referência reutilizável |
| 6. Imagens | Gerar keyframes/stills com personagens aprovados | Galeria de imagens por shot e variações | Aceitar/rejeitar por shot |
| 7. Vídeos | Selecionar modo real suportado e gerar clipes com frames | Creditos/quote, status, previews e avisos de falhas | Autorização de gasto; resultado verificável |
| 8. Revisão | Comparar resultado com roteiro e consistência | Variações, artefatos ausentes, plano de correção | Aprovação de takes ou rerender seletivo |
| 9. Pós-produção | Áudio, legendas, timeline e FFmpeg | Preview do episódio, trilhas, direitos e duração | Aprovação editorial da versão de entrega |
| 10. Entrega | Validar codecs, dimensões, legendas e hashes | MP4, projeto portátil e relatório de execução | `DELIVERED` só com evidências presentes |

Na v0.4, as fases 1–4 são **planejamento assistido** e geram manifests; as demais não estão automatizadas ponta a ponta.

## Contrato de UX para próxima ação

**Proposta v0.5** (`production_get_status` e `production_get_next_action`, nomes a aprovar no código):

```json
{
  "schemaVersion": "1.0",
  "productionId": "episodio-01",
  "stage": "REFERENCES",
  "state": "AWAITING_APPROVAL",
  "completedArtifacts": ["source:sha256", "storyboard:v1", "character-bible:v1"],
  "nextAction": {
    "type": "REVIEW_CHARACTER_REFERENCES",
    "targetIds": ["character-lia@v1"],
    "reason": "A referência será reutilizada em três planos",
    "suggestedChoices": ["approve", "request_changes"]
  },
  "progress": { "completedStages": 4, "totalStages": 10 },
  "blockers": [],
  "estimatedCredits": { "value": null, "verified": false },
  "eventsCursor": 42
}
```

Esse JSON é **design de contrato**, não retorno atual da ferramenta. Não declarar valores inventados como orçamento live. Progresso exibido como `4/10 fases validadas` em vez de 40% de render real; para jobs usar estados e timestamps observados.

## Estados e ações humanas

- `PENDING`: artefatos prévios faltam; exibir dependências.
- `IN_PROGRESS`: processamento comprovadamente iniciado e identificável.
- `AWAITING_APPROVAL`: plano ou mídia disponíveis; apresentar prévia e botões/alternativas explícitas.
- `BLOCKED`: sessão/provider/referência/custo não confirmados; oferecer uma ação de resolução.
- `SUBMISSION_UNKNOWN`: operação talvez cobrada; não repetir. Reconciliar com histórico do provedor.
- `FAILED`: erro confirmado; registrar causa e opção segura de correção.
- `COMPLETED`: etapa com todos os critérios de aceite e evidências.

Para reduzir fricção, agrupar decisões editoriais: aprovação da bíblia visual e do storyboard em gates previsíveis; evitar confirmação a cada clique. Contudo, despesas exigem escopo de autorização claro (operações, conta, valor teto, período e revogação).

## Avisos e retomada

O núcleo deve persistir eventos ordenados (`stage_entered`, `asset_ready`, `review_requested`, `credit_quote_changed`, `job_submitted`, `provider_blocked`, `delivery_ready`) e gerar `pendingActions` idempotentes para o agente apresentar. A consulta MCP deve devolver a atualização desde um cursor, para evitar mensagens repetidas.

O MCP **não consegue iniciar sozinho uma conversa num cliente desligado**. Notificações fora da sessão precisarão de integração opt-in com um canal autorizado (webhook/e-mail/app), worker ativo, política de retries e tratamento de dados sensíveis. Inicialmente, avisos aparecem ao usuário quando o agente consulta ou recebe progresso da sessão atual.

## Exemplo de conversa desejada

> **Usuário:** Quero transformar esta história em vídeo vertical.  
> **Agente:** Registrei a fonte e identifiquei três personagens e quatro cenas. O texto não define o figurino; proponho um padrão visual e marco essas decisões como hipóteses. Posso apresentar as fichas para revisão?  
> **Usuário:** Pode manter o estilo preto e branco.  
> **Agente:** Direção registrada. Organizei seis planos, com referências da história e tempo previsto. Confira o storyboard; após aprovação preparo as imagens.  
> **Usuário:** Aprovo.  
> **Agente:** Referências aprovadas; antes de gerar vídeos, o Flow indicou o custo estimado para esta conta. O máximo autorizado é X. Deseja liberar essa etapa?  
> **Usuário:** Sim.  
> **Agente:** A geração foi submetida sob operação Y. Ao consultar a produção, mostrarei status, resultados e eventuais revisões necessárias.

Os valores X/Y ilustram as mensagens; **não** representar operações simuladas como reais. Ao pedir "continue", o agente consulta o MCP antes de propor novas ações.
