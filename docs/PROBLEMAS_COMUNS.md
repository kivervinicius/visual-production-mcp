# Problemas comuns — respostas em português simples

Para comandos básicos, veja [Comece aqui](COMECE_AQUI.md). Use `npm run doctor` dentro da pasta do projeto antes de procurar ajuda.

## 1. “node não é reconhecido”

O Node.js não está instalado ou a variável de ambiente `PATH` ainda não foi atualizada. Instale o Node.js LTS em [nodejs.org](https://nodejs.org/), feche e reabra o terminal e execute `node --version`. O projeto exige Node 20 ou superior.

## 2. “npm não é reconhecido” ou `npm.ps1 cannot be loaded`

O npm vem com Node.js. Se o Node funcionar mas o npm não, confira a instalação. Se o PowerShell bloquear o script `.ps1`, use `npm.cmd install`, `npm.cmd run doctor` ou `npm.cmd run demo`. Não recomendamos desabilitar globalmente a política de execução do Windows.

## 3. “git não é reconhecido”

Instale o Git em [git-scm.com](https://git-scm.com/downloads) e reinicie o terminal. Como alternativa, baixe o ZIP do repositório no GitHub e extraia-o. Se usar ZIP, as instruções de `git pull` não funcionam; atualize baixando uma nova versão.

## 4. “ENOENT: ffmpeg” ou “ffprobe not found”

FFmpeg/FFprobe não foram encontrados. Instale os dois a partir de [ffmpeg.org](https://ffmpeg.org/download.html), inclua-os no `PATH` e reabra o terminal. Confirme `ffmpeg -version`, `ffprobe -version` e `npm run doctor`. Você pode planejar histórias sem eles, mas não renderizar MP4.

## 5. “Missing encoder libx264 / mov_text”

Seu FFmpeg foi instalado com codecs limitados. Use uma build que ofereça `libx264`, `aac` e `mov_text`; `npm run doctor` verifica as três capacidades. Não tente remover checagens do renderizador para gerar um arquivo potencialmente inválido.

## 6. “Cannot find package @modelcontextprotocol/…”

Você provavelmente ainda não executou `npm install` ou está no diretório errado. Entre na pasta que contém `package.json`, execute `npm install` e reinicie seu cliente de IA. Se a rede corporativa/proxy bloquear o registry npm, peça liberação ao administrador; **não execute scripts desconhecidos para contornar restrições**.

## 7. “Não sei onde o vídeo foi salvo”

Após `npm run demo`, copie a linha **Vídeo:** do terminal. O arquivo será `.studio/demos/primeiro-video-demo-v1/rendered/<hash>/final.mp4`. Após renderizar sua história, use o `outputDir` retornado por `npm run operator -- render ...`. A subpasta por hash varia; não use um caminho inventado.

## 8. “O vídeo abre, mas não mostra as legendas”

As legendas são uma faixa de texto selecionável (`mov_text`) no MP4; em vários reprodutores é preciso ativá-las no menu de legendas. Quando configuradas, também existe um `subtitles.srt` para usar separadamente. A versão atual não grava as legendas como texto visível permanentemente no quadro.

## 9. “Meu vídeo saiu sem áudio”

O demo não inclui áudio: é intencional. O Media Composer não gera voz ou música. Para uma história real, é necessário fornecer um arquivo de áudio permitido e vinculá-lo ao manifesto. Veja [Primeira história](PRIMEIRA_HISTORIA.md#passo-6--narração-áudio-e-legendas-opcionais).

## 10. “O agente não encontra as ferramentas MCP”

Confirme que instalou as dependências (`npm install`), que o caminho para `src/server.mjs` é absoluto, que o aplicativo aceita MCP **stdio**, que a configuração não sobrescreveu outros servidores e que você reiniciou a sessão. No Codex CLI, confira `codex mcp list`. Para outros clientes, veja a tela de servidores do próprio aplicativo.

**Não confunda seu aplicativo ChatGPT comum com uma instalação de servidor MCP local.** O Visual Production MCP não fica automaticamente conectado a qualquer chat, mesmo que o chat tenha acesso à internet.

## 11. “Pedi uma história, mas o agente exige JSON”

Você não deveria precisar escrever manualmente o elenco ou o storyboard em JSON. Copie o prompt em [Primeira história](PRIMEIRA_HISTORIA.md#passo-2--copie-este-pedido-para-seu-assistente-de-ia), com as suas palavras, e peça ao agente que use as ferramentas do Visual Production MCP. Ele pode discutir as decisões em linguagem natural antes de salvar os dados estruturados.

## 12. “A IA disse que o vídeo está pronto, mas não vejo arquivo”

Peça o caminho exato de `final.mp4`, ou um recibo do job do Flow com o arquivo original validado. Uma proposta de storyboard ou um ID inventado **não é vídeo pronto**. O estado `PREVIEW_RENDERED` demonstra somente um preview técnico local, ainda sujeito à aprovação editorial.

## 13. “editor-approved cast and storyboard required”

O sistema precisa que o elenco e o storyboard tenham sido revisados por você. Consulte `npm run operator -- production-status ID`, copie `reviewVersion` e use `production-decision ID approve HASH`. A IA não consegue se autoaprovar por uma ferramenta MCP.

## 14. “ENOENT / missing media / unsafe path” na renderização

Abra `RENDER_INPUTS.json` e confira o campo `file` de cada plano. O arquivo precisa existir **dentro da pasta de renderização**, normalmente em `media/`, com nome e extensão exatamente correspondentes. Não use `../` para apontar a outro diretório. O sistema bloqueia caminhos fora do pacote para proteger seus arquivos.

## 15. “Shot order mismatch” ou “duration differs from storyboard”

Você alterou a ordem ou a duração de um plano em relação ao storyboard aprovado. Corrija o mapeamento das mídias sem modificar o manifesto editorial. Se a própria história ou o tempo da cena precisarem mudar, faça uma nova revisão antes de renderizar.

## 16. “O vídeo do Flow não foi gerado”

Primeiro confirme a conta e projeto reais no Flow. O suporte a imagens e vídeos simples via upstream é experimental e depende de autenticação; o caminho com frames é, no momento, **somente pré-verificação**. Se uma chamada paga retornou estado incerto, **não a repita automaticamente**. Consulte [Google Flow opcional](GOOGLE_FLOW_OPCIONAL.md) e as instruções de reconciliação.

## 17. “Posso apagar `.studio` para limpar tudo?”

Não sem fazer backup. A pasta armazena histórias originais, estado de produção, aprovações e materiais. O Git ignora `.studio/` por privacidade, portanto um `git pull` não recupera seu conteúdo se você apagar. Faça backup em local privado e protegido.

## 18. “Como pedir suporte sem divulgar minhas histórias?”

Envie, se necessário, **sem dados pessoais/segredos**:

- sistema operacional e versões de Node/npm/FFmpeg;
- comando exato que falhou e mensagem de erro (remova caminhos com nome de usuário se quiser);
- resultado do `npm run doctor -- --json` revisado antes de compartilhar;
- se relevante, o `QC_REPORT.json` **somente depois de revisar** que não contém nomes e conteúdo sensíveis.

Nunca compartilhe `.studio/upstreams.json`, cookies, arquivos de sessão, senhas, chaves, história particular ou arquivos originais não autorizados.
