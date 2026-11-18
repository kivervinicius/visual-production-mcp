# Google Flow — etapa opcional e experimental

**Leia antes de conectar sua conta.** Você não precisa do Flow para instalar, planejar, criar a primeira história ou renderizar um MP4 com imagens próprias. Consulte primeiro [Comece aqui](COMECE_AQUI.md) e [Primeira história](PRIMEIRA_HISTORIA.md).

## O que o Flow acrescenta

O Google Flow é um serviço externo que pode produzir imagens e vídeos usando modelos disponíveis na sua conta. O Visual Production MCP **não é um produto oficial Google**, não fornece créditos nem cria uma conta. Gerações podem consumir créditos e a disponibilidade de modelos, duração e modos varia por plano, região, versão da interface e condições de serviço.

| Componente | Situação no projeto atual |
| --- | --- |
| História, elenco, storyboard, aprovações e arquivo de tarefas | Implementados localmente |
| Inspecionar conta/modelos de um MCP Flow instalado e autorizado | Implementado no adaptador experimental, depende de conta real |
| Geração simples texto → imagem/vídeo (primeira bridge) | Código de integração disponível; **sem homologação live comprovada** |
| Pré-verificar frames e imagens de referência (`i2v`/`r2v`) | Implementado em modo **somente leitura** via contrato gflow-cli |
| Enviar automaticamente frames aprovados, obter custo real, gerar e importar todos os vídeos | **Pendente de homologação e integração paga** |
| Gerar o episódio inteiro sem intervenção e com entrega aprovada | **Não disponível ainda** |

**Não confunda a existência de uma ferramenta de MCP com uma geração realmente executada.** O projeto não declara um vídeo gerado sem job verificável e arquivo original validado.

## Regras de segurança e privacidade

1. Faça login **somente no navegador ou ferramenta oficial/compatível instalada por você**. Nunca envie senha, cookies, token ou códigos de verificação para o agente, GitHub ou um arquivo `.json` público.
2. Use uma conta que tenha acesso permitido ao Flow e confirme os termos aplicáveis. Não automatize CAPTCHA, restrições, contornos de limite ou rotação de contas para evadir bloqueios.
3. Antes de gerar, verifique **conta, projeto, modelo, proporção, duração e créditos** na interface real. O saldo e o orçamento cadastrados no MCP são **estimativas manuais**, não uma cotação ao vivo.
4. Aprovar o storyboard **não autoriza créditos**. Operações pagas exigem autorização própria do operador.
5. Se a resposta de uma geração for incerta, **não clique novamente nem repita a ferramenta paga**. Primeiro reconcilie o job com a conta/projeto corretos.
6. O projeto salva arquivos em `.studio/`. Revise o conteúdo antes de enviar pacotes a terceiros.

## Qual dos conectores existe hoje?

### A. `miyakejima/google-flow-mcp` — operações simples

O adaptador `src/providers/google-flow/miyakejima.mjs` trabalha com um MCP externo instalado e autenticado no computador do operador. Ele dispõe de inspeção da conta, geração simples a partir de texto, acompanhamento do mesmo job e download do original. Ele **não oferece garantia de que frames e referências foram associados ao modo correto**.

Leia o guia técnico [FLOW_LIVE_BRIDGE.md](FLOW_LIVE_BRIDGE.md). Siga apenas quando já estiver familiarizado com os conceitos de projeto, conta, modelo, job e créditos.

### B. `ffroliva/gflow-cli` — frames e ingredientes

O segundo caminho utiliza `gflow-cli` para reconhecer `mode=i2v`, `initial_frame`, `end_frame`, `mode=r2v` e `reference_images`. O comando disponível no Visual Production MCP **somente verifica e prepara** essas operações. Não envia nenhuma geração paga.

Leia [GFLOW_FRAMES.md](GFLOW_FRAMES.md) e a documentação do fornecedor em [github.com/ffroliva/gflow-cli](https://github.com/ffroliva/gflow-cli). Esse upstream é experimental, controla o navegador local e pode sofrer mudanças de interface. Antes de instalá-lo, confira o repositório, a licença, o histórico de manutenção e os riscos da sua conta.

## Procedimento seguro para operadores experientes

1. Instale um upstream Flow compatível pelo procedimento do respectivo projeto, **fora** deste repositório. Verifique quais comandos, modelos e autenticação a versão instalada realmente fornece.
2. Faça o login no upstream no seu próprio computador e confirme que a página é um workspace Flow válido, não a tela promocional.
3. Configure seu perfil em `.studio/` conforme [FLOW_LIVE_BRIDGE.md](FLOW_LIVE_BRIDGE.md) ou [GFLOW_FRAMES.md](GFLOW_FRAMES.md). Esses arquivos são privados; nunca versioná-los.
4. Execute apenas ferramentas de **inspeção sem custo** primeiro. No caso de frames, use `studio_gflow_frame_plan` ou o CLI abaixo, com ID de workflow e plano já existentes:

```bash
npm run operator -- flow-frame-plan <workflowId> <stepId>
npm run operator -- flow-frame-plan <workflowId> <stepId> --live
```

5. Leia os bloqueios do resultado, confira hashes e identidade da conta esperada. `--live` valida autenticação/schema **sem enviar geração**.
6. Para operações pagas simples suportadas pelo primeiro adaptador, siga o procedimento de aprovação humana, submissão única e recuperação do [guia F3](FLOW_LIVE_BRIDGE.md). Nunca extrapole essa cobertura para frames ou projetos nativos não homologados.
7. Para transferir um vídeo **já baixado e validado** ao editor local, consulte [FLOW_TO_RENDER.md](FLOW_TO_RENDER.md) (seleção explícita pelo operador).

## Quando posso esperar um vídeo gerado a partir de uma imagem?

Quando houver validação autenticada do upstream real, fixação das referências corretas, custo verificado, submissão única, reconciliação e download por ID. **Hoje, o pré-verificador de frames não executa esse passo pago.** O Media Composer continua útil com seus próprios arquivos de imagem/vídeo enquanto isso.

Se você é iniciante, pare aqui e use o [fluxo offline de primeira história](PRIMEIRA_HISTORIA.md) até se familiarizar com o produto.
