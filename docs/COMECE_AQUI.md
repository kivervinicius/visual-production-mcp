# Comece aqui — instalação do Visual Production MCP do zero

**Público:** pessoas sem experiência com programação, terminal, MCP ou edição de vídeo. Os exemplos estão em português e não exigem uma conta Google.

**O que você conseguirá fazer hoje:** instalar o projeto, verificar se o computador está pronto, criar um vídeo demonstrativo de 4 segundos, conectar um assistente de IA compatível com MCP e organizar uma história pessoal em cenas. Para transformar **sua própria** história em vídeo, serão necessárias imagens ou clipes fornecidos/aprovados por você. A geração automatizada completa no Google Flow ainda não foi homologada.

## 1. Entenda o que está instalando

O Visual Production MCP **não é um editor com janelas e botões**. Ele é um conjunto de ferramentas que pode ser usado por um assistente de IA, como Codex ou outro aplicativo que aceite servidores MCP. O assistente conversa com você; este projeto guarda a história, divide o planejamento em etapas, organiza personagens, referências e vídeos, e verifica arquivos.

Há três caminhos diferentes:

| O que você quer fazer? | Precisa de conta Google Flow? | Precisa de FFmpeg? | Comece por |
| --- | --- | --- | --- |
| Conferir se instalou corretamente | Não | Não | `npm run doctor` |
| Ver um MP4 de demonstração | Não | Sim | `npm run demo` |
| Planejar a sua história com a IA | Não | Não | [Primeira história](PRIMEIRA_HISTORIA.md) |
| Montar um animatic com suas imagens | Não | Sim | [Primeira história](PRIMEIRA_HISTORIA.md) |
| Criar vídeos usando o Google Flow | Sim | Recomendado | [Google Flow opcional](GOOGLE_FLOW_OPCIONAL.md) |

**Importante:** demonstração, planejamento e renderização local **não gastam créditos do Flow**. O MP4 demonstrativo usa imagens geométricas geradas localmente — não é uma animação criada por IA.

## 2. Instale as ferramentas necessárias

### Windows 10/11 (PowerShell)

