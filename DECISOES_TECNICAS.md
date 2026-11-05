# Decisões técnicas — LabAgenda

## 1. Contexto e estado atual

O LabAgenda permite consultar laboratórios e preparar uma solicitação demonstrativa. Este é o repositório independente do frontend; o backend FastAPI é mantido separadamente.

Estado de referência: branch `feature/frontend-laboratorios`, commit `e981794` (HEAD conferido nesta atualização). As Etapas 7.1 a 7.5, as Revisões R1, R2 e R3 e as Etapas 8.1, 8.2 e 8.3 estão concluídas e versionadas. A auditoria técnica e visual da Etapa 8.4 foi concluída, com Q01 e Q03 corrigidos e versionados e Q02 pendente de investigação. A integração com o backend ainda não foi iniciada: não há HTTP, autenticação, envio real, persistência, aprovação de solicitações ou confirmação de reservas neste módulo.

## 2. Stack e organização do repositório

React, TypeScript, Vite, React Router e CSS próprio, sem biblioteca adicional de interface.

| Caminho | Responsabilidade |
| --- | --- |
| `src/pages/` | Catálogo, detalhes do laboratório, calendário e detalhes da solicitação |
| `src/components/` | Cabeçalho e cartão do laboratório |
| `src/types/laboratorio.ts` | Modelo visual do laboratório |
| `src/data/` | Fixtures demonstrativas, regras de seleção e adaptador de payload |
| `src/styles/global.css` | Estilos compartilhados, estados e adaptações responsivas |
| `src/App.tsx` | Rotas e validação do formato do ID |
| `src/main.tsx` | Inicialização do React com StrictMode e BrowserRouter |
| `package.json` | Dependências e comandos disponíveis |

### Diretriz de design e implementação

O Figma permanece como referência principal de design e experiência do usuário. O contrato da API e as regras de negócio orientam as decisões funcionais; adaptações ao Figma são permitidas quando tecnicamente justificadas. As diferenças atuais não implicam refazer imediatamente as Etapas 7.1–7.5. As diferenças entre Figma e frontend exigem avaliação caso a caso, considerando as decisões da equipe e os contratos do backend, antes de alterações significativas.

As seis referências visuais estão disponíveis em `docs/figma/`, versionadas em `e99dd85`: `01-catalogo.png`, `02-detalhes-espaco.png`, `03-disponibilidade-e-horario.png`, `04-formulario-de-solicitacao.png`, `05-meus-agendamentos.png` e `06-motivo-de-recusa.png`. A disponibilidade dessas referências não autoriza mudanças automáticas na interface.

## 3. Rotas e fluxo de navegação

| Rota | Tela |
| --- | --- |
| `/` | Catálogo de laboratórios |
| `/laboratorios/:id` | Detalhes do laboratório |
| `/laboratorios/:id/agendamento` | Calendário e seleção de intervalo |
| `/laboratorios/:id/agendamento/detalhes` | Resumo, formulário de finalidade e prévia |
| `/meus-agendamentos` | Agendamentos demonstrativos; Etapa 8.2 versionada em `8d6c495`, com filtros e ordenação da Etapa 8.3 em `d55585a` |

Fluxo: catálogo → detalhes → calendário e horários → formulário → prévia. Formulário e prévia compartilham a última rota e alternam por estado React; não existe rota exclusiva da prévia.

IDs não numéricos e caminhos sem correspondência redirecionam ao catálogo. IDs numéricos inexistentes exibem mensagem e retorno seguro. Laboratórios indisponíveis continuam consultáveis, mas suas rotas de calendário e formulário exibem um bloqueio explicativo, inclusive em acesso direto.

## 4. Funcionalidades demonstrativas concluídas

- Catálogo com quatro laboratórios, pesquisa por nome sem distinção de caixa ou acentos, filtros combinados por bloco, capacidade, equipamento e tipo de uso, resumo geral e estado sem resultados.
- Detalhes com identificação, localização, capacidade, descrição, regras de uso, funcionamento e próximos horários demonstrativos compatíveis com o funcionamento cadastrado.
- Calendário mensal com navegação, legenda e estados de dia livre, ocupado, passado, sem dados e fim de semana.
- Seleção de início e término em slots de uma hora, bloqueio de lacunas e períodos ocupados, resumo e duração. Dois cliques no mesmo slot completam um intervalo de uma hora.
- Transporte da seleção para o resumo/formulário e retorno ao calendário pela ação “Alterar data e horário”.
- Formulário demonstrativo de finalidade com mensagens de validação e contador; prévia com laboratório, data, horários, duração e finalidade normalizada, além de “Voltar para editar”.
- Labels, mensagens associadas ao campo, indicadores de foco e foco no título ao alternar formulário/prévia. Data apresentada em pt-BR com inicial maiúscula e layouts adaptados a telas menores.

