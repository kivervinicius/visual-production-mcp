# Sua primeira história — roteiro, cenas e primeiro animatic

Este tutorial começa **depois** da instalação e do demo em [Comece aqui](COMECE_AQUI.md). Você não precisa escrever JSON para a IA montar o roteiro. Os comandos manuais aparecem apenas nos pontos em que é importante **você** aprovar ou renderizar.

## Como funciona

```text
Sua história (texto)
    → IA analisa personagens e locais
    → Você revisa as propostas
    → IA divide o texto em cenas/planos
    → Você aprova a versão editorial
    → Você fornece imagens/clipes para os planos
    → FFmpeg monta um animatic MP4
    → Você assiste e aprova (ou pede ajustes)
```

O sistema preserva a história e registra seus passos na pasta `.studio/`. Não é necessário criar conta Google Flow para esse caminho. **A IA que acompanha você vem do seu aplicativo (Codex, Antigravity etc.), não do MCP.**

## Passo 1 — Tenha sua história em mãos

Use a sua história, em texto. Ela pode ser curta. Exemplo ilustrativo:

> Marina encontrou uma carta embaixo da porta. No envelope estava escrito: “Não abra antes do amanhecer”. Ela olhou para a janela e viu as primeiras luzes da cidade.

Você pode colar diretamente no chat do agente conectado ou criar um arquivo `.txt`/`.md` em seu computador. Evite arquivos com dados pessoais ou de outras pessoas sem autorização.

Escolha um identificador curto e sem espaços, por exemplo `carta-ep01`. O sistema usa esse ID para retomar a produção. **Não é uma senha.**

## Passo 2 — Copie este pedido para seu assistente de IA

O prompt abaixo foi escrito para que o agente trabalhe por etapas e explique o que está fazendo, sem exigir conhecimento técnico:

> Quero criar um vídeo vertical 9:16 usando o Visual Production MCP. Minha história está logo abaixo. Registre a fonte original com o ID `carta-ep01`, leia o texto inteiro e me conduza fase a fase. Primeiro mostre os personagens, lugares e a proposta de estilo; explique o que veio do roteiro e o que você está sugerindo. Depois proponha o storyboard plano a plano com durações. **Não aprove nada por mim, não gere mídia paga, não simule arquivos do Google Flow e não mude o conteúdo da história sem avisar.** Quero começar com um animatic local, usando imagens que eu fornecer. Quando houver uma decisão minha, explique em português simples como fazê-la. Use `studio_story_*`, `production_get_status` e `production_get_next_action`. História: [COLE A SUA HISTÓRIA AQUI].

**O resultado esperado:** o assistente deve retornar um resumo legível de elenco, locações, hipóteses visuais e cenas. Ele usará ferramentas MCP para salvar as informações, mas você não precisa copiar os JSONs manualmente. Revise a proposta, especialmente a aparência de personagens, a ordem dos acontecimentos e informações que não estavam no texto original.

> Se a IA afirmar que já gerou uma imagem ou vídeo, confira se ela mostrou um **arquivo real** ou um **recibo de job verificável**. Uma descrição de cena não é mídia gerada.

## Passo 3 — Revise antes de aprovar

Peça ao agente para mostrar o que foi registrado. Ele pode usar `studio_story_draft` e `production_get_status`. Confira:

- **Personagens:** nomes, aparência sugerida e consistência entre cenas.
- **Cenários:** onde cada evento se passa.
- **Cenas:** todas as ações importantes permanecem no roteiro.
- **Durações:** cada plano tem uma duração prevista; a montagem local mantém esses tempos.
- **Hipóteses criativas:** roupas, estilo, iluminação e detalhes não mencionados devem estar claramente identificados como propostas, não como fatos do roteiro.

Se algo estiver incorreto, diga ao agente **qual ponto deseja alterar** antes de aprovar. Aprovar encerra essa revisão; mudanças significativas depois exigem nova versão editorial ou novo ID de história.

### Aprovação explícita (você no terminal)

Na pasta `visual-production-mcp`, execute:

```bash
npm run operator -- production-status carta-ep01
```

Esse comando mostra a `reviewVersion` da versão editorial atual. Copie exatamente o valor que o comando retornou (é um hash, não é uma senha). Para aprovar a proposta:

```bash
npm run operator -- production-decision carta-ep01 approve COLE_A_REVIEW_VERSION
```

Para solicitar revisão em vez de aprovar:

```bash
npm run operator -- production-decision carta-ep01 request_changes COLE_A_REVIEW_VERSION "A aparência da Marina precisa mudar"
```

**Por que o agente não aprova sozinho?** Para evitar que uma IA transforme suposições em decisões editoriais definitivas ou realize operações sem você ter visto os detalhes.

O comando acima **não autoriza gastos**. A aprovação de uma geração paga é uma decisão diferente.

## Passo 4 — Prepare a pasta do seu primeiro vídeo

Após a aprovação editorial, execute:

```bash
npm run operator -- render-export carta-ep01
```

Copie o valor `packageDir` que aparece no resultado. É a pasta do pacote de renderização. Ela ficará normalmente em `.studio/stories/carta-ep01/offline-render`.

Em seguida (substitua o caminho pelo `packageDir` retornado):

```bash
npm run operator -- render-init "CAMINHO_COMPLETO_DA_PASTA_RETORNADA"
```

