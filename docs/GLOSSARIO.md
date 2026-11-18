# Glossário — termos explicados sem jargão

Para usar o produto pela primeira vez, leia [Comece aqui](COMECE_AQUI.md).

| Termo | Significado simples |
| --- | --- |
| **História** | Texto original que você quer transformar em um vídeo. |
| **Roteiro** | Organização dos acontecimentos que serão mostrados. O projeto preserva o texto original e registra hipóteses criativas separadamente. |
| **Personagem** | Pessoa ou figura recorrente na história, com identidade e aparência que podem ser reutilizadas. |
| **Cenário / locação** | Ambiente onde uma cena acontece. |
| **Bíblia visual** | Conjunto de regras de estilo, personagens, aparência e lugares para manter a consistência. |
| **Cena** | Trecho da história que ocorre numa situação ou lugar. |
| **Plano / shot** | Um enquadramento individual que compõe uma cena. Pode usar uma imagem estática com movimento ou um clipe de vídeo. |
| **Storyboard** | Lista ordenada dos planos, incluindo descrição visual, duração, movimento de câmera e personagens. |
| **Animatic** | Primeira versão em vídeo feita de imagens, cortes e movimentos simples para avaliar ritmo e história antes dos vídeos definitivos. |
| **MP4** | Arquivo de vídeo que você pode abrir em um reprodutor. Não significa, por si só, que o conteúdo foi aprovado. |
| **FFmpeg** | Ferramenta gratuita executada no computador para montar arquivos de áudio, imagens e vídeos. |
| **FFprobe** | Ferramenta que inspeciona tecnicamente arquivos de vídeo e áudio. |
| **MCP** | Protocolo que permite ao aplicativo de IA conversar com ferramentas externas, como as deste projeto. |
| **Cliente MCP** | Aplicativo que usa o servidor, como um agente de IA compatível. |
| **Servidor MCP** | Programa local que expõe as ferramentas de história, produção e consulta de status. |
| **Skill** | Instruções para o agente de IA sobre como orientar a produção. Ela **não executa o Flow sozinha**. |
| **Google Flow** | Serviço de terceiros que pode gerar mídia usando modelos de IA e créditos da conta autorizada. |
| **Adaptador / upstream** | Ponte técnica entre o Visual Production MCP e outro MCP ou serviço de geração. |
| **Preview** | Versão preliminar para revisar. |
| **Aprovação editorial** | Você confirma que as ideias de história e as escolhas visuais estão corretas. |
| **Autorização de gastos** | Você permite separadamente que uma operação potencialmente paga seja executada. |
| **Créditos** | Unidade de consumo do serviço externo. A estimativa local não equivale ao saldo real. |
| **Job** | Trabalho enviado ao provedor; um ID confiável permite consultar/recuperar o mesmo resultado sem gerar outra vez. |
| **Preflight** | Conferência dos arquivos, permissões e parâmetros **antes** de executar uma operação. |
| **SHA-256 / hash** | Impressão digital de um arquivo, usada para detectar alterações não previstas. |
| **Manifesto JSON** | Arquivo estruturado que descreve cenas, referências, mídias e a ordem da montagem. O agente pode prepará-lo para você. |
| **`RENDER_INPUTS.json`** | Documento que informa qual imagem ou vídeo local corresponde a cada plano aprovado. |
| **`final.mp4`** | Arquivo de vídeo resultante da renderização local. |
| **`QC_REPORT.json`** | Relatório de verificações técnicas de duração, formato e integridade; não analisa beleza ou fidelidade narrativa. |
| **`.studio/`** | Pasta privada do projeto que guarda histórias, estado e mídias. **Não apague sem backup.** |
| **`STUDIO_HOME`** | Configuração opcional que define em qual pasta o MCP guarda o estado. |
| **CLI / terminal** | Janela onde você copia comandos como `npm run doctor`. |
| **`main`** | Linha principal do código do projeto. Não é uma pasta de histórias. |
| **Versão editorial** | Identificador de uma proposta aprovada. Para mudar a história depois, crie nova revisão; não sobrescreva a versão anterior. |

## Diferença entre “planejou”, “gerou” e “finalizou”

1. **PLANEJADO:** existem descrições, prompts, storyboard e tarefas — **não necessariamente arquivos de imagem ou vídeo**.
2. **GERADO / BAIXADO:** existe um arquivo real, associado à operação que o produziu, com integridade confirmada. Ele ainda pode ser rejeitado pelo editor.
3. **PREVIEW_RENDERED:** o Media Composer criou um MP4 técnico local, que ainda precisa ser assistido e aprovado.
4. **ENTREGUE:** o vídeo completo passou pelas aprovações e verificações exigidas. Essa automação integral ainda é uma meta de produto, não uma capacidade homologada nesta versão.

Se tiver dúvidas, consulte [Problemas comuns](PROBLEMAS_COMUNS.md).