1. Instale o **Node.js LTS** em [nodejs.org](https://nodejs.org/) (o projeto requer Node.js 20 ou superior; recomendamos 22 LTS ou mais recente compatível).
2. Instale o **Git** em [git-scm.com/downloads](https://git-scm.com/downloads) para baixar atualizações. Como alternativa, no GitHub escolha `Code` → `Download ZIP` e extraia a pasta.
3. Para **gerar MP4**, instale FFmpeg/FFprobe a partir das opções apontadas em [ffmpeg.org/download.html](https://ffmpeg.org/download.html). Garanta que `ffmpeg.exe` e `ffprobe.exe` estejam no `PATH` do Windows. O instalador precisa incluir H.264 (`libx264`), AAC e legendas `mov_text`.
4. **Feche e abra o PowerShell novamente** após a instalação para atualizar o `PATH`.

Verifique (copie uma linha de cada vez):

```powershell
node --version
npm --version
git --version
ffmpeg -version
ffprobe -version
```

Se um comando não for reconhecido, o aplicativo correspondente ainda não está disponível no terminal. Sem FFmpeg é possível **planejar histórias**, mas não gerar o MP4.

Se o Windows bloquear `npm.ps1` com erro de *execution policy*, use `npm.cmd` nos comandos seguintes (por exemplo, `npm.cmd install`). Não é necessário desabilitar permanentemente as proteções do PowerShell.

### macOS

Instale Node.js LTS e Git. Para renderizar, instale FFmpeg/FFprobe (por exemplo, pelo Homebrew, se já utilizar):

```bash
brew install node git ffmpeg
```

Confirme as versões com os mesmos comandos do Windows. Sem Homebrew, use os instaladores oficiais.

### Linux (Ubuntu/Debian)

Instale Git e FFmpeg pelo gerenciador de pacotes e Node.js LTS por um canal que forneça Node **20+**:

```bash
sudo apt update
sudo apt install -y git ffmpeg
node --version
```

Se o Node for mais antigo que 20, atualize-o antes de prosseguir. Verifique `libx264`, `aac` e `mov_text` com `npm run doctor` após baixar o projeto.

## 3. Baixe o projeto

Abra uma pasta onde deseja guardar seus projetos, por exemplo `Documentos`:

**Windows (PowerShell):**

```powershell
cd "$HOME\Documents"
git clone https://github.com/kivervinicius/visual-production-mcp.git
cd visual-production-mcp
npm install
```

**macOS/Linux:**

```bash
cd ~/Documents
git clone https://github.com/kivervinicius/visual-production-mcp.git
cd visual-production-mcp
npm install
```

Se baixou o ZIP, abra o terminal **dentro da pasta extraída que contém `package.json`** e execute apenas `npm install`.

O comando `npm install` instala as dependências do servidor MCP; **não inicia o Flow nem gera conteúdo**. Aguarde até ele terminar, sem fechar o terminal.

## 4. Confira sua instalação

Na pasta `visual-production-mcp`, execute:

```bash
npm run doctor
```

Ele indica `OK` ou `PENDENTE` para Node, npm, dependências MCP, FFmpeg/FFprobe e formatos necessários. Também mostra a pasta local onde o projeto guarda arquivos. O diagnóstico é **somente leitura**, não envia dados e não acessa nenhuma conta Google.

Se aparecer `Dependências MCP — PENDENTE`, confira se executou `npm install` **dentro da pasta correta**. Se FFmpeg estiver pendente, a criação de MP4 ficará indisponível; o planejamento de histórias continua possível.

Para um relatório em JSON, caso o suporte solicite: `npm run doctor -- --json`.

## 5. Crie seu primeiro MP4 de exemplo

```bash
npm run demo
```

O script cria **duas imagens sintéticas**, aplica movimentos de câmera, monta um vídeo vertical de aproximadamente 4 segundos e adiciona legendas, sem voz ou trilha. Ao final, ele mostra o caminho completo do arquivo `final.mp4`.

**Onde fica:** dentro da pasta `.studio/demos/primeiro-video-demo-v1/rendered/`, em uma subpasta identificada por um hash. O terminal mostra o caminho exato; não adivinhe o nome da subpasta.

- No Windows, copie o caminho impresso e cole na barra de endereço do Explorador de Arquivos; abra `final.mp4`.
- No macOS, abra o arquivo pelo Finder; no Linux, utilize seu gerenciador de arquivos.
- As legendas são uma **faixa selecionável** do MP4. Se não aparecerem, habilite-as nas configurações de legendas do seu reprodutor de vídeo.
- O arquivo `QC_REPORT.json` é um **relatório técnico**: duração, dimensões, codec e hash. Você não precisa abri-lo para assistir ao vídeo.

Rodar o demo de novo **não substitui** o vídeo anterior íntegro. O sistema reutiliza o render já validado. Se você alterar os arquivos de configuração da demonstração, a execução poderá parar para não sobrescrever nada.

> **O demo é apenas um teste da instalação.** Não transforma sua história, não acessa a internet para criar mídia e não substitui a revisão editorial de um episódio real.

## 6. Conecte seu assistente (opcional para o demo)

Para que a IA analise sua história automaticamente, você precisa de um **cliente que suporte MCP local via stdio**. O servidor do projeto e o aplicativo de IA são programas separados.

### Codex CLI

Na pasta do projeto, use o terminal. O exemplo PowerShell abaixo descobre o diretório sem pedir que você escreva um caminho manualmente:

```powershell
$repo = (Get-Location).Path
codex mcp add visual-production --env "STUDIO_HOME=$repo\.studio" -- node "$repo\src\server.mjs"
codex mcp list
```

Se o comando `codex` não existir, instale/configure o Codex CLI pelo procedimento oficial do produto e execute novamente. O Visual Production MCP **não instala o Codex** e não oferece conta ou modelo de IA por conta própria. Após conectar, reabra a sessão do agente se ele não atualizar a lista de ferramentas imediatamente.

**macOS/Linux:**

```bash
codex mcp add visual-production \
  --env "STUDIO_HOME=$(pwd)/.studio" \
  -- node "$(pwd)/src/server.mjs"
codex mcp list
```

### Antigravity e outros clientes compatíveis

Nas configurações do cliente, procure **servidores MCP (stdio)**. Configure a execução abaixo, **substituindo os dois caminhos** pelo caminho real da pasta em seu computador:

```json
{
  "mcpServers": {
    "visual-production": {
      "command": "node",
      "args": ["C:/Users/SEU_USUARIO/Documents/visual-production-mcp/src/server.mjs"],
      "env": {
        "STUDIO_HOME": "C:/Users/SEU_USUARIO/Documents/visual-production-mcp/.studio"
      }
    }
  }
}
```

O exemplo mostra a seção de servidores, **não significa que o arquivo de configuração completo do seu aplicativo tenha exatamente esse formato**. A localização e o envelope variam entre clientes/versões. Não substitua outras configurações já existentes. Em caso de dúvida, use a interface de adicionar servidor MCP do aplicativo.

Confirme no cliente que há ferramentas como `studio_story_start`, `production_get_status` e `studio_story_submit_storyboard`. Se não aparecerem, confira os caminhos, `npm install`, reinicie o cliente e consulte [Problemas comuns](PROBLEMAS_COMUNS.md).

**Não compartilhe cookies, senha Google ou chave de API no chat.** O projeto armazena o progresso em `.studio/`, que deve permanecer privado.

## 7. Agora use uma história de verdade

Siga **[Primeira história — do texto ao animatic](PRIMEIRA_HISTORIA.md)**. Você aprenderá a:

1. enviar um texto ao agente;
2. revisar personagens e cenas antes de aprovar;
3. fornecer imagens para cada plano;
4. montar o vídeo local e conferir a saída;
5. retomar o projeto dias depois sem recomeçar a conversa.

Se quiser entender os termos, consulte [Glossário](GLOSSARIO.md). Se algum comando falhar, consulte [Problemas comuns](PROBLEMAS_COMUNS.md).

## 8. Atualizações e privacidade

Para atualizar **o código**, sem mexer nas suas histórias locais:

```bash
git checkout main
git pull origin main
npm install
npm run doctor
```

Se você instalou via ZIP, baixe e extraia a versão mais recente **em outra pasta** antes de mover sua pasta privada `.studio/`. Não apague `.studio/` sem backup: ela contém os textos originais, referências, decisões, materiais e manifestos locais. Nunca envie `.studio/` para um repositório público.

Este projeto é independente e **não oficial do Google**. Usar a geração real no Flow pode ter custos e restrições; leia [Google Flow opcional](GOOGLE_FLOW_OPCIONAL.md) antes de qualquer operação paga.
