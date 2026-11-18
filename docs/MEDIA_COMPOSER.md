# Media Composer v0.8 — de imagens e clipes ao animatic MP4

> **Escopo comprovado:** renderização **local e técnica** com FFmpeg/FFprobe, sem Google Flow, sem consumo de créditos e sem aprovação criativa automática. O primeiro MP4 é um *preview/animatic* para revisão; um arquivo válido não substitui revisão editorial nem demonstra que imagens/vídeos foram gerados por IA.

## Para quem é

O StoryGuide já produz `EDIT_MANIFEST.json` (ordem de cenas e IDs de passos `video-*`) e `production.json` (planos aprovados e duração). O Media Composer usa **esses arquivos como fonte canônica**. Um terceiro arquivo, `RENDER_INPUTS.json`, informa onde estão os arquivos locais dos planos. Ele pode apontar para uma imagem (`image`) ou para um clipe existente (`video`). Isso permite substituir uma imagem com zoom por um clipe Flow sem alterar o roteiro, personagens ou estrutura de cenas.

### Dependências

- Node.js 22 recomendado (mínimo 20 para o restante do projeto).
- FFmpeg 6+ e FFprobe instalados no `PATH`, com codificadores `libx264` e `aac` e muxer `mov_text` para legendas MP4.
- O MCP externo do Flow **não é necessário** para composição local; nenhuma credencial é usada.
- Não se executa shell arbitrário a partir de nomes de arquivos: todos os argumentos FFmpeg são passados por `execFile` sem shell.

### Jornada mínima

**Caminho totalmente offline (sem cadastrar conta Flow):** depois de aprovar a história e o storyboard, gere um pacote de animatic local. Essa operação **não** cria imagens — elas devem ser fornecidas, aprovadas e vinculadas aos planos.

```bash
npm run operator -- render-export episodio-01
# Retorna packageDir em .studio/stories/episodio-01/offline-render.
```

**Caminho com workflow Flow:** depois de preparar uma história com `studio_story_prepare`, consulte o `packageDir` retornado. O Media Composer aceita os dois tipos de pacote:


```bash
# Gera um arquivo RENDER_INPUTS.json inicial, sem sobrescrever dados existentes.
npm run operator -- render-init '/caminho/.studio/stories/episodio-01/production'

# Por padrão, imagens esperadas em media/video-<shotId>.png.
# Coloque as imagens correspondentes lá; ou altere explicitamente kind/file para clipes MP4.
# Se a narração existir, coloque voice.wav dentro do pacote e configure audio.file.
# Adicione legendas como entradas startSeconds/endSeconds/text, se desejado.

# Sem modificar nada ou gastar créditos, valida correspondência, mídia e timing.
npm run operator -- render-plan '/caminho/.studio/stories/episodio-01/production/RENDER_INPUTS.json'

# Codifica um preview técnico local, sem autoaprovar a entrega.
npm run operator -- render '/caminho/.studio/stories/episodio-01/production/RENDER_INPUTS.json'
```

O arquivo final estará em `production/rendered/<fingerprint-prefix>/final.mp4`, acompanhado por `QC_REPORT.json` e `RENDER_MANIFEST.json`. Com legendas, também haverá `subtitles.srt`; elas são inseridas como faixa de legenda opcional `mov_text` no MP4, **não queimadas** na imagem. Um áudio fornecido é adaptado ao tempo do vídeo, com preenchimento de silêncio ao fim quando necessário. Sem áudio, o vídeo final não contém trilha de som.

### Contrato mínimo do arquivo `RENDER_INPUTS.json`

```json
{
  "schemaVersion": 1,
  "productionId": "story-episodio-01-v1",
  "editManifest": "EDIT_MANIFEST.json",
  "fps": 24,
  "width": 720,
  "height": 1280,
  "shots": [
    {
      "stepId": "video-plano-01",
      "kind": "image",
      "file": "media/video-plano-01.png",
      "durationSeconds": 6,
      "motion": "slow_zoom_in"
    },
    {
      "stepId": "video-plano-02",
      "kind": "video",
      "file": "media/video-plano-02.mp4",
      "durationSeconds": 5
    }
  ],
  "audio": { "file": "voice.wav" },
  "subtitles": [
    { "startSeconds": 0.0, "endSeconds": 3.0, "text": "Naquela manhã..." }
  ]
}
```

Este exemplo **é ilustrativo**: os IDs, durações e ordem precisam ser exatamente os retornados no `EDIT_MANIFEST.json` e `production.json` reais. Se a produção tiver três planos, três fontes devem existir, sem omissões. Um campo `sha256` opcional por mídia e áudio permite fixar explicitamente o digest esperado; de toda forma, o preflight calcula hashes e a saída inclui os digests usados. Para uma produção com narrativa sonora sincronizada, o agente/editor deve preparar e aprovar texto e áudio antes da montagem.

### Operações MCP e CLI