## 5. Estado, parâmetros e validações

O ID do laboratório fica no caminho. A seleção usa a URL como fonte, por meio de useSearchParams:

| Parâmetro | Formato e finalidade |
| --- | --- |
| `mes` | `YYYY-MM`; mês exibido e contexto de retorno |
| `data` | `YYYY-MM-DD`; data selecionada |
| `inicio` | `HH:mm`; início do intervalo |
| `fim` | `HH:mm`; término do intervalo |

`src/data/selecaoAgendamento.ts` centraliza leitura de data, validação da seleção e transporte desses quatro parâmetros. A navegação entre calendário e formulário preserva a seleção; atualizar a página permite reconstruí-la e revalidá-la. Mudar o mês preserva a seleção, mesmo que ela pertença a outro mês. Escolher outra data limpa início e término.

O calendário remove parâmetros inválidos com substituição da entrada do histórico. O destino valida a seleção e oferece retorno seguro quando ela está ausente ou inválida. `mes` é contexto de navegação: sua validade não faz parte da validação do intervalo no destino.

As telas verificam existência e disponibilidade do laboratório. Datas devem existir, não estar em dias anteriores ao atual e pertencer a dias livres da fixture. Fins de semana são bloqueados provisoriamente. Horas devem formar um intervalo positivo inteiramente coberto por slots livres e contíguos; a duração é calculada.

A finalidade é validada após trim: obrigatória, entre 3 e 255 caracteres. O campo limita o texto bruto a 255, enquanto o contador usa o texto trimado. O botão de revisão só é habilitado para dados válidos.

Finalidade, modo e dados da prévia ficam em memória no componente. “Voltar para editar” preserva a finalidade; atualizar a página ou sair para o calendário perde esse texto. A prévia não cria uma entrada própria no histórico do navegador. Não há rascunho persistente em armazenamento local.

## 6. Fixtures e limitações conhecidas

- `src/data/laboratorios.ts`: IDs e informações visuais fictícios; não comprovam correspondência com espaços reais.
- `src/data/detalhesLaboratorios.ts` e `src/data/horariosLaboratorios.ts`: descrição, regras e funcionamento ilustrativos, sem validação institucional.
- `src/data/proximosHorariosLivres.ts`: horários relativos ao dia atual, filtrados por dia ativo e início dentro da faixa de funcionamento. Grupos vazios são omitidos; laboratórios indisponíveis exibem mensagem em vez de horários.
- `src/data/calendarioDemonstrativo.ts`: números de dias reaproveitados mensalmente, com bloqueio provisório de fins de semana.
- `src/data/horariosAgendamentoDemonstrativos.ts`: slots gerados na carga a partir das primeiras datas elegíveis; há exemplos com horários livres, todos ocupados e sem slots.

As fontes dos detalhes e do calendário são distintas: próximos horários não garantem correspondência com os slots do calendário nem disponibilidade oficial. O funcionamento dos detalhes pode incluir sábado, enquanto o calendário o bloqueia provisoriamente. Nem todo dia marcado livre possui slots cadastrados.

Fixtures relativas e validações dependem do relógio local; um link pode deixar de ser válido com o passar dos dias. Horários já passados no dia atual ainda não são bloqueados. O filtro dos próximos horários não revalida a hora atual nem representa duração de reserva.

Os avisos demonstrativos devem permanecer. A Etapa 8.2 está concluída e versionada: “Agendamentos” permite navegação pelo cabeçalho; o perfil permanece ilustrativo e não há autenticação.

## 7. Adaptador e contrato de referência da API

`criarPayloadSolicitacao`, em `src/data/solicitacaoPayload.ts`, prepara dados locais para a prévia. Não executa HTTP nem persiste informações. Recebe uma seleção previamente validada, valida finalidade, ID inteiro positivo, existência da data e ordenação das horas, e produz:

| Campo | Valor preparado |
| --- | --- |
| `tipo` | `Espaço` |
| `id_espaco` | ID demonstrativo do laboratório |
| `finalidade` | Texto trimado |
| `horarios` | Um objeto com `data_reserva`, `hora_inicio` e `hora_fim` |

