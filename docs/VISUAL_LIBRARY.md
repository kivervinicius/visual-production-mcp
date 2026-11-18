# Biblioteca visual versionada — F2 / v0.6.0

**Estado:** implementada localmente, com aprovação do operador; **não** gera imagens ou vídeos no Google Flow, não valida semelhança facial/estética automaticamente e não transfere projetos entre contas. A execução real do Flow pertence às issues [#1](https://github.com/kivervinicius/visual-production-mcp/issues/1) e [#7](https://github.com/kivervinicius/visual-production-mcp/issues/7).

## Por que existe

Uma pessoa pode começar apenas com uma história, e o agente sugerirá personagens, ambientes e estilo. Antes de gastar créditos gerando cenas, imagens de referência precisam poder ser aprovadas e reutilizadas entre planos e histórias. IDs do provedor são **dependentes da conta**; referências canônicas são **arquivos locais identificados pelo SHA-256**. Aprovar um personagem globalmente não cria automaticamente esse personagem no projeto Google Flow.

Há três recursos distintos:

1. **Identidade visual (global):** `libraryId` único (`shared/lia`, `shared/oficina`, `shared/style`), `kind` (`character`, `location`, `style`, `prop`), versões inteiras imutáveis, descrição, atributos, origem e referências. `status` = `proposed`, `approved` ou `rejected`.
2. **Imagem candidata de tomada (por projeto e shot):** `projectId`, `shotId`, `variant`, SHA-256, status e seleção aprovada. Uma variante rejeitada nunca é substituída no mesmo ID; proponha `v02`, `v03` etc.
3. **Vínculo do provedor:** projeto Flow remoto de cada conta, asset ID remoto e hash local, associados pelo `studio_bind_project` ou por conclusão de `asset.upload` conferida pelo operador. O upload **não** prova que créditos ou contas foram compartilhados.

## Jornada: personagem já aprovado em outro episódio

### 1. O agente propõe uma referência

Para criar uma identidade nova, primeiro obtenha uma imagem local real (ou uma imagem gerada e baixada do provedor autorizado). Com o MCP configurado, envie:

```json
{
  "libraryId": "shared/lia",
  "kind": "character",
  "name": "Lia",
  "description": "Lia com casaco preto, cabelo curto e silhueta consistente",
  "referencePaths": ["/caminho/references/lia.png"],
  "attributes": {"style": "2D", "outfit": "casaco preto"},
  "originNotes": "Imagem avaliada visualmente pelo operador; registrar origem e permissões quando aplicável"
}
```

Ferramenta: `studio_visual_propose`. Ela copia o arquivo para `.studio/assets/<SHA>.png` e retorna `libraryId`, `version` e `fingerprint`. A proposta **não** equivale a aprovação. PNG, JPEG e WebP têm assinatura conferida, tamanho máximo 25 MiB e symlinks são rejeitados. A assinatura binária não faz decodificação profunda nem análise editorial.

### 2. O operador aprova ou rejeita

Aprovação não é ferramenta MCP acessível autonomamente: o operador consulta a imagem, seus direitos/origem e a descrição, depois executa:

```bash
npm run operator -- visual-list
npm run operator -- visual-status shared/lia 1
npm run operator -- visual-approve shared/lia 1 <fingerprint-recebido>
# ou, para rejeição justificada:
npm run operator -- visual-reject shared/lia 1 <fingerprint-recebido> "Silhueta inconsistente"
```

O fingerprint protege contra revisão obsoleta. Revisões imutáveis não podem ser aprovadas/rejeitadas duas vezes. Personagens, ambientes e objetos exigem **ao menos uma referência de imagem** antes da aprovação; `style` pode ser aprovado somente com descrição.

> Segurança: `local-operator` identifica o caminho operacional, **não autentica uma pessoa**. Um agente com execução irrestrita do shell pode invocar o CLI. Implantação compartilhada precisará de autorização forte.

### 3. Outra história reaproveita o mesmo personagem

No envio de elenco para `studio_story_submit_cast`, use o identificador global e fixe a versão desejada:

```json
{
  "id": "lia",
  "name": "Lia",
  "sourceExcerpt": "Lia voltou à oficina.",
  "designPrompt": "Lia com casaco preto, cabelo curto e silhueta consistente",
  "libraryId": "shared/lia",
  "libraryVersion": 1
}
```

`sourceExcerpt` deve ser citação **literal** do roteiro recebido. `designPrompt` deve coincidir exatamente com a descrição aprovada da versão pinada; se divergir, `studio_story_prepare` falha em vez de alterar a aparência de maneira silenciosa. O mesmo contrato `libraryId`/`libraryVersion` existe para `locations`. Uma história também pode declarar `styleLibraryId`; esse vínculo atualmente permite análise de impacto e rastreabilidade, não injeta imagens de estilo na geração.

No preparo da produção, uma referência aprovada é incluída no pacote de mídia com SHA-256 e gera uma etapa `asset.upload` **em vez de gerar uma nova imagem de personagem/local**. A tomada usa `referenceImages: ["asset:<id>"]` e aguarda dependências de upload da mesma conta. Um novo projeto Google continua precisando do upload da referência, com ID remoto próprio. O compilador rejeita mais de cinco referências numa tomada, não as descarta silenciosamente; o limite real deve ser verificado no Flow.

### 4. O agente verifica e organiza

| Tool | Ação | Gasta créditos? |
|---|---|---|
| `studio_visual_list` | Lista identidades e versões aprovadas | Não |
| `studio_visual_get` | Obtém descrição, hashes e revisão | Não |
| `studio_visual_verify` | Recalcula hashes locais das referências | Não |
| `studio_visual_impact` | Mostra histórias e tomadas afetadas por uma nova versão | Não |
| `studio_visual_project_readiness` | Reporta versões aprovadas/pinadas em um projeto canônico | Não |
| `production_get_status` | Inclui `visualContinuity` com peças prontas/faltantes | Não |
| `production_events` | Exibe eventos de proposta, aprovação e imagens por plano desde um cursor | Não |

As referências existentes **nunca são substituídas em lote**; cada nova versão pode afetar determinados planos, identificados por `studio_visual_impact`. O resultado é informativo: não inicia regeneração de mídias que já consumiram créditos.

### 5. Revisão seletiva de imagens de cena

Depois de uma geração real e download do still de um shot do `production.json`, o agente registra a imagem candidata:

```json
{
  "projectId": "episodio-production",
  "shotId": "shot01",
  "variant": "v01",
  "filePath": "/caminho/outputs/frame-shot01.png",
  "note": "Primeira composição; verificar figurino e enquadramento"
}
```

Tool: `studio_visual_shot_submit`; em seguida, consulte `studio_visual_shot_list` para obter o SHA-256 e os candidatos. Aprovação ou rejeição somente no CLI do operador:

```bash
npm run operator -- visual-shot-review episodio-production shot01 v01 <sha256> approve
npm run operator -- visual-shot-review episodio-production shot01 v02 <sha256> reject "Enquadramento incorreto"
```

O estado preserva todas as variantes e registra `selectedVariant`, sem apagar original nem criar automaticamente outro vídeo. As decisões aparecem como eventos em `production_events` quando uma história está vinculada ao projeto. A verificação de continuação visual entre frames permanece editorial/humana; não é uma função de análise de imagem embarcada.

## Organização de dados e segurança

- Estado e decisões: `.studio/state.json` (migração **aditiva** e compatível com v0.5).
- Arquivos: `.studio/assets/<sha256>.<ext>` com cópia local, sem upload para servidor nosso.
- Propostas imutáveis: `state.visualLibrary.entities[libraryId].versions[version]`.
- Candidatos de shot: `state.visualLibrary.shotVariants[projectId::shotId]`.
- Proveniência: `originNotes`, hashes locais e notas do operador. **Não** atribuímos direitos autorais nem garantimos fidelidade facial automaticamente.
- Vínculos Flow: `state.bindings[projectId::accountId]` em namespaces diferentes para contas diferentes.
- Nunca salvar cookies, senhas ou tokens; `.studio` continua ignorado pelo Git.
- Trate `.studio/state.lock` retido após crash como incidente operacional; não remova enquanto outro processo estiver escrevendo.

## Critérios de aceite F2

- [x] Biblioteca com versões imutáveis e histórico de decisões; impossível modificar v1 depois de aprovada.
- [x] Conteúdo por SHA-256, rejeição de symlinks e corrupção detectável.
- [x] Personagens e locais podem ser reutilizados entre histórias com `libraryId` e `libraryVersion`.
- [x] Pacote compilado usa upload de referência aprovada em vez de regenerar a ficha.
- [x] Impacto por projeto e shot, sem migração silenciosa nem reenvio pago.
- [x] Revisão por shot com variantes imutáveis e seleção humana.
- [x] Eventos consultáveis e observação de progresso via StageEngine.
- [ ] Prova de upload/download real e preservação dos IDs remotos em Flow autenticado ([#1](https://github.com/kivervinicius/visual-production-mcp/issues/1)).
- [ ] Comparação visual automatizada e geração de novos frames no provedor, fora do escopo local de F2.

## Testes

```bash
npm run check
npm test
npm run test:mcp
npm run docs:check
```

Testes unitários de biblioteca, reutilização, arquivos corrompidos, revisão por shot, eventos e associação por conta estão em `tests/visual-library.test.mjs`; o handshake MCP real é executado no CI.
