# Documentação — escolha seu caminho

Se você nunca usou MCP, **não comece por arquitetura, JSON ou documentação de provedores**. Use o primeiro grupo abaixo.

## Para quem quer criar vídeos (iniciante)

1. **[Comece aqui](COMECE_AQUI.md)** — instalar do zero em Windows/macOS/Linux, executar `doctor`, gerar um MP4 com `demo` e conectar um assistente.
2. **[Primeira história](PRIMEIRA_HISTORIA.md)** — colar uma história, orientar a IA, revisar o elenco e storyboard, aprovar e montar um animatic com suas imagens.
3. **[Problemas comuns](PROBLEMAS_COMUNS.md)** — erros de instalação, Windows PowerShell, FFmpeg, pastas de mídia, MCP e Google Flow.
4. **[Glossário](GLOSSARIO.md)** — conceitos sem jargão: MCP, shots, storyboard, renderização, hash, créditos e aprovação.
5. **[Google Flow opcional](GOOGLE_FLOW_OPCIONAL.md)** — o que funciona, o que ainda é experimental e quais riscos verificar antes de gastar créditos.

## Para quem já está produzindo

- [Jornada de produção](PRODUCT_JOURNEY.md) — etapas e decisões da história ao vídeo.
- [Media Composer](MEDIA_COMPOSER.md) — manifestos, duração, imagens, clipes, FFmpeg, áudio, legendas e QC técnico.
- [StageEngine](STAGE_ENGINE.md) — histórico, estados e recuperação entre sessões.
- [Biblioteca Visual](VISUAL_LIBRARY.md) — personagens, versões, referência aprovada e revisão por plano.
- [Google Flow → Media Composer](FLOW_TO_RENDER.md) — associar um clipe real já baixado ao plano correto.

## Para operadores avançados de Google Flow

- [Bridge F3](FLOW_LIVE_BRIDGE.md) — conta, capacidades, geração simples, reconciliação e limitações.
- [gflow-cli Frames/Ingredients](GFLOW_FRAMES.md) — pré-verificação de i2v/r2v sem execução paga.
- [Workflow Flow](FLOW_WORKFLOWS.md) — contratos de DAG e execução por etapa.
- [Segurança](SECURITY.md) — permissões, credenciais, crédito e limites de serviço.

## Para desenvolvedores e mantenedores

- [Plano de finalização](FINALIZATION_PLAN.md) — fases F0–F6 e gates de produto.
- [Matriz de aceite](ACCEPTANCE_MATRIX.md) — evidências exigidas para declarar funções concluídas.
- [Arquitetura-alvo](TARGET_ARCHITECTURE.md) — responsabilidades e migração incremental.
- [Arquitetura existente](ARCHITECTURE.md) e [contrato do adaptador](ADAPTER_CONTRACT.md).
- [Runbook de implementação](IMPLEMENTATION_RUNBOOK.md), [gaps](IMPLEMENTATION_GAPS.md) e [contribuições](../CONTRIBUTING.md).
- [Referências](REFERENCES.md), [roadmap histórico](ROADMAP.md) e [backlog histórico](BACKLOG.md).
- [Skill de direção audiovisual](../skills/visual-production-director/SKILL.md).
- [README técnico anterior (arquivado)](../README_TECNICO_ANTERIOR.md) — referência do texto antigo; consulte os guias atuais para o estado real.

**Fonte de verdade para status de funcionalidades:** [README atual](../README.md), [Matriz de aceite](ACCEPTANCE_MATRIX.md), testes e a implementação publicada na `main`. Documentos de roadmap anteriores podem conter contexto histórico e não substituem as evidências exigidas para homologação.
