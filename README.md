# Visual Production MCP

[![Testes](https://github.com/kivervinicius/visual-production-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/kivervinicius/visual-production-mcp/actions/workflows/ci.yml)

**Transforme uma história em um projeto audiovisual, com orientação fase a fase, personagens consistentes, storyboard, mídias e montagem de um vídeo local.** O projeto é gratuito e de código aberto, mas a geração de imagens/vídeos em serviços externos pode ter custos próprios.

**Versão: 0.8.3 · Idioma dos tutoriais: português (Brasil) · Desenvolvimento na `main`.**

> **É sua primeira vez?** Abra **[COMECE AQUI — instalação e primeiro vídeo](docs/COMECE_AQUI.md)**. O manual ensina desde instalar Node.js até abrir seu primeiro MP4. Não é necessário saber programar nem ter uma conta Google Flow para experimentar.

## Comece com três comandos

Depois de baixar o repositório e abrir o terminal dentro da pasta:

```bash
npm install
npm run doctor
npm run demo
```

`doctor` verifica o computador **sem modificar arquivos**. `demo` cria um **MP4 demonstrativo de quatro segundos**, com movimentos leves e legendas, em `.studio/demos/`. É um teste local com imagens sintéticas: **não foi gerado por IA e não usa créditos Google**.

Se algo falhar, consulte **[Problemas comuns](docs/PROBLEMAS_COMUNS.md)**.

## Como transformar sua história em um vídeo

| Etapa | O que acontece | Sua participação |
| --- | --- | --- |
| 1. Conte a história | O agente lê e registra seu texto original | Envie/cole o roteiro |
| 2. Revise os personagens | A IA propõe aparência, cenários e estilo | Corrija o que for necessário |
| 3. Revise o storyboard | A IA divide a história em cenas, planos e durações | Aprove a direção editorial |
| 4. Forneça imagens ou clipes | O MCP associa arquivos locais a cada plano | Escolha materiais autorizados |
| 5. Monte o vídeo | O Media Composer usa FFmpeg, movimentos discretos e legendas opcionais | Assista ao MP4 e peça correções |
| 6. Opcional: Google Flow | Adapters experimentais podem inspecionar conta e trabalhos de geração | Autorize qualquer custo separadamente |

**[Tutorial completo: sua primeira história, do texto ao animatic](docs/PRIMEIRA_HISTORIA.md)** — inclui texto pronto para copiar no assistente, o que revisar, como aprovar e como localizar `final.mp4`.

## O que funciona hoje

| Recurso | Situação real |
| --- | --- |
| Registrar história, guardar texto e retomar a produção | **Funciona localmente** |
| Propor elenco, locais e storyboard com um agente MCP | **Funciona**, requer um agente de IA externo |
| Biblioteca visual, versões e aprovações | **Funciona localmente** |
| Montar MP4 a partir de imagens/vídeos existentes | **Funciona**; FFmpeg/FFprobe são necessários |
| Música, voz ou imagens automaticamente produzidas pelo MCP | **Não incluídas** no fluxo offline; arquivos devem ser fornecidos |
| Integração experimental Google Flow para texto → imagem/vídeo | **Código disponível**, mas sem validação autenticada completa em uma conta real |
| Pré-verificação de frames e referências no `gflow-cli` | **Somente leitura**; não gera vídeo nem gasta créditos |
| História → todas as imagens/vídeos gerados pelo Flow → episódio final automaticamente aprovado | **Ainda não implementado/homologado** |

Um MP4 produzido pelo `demo` ou pelo Media Composer é um **preview técnico** (`PREVIEW_RENDERED`), não uma entrega aprovada. Nunca confunda plano, mídia gerada e vídeo editorialmente validado.

## Você precisa de quais programas?

- **Node.js 20+** (recomendamos uma LTS compatível, como Node 22), com npm.
- **Git** para baixar e atualizar o projeto, ou faça download do ZIP pelo GitHub.
- **FFmpeg + FFprobe** para criar vídeos MP4 locais. Não são necessários para planejar histórias.
- **Codex, Antigravity ou outro cliente MCP** para que uma IA leia histórias e proponha as etapas. O projeto não traz um modelo de IA próprio.
- **Conta Google Flow? Não** para planejar ou montar animatics locais. Somente para experimentar a integração externa, com aprovação de custos.

**[Instalação passo a passo no Windows, macOS e Linux](docs/COMECE_AQUI.md)**.

## Um exemplo de conversa com o assistente

Depois de conectar o servidor MCP, cole no seu aplicativo de IA:

> Quero criar um vídeo vertical a partir desta história. Use o Visual Production MCP para registrar a história, sugerir personagens e cenários e montar um storyboard. Explique cada fase de forma simples, peça minha revisão e **não aprove decisões nem gaste créditos por mim**. Quero começar por um animatic com imagens locais. Minha história é: [COLE AQUI].

O assistente deve usar `studio_story_start`, `studio_story_submit_cast`, `studio_story_submit_storyboard` e `production_get_next_action`. Se houver uma decisão editorial, você a confirma no terminal do operador. [Veja o procedimento de aprovação e montagem](docs/PRIMEIRA_HISTORIA.md).

## Arquivos e privacidade

- Sua história, decisões e material local ficam em **`.studio/`**, pasta ignorada pelo Git. Não a apague sem backup.
- `README.md`, `docs/` e `skills/` contêm documentação; `src/` contém código; `tests/` contém testes; `examples/` contém exemplos.
- Nunca envie senha, cookie, token de sessão, mídia privada ou dados pessoais para este repositório público.
- Não existe transferência de créditos entre contas nem automação de contorno de CAPTCHA ou restrições de serviços.

## Documentação organizada por público

| Quero... | Abra |
| --- | --- |
| Instalar do zero e ver o primeiro MP4 | **[Comece aqui](docs/COMECE_AQUI.md)** |
| Criar minha primeira história com uma IA | **[Primeira história](docs/PRIMEIRA_HISTORIA.md)** |
| Resolver um erro | [Problemas comuns](docs/PROBLEMAS_COMUNS.md) |
| Entender MCP, storyboard, hash etc. | [Glossário](docs/GLOSSARIO.md) |
| Experimentar Google Flow com cautela | [Google Flow opcional](docs/GOOGLE_FLOW_OPCIONAL.md) |
| Entender o renderizador e seus formatos | [Media Composer](docs/MEDIA_COMPOSER.md) |
| Ver a instalação avançada de provedores | [Flow Bridge](docs/FLOW_LIVE_BRIDGE.md) · [Frames/Ingredients](docs/GFLOW_FRAMES.md) |
| Usar o projeto como desenvolvedor | [Índice técnico](docs/README.md) · [AGENTS.md](AGENTS.md) · [CONTRIBUTING.md](CONTRIBUTING.md) |
| Consultar as instruções técnicas anteriores completas | [Referência anterior (arquivada)](README_TECNICO_ANTERIOR.md) |

## Testes e manutenção

```bash
npm run doctor         # diagnóstico sem alterar arquivos
npm run demo           # MP4 sintético local, sem conta externa
npm run check          # sintaxe Node.js
npm run docs:check     # links internos de Markdown
npm test               # testes automatizados
npm run test:mcp       # teste de comunicação real do servidor MCP
```

A validação de produção real no Flow é **separada dos testes automáticos** e exige sua conta e autorização. O projeto é independente, sob licença MIT, e não possui afiliação com Google ou qualquer provedor de vídeo.