Datas usam `YYYY-MM-DD`; horas são normalizadas para `HH:mm`, sem conversões de fuso. O normalizador aceita segundos, mas os descarta; esse comportamento precisa de alinhamento antes de consumir horários com segundos. Não há seleção de múltiplos intervalos na interface.

Contrato de referência consultado no backend: `origin/dev`, commit `400e79e`. Não se trata de integração executada neste frontend. Para `POST /solicitacoes/`:

- Obrigatórios: `tipo` (`Espaço`, `Recurso` ou `Serviço`), `finalidade` de 3 a 255 caracteres, `id_espaco` positivo e existente e `horarios` com pelo menos um elemento.
- Cada horário exige `data_reserva`, `hora_inicio` e `hora_fim`, com fim posterior ao início. Horas são locais, sem deslocamento de fuso; datas passadas e início já passado no dia atual são rejeitados.
- Opcionais com padrão: `urgencia=false`, `id_projeto=null`, `ids_recursos=[]` e `ids_usuarios_envolvidos=[]`. Campos extras são proibidos. IDs opcionais informados passam por validações do backend.
- Criação exige usuário autenticado com perfil Servidor; solicitante vem da autenticação. A resposta de criação é 201, com solicitação Pendente, sem equivaler a reserva confirmada.

A referência também possui consultas de disponibilidade e agendamentos. A existência desses contratos não significa consumo pelo frontend. Sala, equipamentos, tipos de uso e tema do modelo visual não devem ser presumidos como campos equivalentes da resposta de espaço; o mapeamento exige alinhamento.

## 8. Correções das Revisões R1 e R3

### Revisão R1

- `disponivel=false` impede novas solicitações: ação substituída por explicação e proteção também no calendário e formulário acessados diretamente. A consulta dos detalhes permanece disponível.
- Próximos horários são ocultados para laboratórios indisponíveis e filtrados por funcionamento para os demais, sem modificar as fixtures.
- Seletores CSS alinhados aos estados `--livre`, `--ocupado` e `--passado`, com seus indicadores visuais.
- Foco visível restaurado na pesquisa por `:focus-within`, seguindo o padrão visual existente.

### Resultados da Revisão R3

Implementação conferida no commit `938bafe`:

- Contraste do dia selecionado preservado durante hover: o estilo de hover de dia livre exclui `--selected`, mantendo as cores existentes e o indicador de foco.
- “Limpar seleção” aparece imediatamente abaixo do resumo somente com intervalo válido, reutilizando o estilo secundário existente. Antes da seleção não aparece; com apenas início, permanece “Escolher outro horário inicial”.
- A limpeza remove `inicio`, `fim` e o marcador antigo `avancar`, preservando `data`, `mes` e o ID. Indicadores e resumo desaparecem, e o avanço fica desabilitado até uma nova seleção válida.
- Após a atualização dos parâmetros, refs e efeito React transferem o foco para o primeiro slot livre habilitado, sem selecioná-lo. A ação é um botão acionável por teclado.

As regras de continuidade, horários ocupados e intervalos de uma hora não foram alteradas. Build e verificação de whitespace foram aprovados durante a R3; isso não substitui testes no navegador.

## 9. Pendências e planejamento das próximas etapas

Próxima prioridade técnica: integração gradual frontend/backend, ainda não iniciada, antecipada em relação à Etapa 9 original. Trabalho previsto: obter IDs e catálogo reais; integrar usuário autenticado e autorização; consultar disponibilidade oficial; revalidar seleção e disponibilidade antes do envio; implementar criação, carregamento e tratamento de erros; distinguir solicitação Pendente de reserva confirmada. O servidor deve continuar sendo a autoridade das regras.

Decisões pendentes: alinhar autenticação, acesso ao usuário, armazenamento do token e componentes compartilhados com a equipe; mapear dados visuais para o contrato real e confirmar o tratamento de segundos. Refinamentos de UX e regras temporais estão centralizados na seção seguinte. A hospedagem deve oferecer fallback para as rotas do BrowserRouter.

### Situação das próximas etapas

Etapa 8 — Minha agenda / Meus agendamentos, com título de página Agendamentos:

| Subetapa | Situação conferida |
| --- | --- |
| 8.1 — Tipos e dados demonstrativos | Concluída e versionada em `a7ed68c`; tipos de resposta separados do payload de criação e coleção fictícia com seis status oficiais e múltiplos horários |
| 8.2 — Página e navegação | Concluída e versionada em `8d6c495`; seis solicitações demonstrativas, todos os intervalos e navegação pelo cabeçalho |
| 8.3 — Filtros e estados da interface | Concluída e versionada em `d55585a`; filtros por status, contagem, estado vazio e ordenação crescente pela data do primeiro horário |
| 8.4 — Qualidade e regressão | Auditoria técnica e visual concluída; Q01 e Q03 corrigidos e versionados; Q02 pendente de investigação |