Isso cria `RENDER_INPUTS.json` com **um slot por plano**, na ordem aprovada. O projeto não inventa imagens de cenas. O agente pode explicar o que cada imagem precisa representar; você pode fornecer fotografias, ilustrações ou imagens previamente geradas, desde que tenha direito de usá-las.

### Onde colocar as imagens

Abra a pasta do pacote, procure (ou crie) a subpasta `media/` e copie os arquivos correspondentes ao storyboard. Os nomes esperados estão dentro de `RENDER_INPUTS.json`, por exemplo:

```text
.studio/stories/carta-ep01/offline-render/
├── production.json                 # conteúdo estruturado do roteiro aprovado
├── EDIT_MANIFEST.json              # ordem dos planos
├── RENDER_INPUTS.json              # nome de arquivo esperado para cada plano
└── media/
    ├── video-plano-01.png          # imagem real fornecida por você
    └── video-plano-02.png
```

Os nomes acima são **exemplos**. Use os nomes reais mostrados pelo seu arquivo e pelo assistente. Para fazer isso sem editar JSON, peça ao agente: “Leia meu `RENDER_INPUTS.json` e diga, em português, quais arquivos preciso colocar em `media/`”.

**Não use arquivos de demonstração como prova de conteúdo da sua história.** Se quiser um teste temporário, pode colocar imagens que você possui, sabendo que o resultado será apenas um animatic de teste.

### E se eu tiver um clipe MP4 em vez de uma imagem?

O renderizador aceita `image` ou `video` por plano, mas a troca exige atualizar o respectivo `kind` e caminho no `RENDER_INPUTS.json`. Peça ao agente para orientar a alteração; não reordene planos e não mude a duração aprovada. Vídeos mais curtos que o plano previsto são rejeitados. O comando [Flow → Render](FLOW_TO_RENDER.md) oferece um procedimento separado, com seleção explícita, para clips produzidos pelo provedor.

## Passo 5 — Valide e renderize

No terminal:

```bash
npm run operator -- render-plan "CAMINHO_COMPLETO/RENDER_INPUTS.json"
```

Se estiver tudo pronto, o comando retorna `READY_TO_RENDER`. Se avisar que alguma imagem está faltando, volte ao passo anterior e confira o nome e a pasta. Também pode informar proporção, duração, hash ou áudio incompatível. **Não remova a verificação** para forçar a renderização.

Agora gere o vídeo:

```bash
npm run operator -- render "CAMINHO_COMPLETO/RENDER_INPUTS.json"
```

O resultado informa `outputDir`, por exemplo:

```text
.../offline-render/rendered/abc123.../
├── final.mp4
├── QC_REPORT.json
├── RENDER_MANIFEST.json
└── subtitles.srt                 # se você tiver configurado legendas
```

Abra `final.mp4` e assista. O resultado é **um preview técnico**, mesmo que esteja em MP4; ele ainda depende de sua aprovação editorial.

## Passo 6 — Narração, áudio e legendas (opcionais)

O Media Composer não gera uma voz por IA. Para adicionar narração, forneça um arquivo de áudio existente (`.wav`, `.mp3`, `.m4a`, `.flac` ou `.ogg`) e peça ao agente para orientar a inclusão em `RENDER_INPUTS.json` no campo `audio.file`. Se precisar de voz gerada por IA, utilize uma ferramenta de narração própria com autorização e direitos adequados, antes de importar o arquivo.

As legendas são intervalos `startSeconds`/`endSeconds` e texto. Se estiverem configuradas corretamente, o renderizador gera um `.srt` e pode embutir uma faixa de legendas selecionável no MP4. Ele **não** faz transcrição, alinhamento automático ou legendas queimadas no quadro nesta versão.

Se não houver áudio ou legendas, deixe esses campos opcionais vazios. O projeto não inventa uma trilha automaticamente.

## Passo 7 — Retome dias depois

Abra seu assistente já conectado e diga:

> Continue a história `carta-ep01` no Visual Production MCP. Consulte `production_get_status` e `production_get_next_action`, mostre os materiais já aprovados e diga qual é a próxima decisão pendente. Não recomece nem regenere arquivos aprovados sem minha autorização.

Ou no terminal:

```bash
npm run operator -- story-status carta-ep01
npm run operator -- production-next carta-ep01
```

Os materiais continuam em `.studio/`, independentemente do histórico do chat. **Faça backup dessa pasta** antes de trocar de computador ou reinstalar o sistema. Ela pode conter seu texto original e mídias particulares: não envie ao GitHub público.

## O que é possível hoje e o que ainda não é

| Resultado | Situação |
| --- | --- |
| Salvar uma história e retomar depois | Implementado |
| Propor elenco, cenários e cenas com um agente | Implementado, depende do agente externo |
| Aprovar editorialmente e preservar versões | Implementado |
| Preparar imagens e clipes aprovados para montagem | Implementado, requer arquivos locais |
| Produzir MP4 local com movimentos simples, áudio e legendas opcionais | Implementado |
| Gerar automaticamente todas as imagens e vídeos pelo Flow a partir da história | **Ainda não homologado** |
| Aprovar o vídeo final apenas porque existe um MP4 | **Não permitido** |

O próximo passo opcional é [configurar Google Flow](GOOGLE_FLOW_OPCIONAL.md). Se alguma etapa falhar, vá para [Problemas comuns](PROBLEMAS_COMUNS.md).
