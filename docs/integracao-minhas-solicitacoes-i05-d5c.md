# I05-D5C — filtro temporal e refinamento visual

Decisões de implementação do MVP, autorizadas nesta etapa pelo responsável.
Estas regras não foram confirmadas pelo professor. O Figma de Meus Agendamentos
não especifica filtro temporal; não tratar esta implementação como requisito
formal do professor.

Todos os períodos inclui solicitações sem horários. Próximos 7 dias inclui hoje
a hoje + 6; Próximos 30 dias inclui hoje a hoje + 29. Passados inclui datas
anteriores ao dia local, sem considerar como passados os horários encerrados
hoje. Período personalizado exige duas datas válidas e ordenadas, com limites
inclusivos. Erros são anunciados e ocultam os resultados, sem lista parcial.

A solicitação corresponde quando qualquer intervalo corresponde ao período.
Status E período são aplicados em conjunto. Todos os horários continuam no cartão;
uma solicitação com datas mistas pode aparecer em Passados e em períodos futuros.
A ordenação crescente/decrescente usa o primeiro intervalo cronológico que
corresponde ao período. Em Todos, usa o primeiro intervalo da solicitação.
Desempate por horário e ID, mantendo ID crescente nos empates nas duas direções.
Sem horários permanece ao final em ambas. Nenhuma coleção original é modificada.

Datas civis são comparadas como YYYY-MM-DD; soma de dias usa calendário local
ao meio-dia, sem UTC. A tela reutiliza o relógio local e recalcula quando muda
o dia, inclusive aberta ou ao retornar à janela. Filtros e ordenação atuam sobre
a lista já carregada e não alteram nem repetem o GET.

O cabeçalho Filtros alinha Atualizar à direita. O botão compacto mantém texto,
ícone SVG decorativo, área mínima de 44px e foco visível. Os controles de período,
ordenação e datas têm rótulos associados. CSS usa seletores exclusivos da agenda,
sem modificar .button global. Em telas pequenas os controles ficam em uma coluna.

A D5A/D5B é preservada. Sem mudanças em autenticação, painel gestor, backend,
banco ou POST de criação. Testes usam mocks; não executar escritas reais.

O teste de zoom CSS 200% em 768px identificou overflow na navegação do cabeçalho.
A correção de reflow é limitada ao wrapper .agenda-view: permite quebra do
cabeçalho e da navegação apenas nesta rota, sem alterar Cabecalho.tsx, login ou
painel gestor. Container query da agenda empilha controles e cartões quando a
largura disponível diminui sob ampliação, além dos breakpoints de viewport.

Validação concluída nesta etapa:
- npm.cmd test: 304 testes aprovados (220 unitários e 84 componentes).
- npm.cmd run typecheck e npm.cmd run build: aprovados.
- git diff --check: aprovado.
- npm.cmd run test:e2e -- --grep D5: cinco cenários D5B/D5C aprovados com
  API simulada e Chromium já instalado, sem instalação de dependências.
- Medidas reais de overflow do documento aprovadas em 320, 375, 393 e 768px;
  zoom CSS 200% a 768px também aprovado após o reflow local do cabeçalho.
- Teclado, foco visível, rótulos, erro personalizado, contagem, mudança do dia
  local e ausência de novo GET ao filtrar foram verificados.

As falhas de outros cenários E2E registradas na D5B não foram corrigidas nem
reexecutadas nesta etapa. Capturas da agenda ficam em test-results (ignorado
pelo Git). A validação com dados de homologação não foi executada nesta etapa.