Etapa 9 original — Apresentação do motivo de recusa: adiada para priorizar a integração frontend/backend, sem interface implementada. O contrato contém `decisao_justificativa`, usado para justificar decisões de aprovação e rejeição; sua apresentação deve respeitar o status e o significado do campo, sem tratar qualquer justificativa como motivo de recusa.

A integração real permanece pendente de implementação e testes com o backend. Solicitação Pendente não representa reserva confirmada; mesmo a apresentação de Aprovado não deve inventar dados de confirmação de reserva. Formulário demonstrativo e prévia já pertencem às Etapas 7.4 e 7.5.

### Encerramento da Etapa 8.4 — auditoria técnica e visual

A auditoria está concluída com as correções pontuais abaixo. O encerramento não significa ausência de pendências nem comprova integração com o backend.

| Achado | Conclusão e situação |
| --- | --- |
| Q01 — Contraste dos horários selecionados | Corrigido e versionado em `f20a5ad`; contraste validado visualmente e build aprovado no notebook |
| Q02 — Possível corte visual no catálogo mobile | Pendente de reprodução e investigação em 375px e 393px, sem causa confirmada. O diagnóstico final foi estático, sem reprodução visual ou medições reais. Distinguir overflow horizontal do documento, corte interno e efeito de zoom/simulação. Banner flex e controles são pontos de investigação, sem defeito comprovado; não aplicar `overflow-x: hidden` como solução genérica |
| Q03 — Indicador de foco do título da solicitação | Corrigido e versionado em `e981794`; troca de `.booking-request-preview h2:focus` por `.booking-day-panel #selection-title:focus`, preservando propriedades visuais e destino programático do foco. Entrada no formulário, avanço para a prévia e retorno para editar validados manualmente, conforme confirmação do responsável |

Q01 e Q03 se limitaram ao CSS. O build e `git diff --check` foram aprovados na correção Q03; não constituem testes automatizados de interface. Q02 permanece no acompanhamento de responsividade, sem impedir o encerramento documental da auditoria.

### Feedback da equipe: terminologia

Proposta de evolução ainda não implementada: substituir gradualmente a terminologia visível “Laboratórios” por “Espaços”, para abranger laboratórios, auditórios, salas e outros ambientes institucionais. O backend já utiliza o conceito de espaço. Revisar títulos, descrições, botões, navegação e mensagens após alinhar o alcance com a equipe. Isso não autoriza renomear automaticamente rotas, componentes, tipos ou contratos internos.

### Feedback da equipe: integração e planejamento temporal

Prioridade técnica: antecipar a integração gradual frontend/backend para identificar incompatibilidades reais. Avaliar autenticação JWT, permissões, disponibilidade, consultas, criação de solicitações, tratamento de erros e CORS. Substituir mocks por chamadas HTTP, isoladamente, não resolve essas dependências; a integração deve ocorrer em incrementos pequenos e verificáveis.

Preservar a versão demonstrativa estável para a apresentação ao professor em **06/11/2026**, sem iniciar mudanças de integração às pressas antes dela. Após a apresentação, reavaliar com a equipe a ordem das próximas etapas e os incrementos de integração. **08/11/2026 é uma meta desejada de avanço, não um prazo garantido para concluir todas as etapas e a integração.**

### Melhorias e refinamentos pendentes

As prioridades de refinamento abaixo são sugestões de planejamento; a integração como próxima prioridade e o adiamento da Etapa 9 original estão registrados acima. A tabela centraliza o acompanhamento das limitações e melhorias restantes.

