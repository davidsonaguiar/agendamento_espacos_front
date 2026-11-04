# Módulo 1 — Login, autenticação e sessão

Branch: `feature/frontend-login`.

## Telas e fluxos

- `/login`: login com e-mail ou CPF e senha, via `POST /usuarios/login`.
- `/cadastro`: cadastro público **exclusivamente de servidor**, via `POST /usuarios/servidor`. A API `dev` não oferece cadastro público de Aluno, Monitor, Coordenador e Administrador.
- `/recuperar-senha`: orientação para procurar a coordenação. **Não há endpoint de recuperação de senha na API dev**; esta página não envia e-mails nem altera senhas.
- Páginas de laboratório e agendamento: protegidas pela validação `GET /usuarios/me`, usando token Bearer.
- Token JWT expirado ou rejeitado (401/403) termina a sessão e leva o usuário para `/login`. Erros temporários de rede exibem a opção de tentar novamente, sem apagar imediatamente o token.

## Executar

1. `npm ci`
2. `npm run build`
3. `node --test tests/autenticacao.test.mjs`
4. Configure `.env` usando `VITE_API_URL=http://localhost:8000`.
5. Inicie o backend FastAPI da branch `dev` do repositório `davidsonaguiar/agendamento_espacos` com banco e variáveis de ambiente configurados.
6. `npm run dev`; visite `http://localhost:5173/login`.

## Testes manuais com API real antes do merge

- Com usuário real válido: autenticar, abrir o catálogo e recarregar a página.
- Com senha incorreta: observar mensagem de erro, sem acesso ao catálogo.
- Sem token: abrir `http://localhost:5173/` diretamente; deve redirecionar a `/login`.
- JWT inválido/expirado: tentar `/` e verificar redirecionamento para `/login`.
- Cadastro: testar criação de um **servidor** com SIAPE e CPF de teste autorizados; confirmar conflito (409) para duplicidade.
- Backend fora do ar: acesso mostra erro de conexão/"Tentar novamente", sem simular login.
- Recuperação de senha: deve exibir explicação de indisponibilidade, sem prometer um envio.
- Abrir a página em uma janela estreita para validar o layout responsivo.

## Limitações técnicas

A navegação é protegida no React para experiência de uso; autorização e segurança de acesso a dados devem ser aplicadas pelas rotas do backend. O token é mantido em `sessionStorage` durante a aba atual. Não existe implementação de recuperação automática de senha sem contrato de API. Os testes automatizados isolam o serviço HTTP com mocks; **não substituem testes ponta a ponta com o backend e banco operantes**.
