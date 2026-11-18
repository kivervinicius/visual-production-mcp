# Matriz de aceite e testes de ponta a ponta

Este documento define evidências para declarar o produto finalizado. Testes simulados verificam domínio; somente geração autenticada comprova integração real. **Não usar mocks como prova de vídeo gerado no Google Flow.**

## Critérios por fase

| ID | Critério observável | Tipo de teste | Evidência exigida | Release |
|---|---|---|---|---|
| A01 | Fonte integral imutável e SHA conferido após pausa/retomada | Unit + integração | fixture de história + revisão | 0.5 |
| A02 | Agente lê fonte inteira e lista personagens/locações sem inventar trechos | Contrato Skill + humano | quotes rastreáveis e lista de hipóteses | 0.5 |
| A03 | Próxima etapa consistente após restart/troca de cliente MCP | Integração | cursor/estado em novo processo | 0.5 |
| A04 | Aprovação editorial não pode ser forjada por ferramenta autônoma | Segurança | tentativa rejeitada + log | 0.5 |
| A05 | Personagem reaproveitado em duas cenas na mesma versão | Unit + snapshot | biblioteca, referência hash e IDs de shots | 0.6 |
| A06 | Alteração de referência exige nova versão e invalida dependências | Unit + integração | diff e plano de regeneração | 0.6 |
| A07 | Sessão Flow, projeto, modelos, formatos e quote detectados ao vivo | Live read-only | capability snapshot datado e anonimizado | 0.7 |
| A08 | Uma imagem real recebida e correlacionada à operação original | Live | ID da operação + hash e arquivo original | 0.7 |
| A09 | Um vídeo frame-to-video real é obtido com custo previamente aprovado | Live | recibo + vídeo original + ffprobe | 0.7 |
| A10 | Submissão incerta nunca provoca gasto duplicado automático | Fault injection | estado bloqueado e reconciliação | 0.7 |
| A11 | Download interrompido é retomado sem nova geração paga | Integração | mídia final com mesmo operation ID | 0.8 |
| A12 | Revisão rejeita apenas um plano e mantém os demais | Integração + UX | histórico de variantes e aprovações | 0.8 |
| A13 | Áudio/legendas/timeline geram MP4 offline determinístico | E2E simulado | final.mp4, SRT, QC e hashes | 0.8 |
| A14 | Episódio completo real a partir de uma história | E2E live | MP4, relatório e orçamento executado | 1.0 |
| A15 | Instalação limpa e uso no Codex e Antigravity | Smoke + manual | configuração reproduzível, logs e guia | 1.0 |
| A16 | Reutilização entre contas sem transportar IDs nativos | E2E live condicionado às regras | bindings por conta e originais validados | 1.1 |
| A17 | Higgsfield para um caso equivalente com capability explícita | E2E live | mídia e feature-matrix | 1.1+ |

## Suite de CI mínima

`npm ci` (com lockfile versionado), `npm run check`, `npm run docs:check`, `npm test`, `npm run test:mcp`; adicionar coverage de contratos e auditoria de dependências sem marcar a build falha por indisponibilidade temporária de provedor externo. SDK smoke: o processo MCP inicia, `listTools` responde, história pode ser criada/consultada e stdout continua limpo.

E2E offline deve usar provedores fake determinísticos que devolvem assets físicos de teste, e não só strings de job ID. Teste deve abrir MP4 resultante com FFprobe e comparar outputs e manifestos, sem depender de navegador ou créditos.

E2E online de Flow deve ser separado do CI convencional: executado explicitamente pelo operador com conta autorizada, orçamento limitado, modelo selecionado e evidências sem cookies, tokens ou dados sensíveis. Falhas de acesso à conta não podem ser interpretadas como sucesso.

## Dossiê de entrega

Para o mesmo `productionId` exigir:

- `source.md` + hash e revisão; `CHARACTER_BIBLE.md`, `STORYBOARD.md` e decisões editoriais.
- `production.json`, `workflow.json`, bindings por conta e versões de referências.
- Originais recebidos (`assets/sha256`) e recibos de operações com timestamps.
- `EDIT_MANIFEST.json`, `subtitles.srt` (ou justificativa documentada para ausência), áudio e `final.mp4`.
- `QC_REPORT.json` com codec, dimensões, FPS, duração, áudio, integridade e erros conhecidos.
- `PRODUCTION_REPORT.md` com custo estimado vs observado, exceções, versões e permissões de uso.

## Testes manuais de usabilidade

1. Pessoa sem conhecimento de MCP entrega só a história: agente explica próximo passo e não solicita JSON.
2. A pessoa rejeita apenas o design de um personagem: outros personagens e o roteiro permanecem.
3. A pessoa sai, abre em outra sessão e pede "continue": agente retoma com mesma versão e próximo gate, sem repetir respostas.
4. Conta desautenticada, quote alterada ou CAPTCHA: agente bloqueia e explica como retomar sem contornar segurança.
5. Conta com provedor sem frames ou ingredientes: operador recebe `UNSUPPORTED`, nunca vídeo com outra metodologia silenciosa.
6. Revisão rejeita um clipe: preserva outros já aprovados, idempotência e auditoria.
7. Download falha após geração: recupera o mesmo asset, sem gastar novamente.
8. Operador solicita pacote portável: nenhuma credencial, token ou ID remoto é apresentado como recurso reutilizável independente.

## Política de release

- **alpha:** planejamento local e mocks, sem promessa de render completo.
- **beta:** integração real de uma conta, custos e arquivos comprovados, com operação assistida.
- **v1.0:** episódio real entregue e fluxo guiado recuperável, com documentação de uso, falha, suporte e segurança.

Referenciar cada critério nas issues/PRs; um item não verificado fica `PENDING` ou `BLOCKED`, jamais `DONE` apenas porque o documento existe.