| Melhoria | Problema ou motivação | Prioridade sugerida | Situação atual e dependências |
| --- | --- | --- | --- |
| Contador da finalidade | Texto bruto pode atingir o limite antes do contador trimado | Média | Divergência permanece; alinhar critério de contagem e limite sem perder a validação da finalidade |
| UX de intervalo de uma hora | Dois cliques no mesmo slot e rótulo de término podem não ser intuitivos | Média | Funciona; “Limpar seleção” não muda essa interação. Avaliar orientação e rótulos preservando a regra |
| Acessibilidade | Refinar identificação das regiões, indicação da página atual e cobertura de teclado e leitor de tela | Média | Q03 corrigido em `e981794` e validado manualmente; ampliar verificações com teclado e leitor de tela, inclusive `aria-labelledby` do calendário e `aria-current` do cabeçalho |
| Persistência da finalidade | Evitar perda de texto ao atualizar ou retornar ao calendário | Média | Somente memória; permanece entre formulário e prévia. Decidir política, duração e mecanismo de rascunho com a equipe |
| Horários passados no dia atual | Evitar apresentar ou aceitar inícios que o backend rejeitaria | Alta antes do envio real | Ainda permitidos no protótipo; alinhar fuso, relógio de referência e revalidação no envio |
| Funcionamento e calendário | Evitar divergências entre fontes de disponibilidade | Alta antes da integração | R1 filtra próximos horários, mas calendário usa fixture independente e bloqueia fins de semana provisoriamente; confirmar regras oficiais e fonte de dados |
| Responsividade e zoom | Detectar transbordamento, contraste e perda de controles | Alta para investigação | Auditoria 8.4 concluída; Q01 validado visualmente e Q03 validado manualmente. Q02 permanece sem reprodução e causa confirmada; medir em 375px e 393px e ampliar cobertura de zoom, hover e foco |
| Testes automatizados | Proteger seleção, limpeza, navegação e validações contra regressões | Média; priorizar antes de ampliar a integração | Não há suíte versionada; definir ferramenta e cenários. Build e verificações em memória não equivalem a testes de interface |
| Transição global | Padronizar mudanças de página se houver benefício de UX | Baixa | Proposta não aprovada nem implementada; depende de avaliação e alinhamento com o grupo. Efeitos CSS atuais são locais |

## 10. Comandos disponíveis e limites da validação

Comandos definidos em `package.json`, executados na raiz:

- `npm.cmd run dev`: servidor de desenvolvimento Vite.
- `npm.cmd run build`: verificação TypeScript e geração do build Vite.
- `npm.cmd run preview`: pré-visualização do build existente.
- `git diff --check`: verificação de problemas de whitespace no diff.

Não há suíte ou script de testes automatizados no repositório. Build aprovado não comprova navegação, responsividade, acessibilidade, contratos em execução ou integração. Verificações pontuais anteriores em memória não constituem suíte versionada.

A validação manual deve cobrir fluxo até a prévia, edição, retorno e atualização, seleção de uma hora, limpeza de intervalo com preservação da data e foco, contraste no hover, bloqueios, URLs inválidas, laboratório indisponível, dias fechados, foco por teclado e telas pequenas. Esta revisão documental não executa build nem altera código.

## 11. Histórico técnico resumido

Marcos comprovados no histórico atual:

| Commit | Marco |
| --- | --- |
| `05a8fb1` | Catálogo inicial |
| `270b419` | Navegação com React Router |
| `dd3d5c7` | Registro inicial das decisões técnicas |
| `ed01dc9` | Validação do laboratório na tela de detalhes |
| `ef8f349` / `c45b813` | Identificação visual, descrição e regras dos detalhes |
| `7928a87` / `bb5c47f` | Funcionamento e próximos horários demonstrativos |
| `03f8a30` | Navegação para solicitação de agendamento |
| `a17398c` | Calendário demonstrativo — Etapa 7.1 |
| `dd0b6b9` | Seleção demonstrativa de horários — Etapa 7.2 |
| `3704bf9` | Transporte e detalhes do agendamento — Etapa 7.3 |
| `e50c512` | Formulário demonstrativo — Etapa 7.4 |
| `3ebee19` | Prévia da solicitação — Etapa 7.5 |
| `42d2e48` | Disponibilidade, coerência dos próximos horários e acessibilidade — R1 |
| `b20ce34` | Atualização das decisões técnicas e estado do projeto — R2 |
| `938bafe` | Limpeza da seleção de horários, foco após limpar e contraste do calendário — R3 |
| `a7ed68c` | Tipos e dados demonstrativos de solicitações — Etapa 8.1 |
| `8d6c495` | Página e navegação de Agendamentos — Etapa 8.2 |
| `c95ef7c` | Decisões técnicas e planejamento das próximas etapas |
| `d55585a` | Filtros e ordenação de solicitações — Etapa 8.3 |
| `e99dd85` | Seis referências visuais do Figma |
| `f20a5ad` | Contraste dos horários selecionados — Q01 da Etapa 8.4 |
| `e981794` | Padronização do indicador de foco do título — Q03 da Etapa 8.4 |