| Operação | Acesso | Efeito |
|---|---|---|
| `production_render_story_plan(storyId)` | MCP, somente leitura | Resume planos aprovados para render offline sem Flow |
| `production_render_template(packageDir)` | MCP, somente leitura | Propõe arquivo de inputs a partir dos manifests aprovados |
| `production_render_plan(manifestPath)` | MCP, somente leitura | Inspeciona mídias existentes, hashes e critérios técnicos |
| `render-export <storyId>` | CLI operador | Exporta manifests locais de uma história aprovada sem cadastrar conta Flow |
| `render-init <packageDir>` | CLI operador | Escreve template apenas se ainda não existir |
| `render-plan <RENDER_INPUTS.json>` | CLI operador | Preflight idêntico à ferramenta read-only |
| `render <RENDER_INPUTS.json>` | CLI operador | Renderiza e arquiva preview imutável; **não aprova editorialmente** |

É deliberado que `render` **não** exista como ferramenta MCP: uma chamada automática que codifica centenas de megabytes ou horas de vídeo precisa ser autorizada pelo operador, ainda que não consuma créditos do Flow. Agentes podem consultar o plano e indicar os arquivos ausentes, mas não executar pós-produção sem ação explícita.

## Decisões de implementação

- **Ordem e duração canônicas:** manifestos cruzados antes de usar qualquer mídia. Nunca elimina, reordena, duplica ou encurta um plano silenciosamente.
- **Um plano, uma fonte:** imagem com movimento suave (`static`, `slow_zoom_in`, `slow_zoom_out`, `slow_pan_left`, `slow_pan_right`) ou clipe existente; clipe menor que o solicitado bloqueia. Clipes longos são cortados à duração editorial.
- **Proporções:** 9:16, 16:9 ou 1:1, dimensões pares até 1920, FPS 24/25/30. Sem criação automática de faixas pretas: recorte central `scale+crop` para preencher o quadro.
- **Áudio:** arquivo WAV, MP3, M4A, FLAC ou OGG existente; sem TTS ou geração de vozes nesta versão. Um áudio curto é completado com silêncio; fala e legendas requerem sincronização humana.
- **Legendas:** intervalos não sobrepostos, ajustados ao tempo do vídeo; SRT sidecar e faixa de legenda MP4 opcional. Sem queima de legenda, sem alinhamento forçado.
- **Integridade:** entradas confinadas ao pacote por caminho real, recusa symlink que sai dele; SHA-256, FFprobe, imutabilidade de arquivos publicados por fingerprint, tentativa repetida retorna o resultado anterior após reconferir hashes.
- **Atomicidade:** clipes temporários e final produzidos em diretório provisório; publicação por rename, evitando `final.mp4` parcial. Falhas de FFmpeg limpam temporários e não se convertem em sucesso.
- **Responsabilidade editorial:** o resultado é `PREVIEW_RENDERED`. Não muda `StageEngine.DELIVERY` para `COMPLETED` nem aprova visualmente personagens/cenas.

## Verificações de qualidade (QC)

`QC_REPORT.json` inclui hash SHA-256 do MP4, duração efetiva, largura, altura, codec, presença de áudio, legenda embutida, fontes e seus hashes. Erros de codificação, duração, proporção e trilhas são bloqueantes. **Não** há medição automática de quadros pretos, silêncio indesejado, qualidade estética, sincronização fonética ou problemas de direitos autorais. A revisão desses pontos integra o próximo marco.

## Testes executáveis

```bash
npm run check
npm run docs:check
npm test                # Inclui testes com imagens/vídeos/áudio gerados localmente pelo FFmpeg
npm run test:mcp         # Smoke MCP; requer dependências npm instaladas
```

`tests/media-composer.test.mjs` cria fixtures **físicas**, entrega MP4 com áudio e legendas, valida hashes, reusa render anterior, verifica alternância de imagem para clipe e falha em path traversal, symlinks, hashes inválidos, duração adulterada e output alterado. Há dois cenários com um **StoryGuide real**: pacote preparado com conta simulada e pacote offline sem nenhuma conta cadastrada. O GitHub Actions confirma disponibilidade de FFmpeg/FFprobe antes dos testes.

## Limitações e backlog

1. Sem geração automática de narração, áudio ambiente ou música; sem sincronização semântica.
2. Sem transições elaboradas/crossfades; cortes secos e movimentos discretos de quadro.
3. Sem ingestão automática dos arquivos baixados do Flow para o mapeamento `RENDER_INPUTS.json` (ainda requer seleção explícita pelo agente/operador).
4. Sem aprovação visual/áudio do MP4 e sem sinalizar `DELIVERY` como editorialmente concluído no StageEngine.
5. Sem fila de renderização distribuída, cache de segmentos por shot ou cancelamento via painel.
6. Não adicione o vídeo/áudio real a um repositório público sem conferir direitos, privacidade e licenças.
