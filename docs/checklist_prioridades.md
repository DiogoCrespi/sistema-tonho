# Checklist de Priorização de Funcionalidades e Requisitos (MVP & Pós-MVP)

Este documento consolidado apresenta todos os requisitos e funcionalidades identificados nas lacunas do **FitLife Sync** organizados em formato de lista de tarefas (checklist) com atribuição de nível de prioridade/necessidade de implementação técnica e de negócio, variando de **0 (Desejável/Pós-MVP)** a **10 (Crítico/Bloqueante)**.

---

## Legenda de Prioridades

*   **Nível 9 a 10 (Crítica / Bloqueante)**: Imperativos de segurança, persistência e o núcleo funcional básico de valor do produto. Sem estes, a plataforma não pode entrar em ambiente produtivo real.
*   **Nível 7 a 8 (Alta / Mandatória)**: Necessários para a robustez da operação comercial diária, integridade referencial dos dados e usabilidade básica.
*   **Nível 4 a 6 (Média / Importante)**: Funcionalidades que enriquecem o valor percebido do software, melhoram a produtividade dos personais ou simplificam fluxos operacionais pós-MVP.
*   **Nível 0 a 3 (Baixa / Desejável)**: Recursos voltados para automação secundária, integrações avançadas e extensibilidade a longo prazo.

---

## 1. Segurança, Acesso e Onboarding

*   [ ] **Proteção contra IDOR (Verificação de Vínculo)** `[Prioridade: 10/10]`
    *   *Descrição*: Middleware `validateStudentOwnership` para impedir que personais leiam/escrevam dados de alunos alheios.
*   [ ] **Onboarding de Alunos e Primeiro Acesso** `[Prioridade: 9/10]`
    *   *Descrição*: Fluxo de convites atômicos por e-mail e flag `must_change_password` para autodefinição da senha no primeiro login.
*   [ ] **Proteção contra CSRF Segregada** `[Prioridade: 9/10]`
    *   *Descrição*: Cookie seguro `SameSite=Strict` para a web e validação do token com dupla submissão ou cabeçalhos HTTPS dedicados para chamadas externas.
*   [ ] **Reset de Senha do Personal (Self-Service)** `[Prioridade: 8/10]`
    *   *Descrição*: Geração de hashes temporários de 15 minutos em banco de dados e envio de link por e-mail de recuperação.
*   [ ] **Rate Limit Combinado (IP + Conta)** `[Prioridade: 8/10]`
    *   *Descrição*: Limitação de requisições de login por IP e e-mail para mitigar brute force distribuído.
*   [ ] **Waivers, PAR-Q e Assinatura Eletrônica** `[Prioridade: 8/10]`
    *   *Descrição*: Questionário de aptidão física (PAR-Q) obrigatório e aceite de termos com log imutável de IP e data.
*   [ ] **Verificação de E-mail Cadastrado** `[Prioridade: 7/10]`
    *   *Descrição*: Envio de e-mail de validação antes de permitir recuperações de senha ou claim de convites.

## 2. Infraestrutura, Persistência e Deploy

*   [ ] **Persistência de Dados (Docker Volumes)** `[Prioridade: 10/10]`
    *   *Descrição*: Configuração e mapeamento de volumes persistidos (`sqlite_data` e `uploads_data`) no host do Docker Compose.
*   [ ] **Contenção de Escritas no SQLite (Locks)** `[Prioridade: 9/10]`
    *   *Descrição*: Ativação de `journal_mode = WAL` e `busy_timeout = 5000` nas conexões Knex para suportar o tráfego do chat e workers concorrentes.
*   [ ] **SQLite Safe Backups** `[Prioridade: 9/10]`
    *   *Descrição*: Integração de instrução SQL `VACUUM INTO` ou `.backup` na automação diária para evitar backups inconsistentes durante escritas ativas.
*   [ ] **Constraints e Índices de Banco** `[Prioridade: 9/10]`
    *   *Descrição*: Ativação de `foreign_keys = ON` e criação de chaves únicas/índices nos campos de busca frequentes (chats, treinos e sessões).
*   [ ] **Configuração de Proxy Nginx (HTTP 413)** `[Prioridade: 8/10]`
    *   *Descrição*: Configuração do `client_max_body_size 10M` para evitar falha no upload de fotos/demonstrativos maiores que 1 MB.
*   [ ] **Esgotamento de Conexões SSE (HTTP/2)** `[Prioridade: 8/10]`
    *   *Descrição*: Configuração de HTTP/2 no Nginx/Cloudflare para permitir multiplexação de conexões ativas de chat por domínio.
*   [ ] **Desligamento Gracioso (Graceful Shutdown)** `[Prioridade: 7/10]`
    *   *Descrição*: Processar sinais `SIGTERM` e `SIGINT` no Express para limpar clientes SSE ativos e encerrar conexões.

## 3. Desempenho e Experiência do Usuário (UX/UI)

*   [ ] **Fuso Horário Local (Timezones)** `[Prioridade: 9/10]`
    *   *Descrição*: Banco SQLite persistindo datas em padrão UTC estrito e frontend efetuando conversão na renderização com `Intl.DateTimeFormat`.
*   [ ] **Paginação de Chat e Virtualização de Exercícios** `[Prioridade: 8/10]`
    *   *Descrição*: Paginação baseada em cursor para conversas e *Virtual Scrolling* no catálogo de exercícios para evitar travamento do DOM (1.300+ itens).
*   [ ] **Limpeza de Arquivos Órfãos (fs.unlink)** `[Prioridade: 8/10]`
    *   *Descrição*: Exclusão física das mídias WebP salvas no disco rígido do container sempre que avatares forem editados ou exercícios deletados.
*   [ ] **Cache-Control e Cache Busting** `[Prioridade: 7/10]`
    *   *Descrição*: Adição de hash exclusivo nos nomes dos arquivos de bundle estáticos e header `no-cache` para o `index.html`.
*   [ ] **Controle de Concorrência de Edições (Optimistic Locking)** `[Prioridade: 7/10]`
    *   *Descrição*: Versionamento incremental com headers `If-Match` para retornar `409 Conflict` sob salvamentos simultâneos da mesma ficha por dois dispositivos.
*   [ ] **Periodização Avançada e Estimador 1-RM** `[Prioridade: 6/10]`
    *   *Descrição*: Definição de cadência (tempo sob tensão) e calculadora de 1-RM sugerindo progressão incremental segura de peso nas planilhas.

## 4. Lógica de Negócio, Resiliência e Operação

*   [ ] **Execução Real de Treino e Sessões (Histórico)** `[Prioridade: 10/10]`
    *   *Descrição*: Modelagem das tabelas `workout_sessions` e `exercise_logs` para gravação de cargas, séries, reps e RPE reais no backend.
*   [ ] **Gerenciamento de Chaves de Cadastro (CLI)** `[Prioridade: 10/10]`
    *   *Descrição*: Script CLI executável em produção (`access-key:create`/`list`/`revoke`) para permitir o onboarding de novos instrutores.
*   [ ] **Status da Ficha (Draft / Published / Archived)** `[Prioridade: 9/10]`
    *   *Descrição*: Controle de visibilidade de treinos no aluno e arquivamento automático de planilhas de treino obsoletas.
*   [ ] **Ciclo de Vida do Aluno e do Vínculo** `[Prioridade: 9/10]`
    *   *Descrição*: Segregar o status global da conta (`active`/`archived`) do vínculo profissional (`invited`/`active`/`paused`/`blocked`).
*   [ ] **Anamnese e Fichas Médicas (Assessments)** `[Prioridade: 9/10]`
    *   *Descrição*: Tabela `student_assessments` cobrindo objetivos, lesões e anotações privadas do personal trainers em oposição a observações compartilhadas.
*   [ ] **Aderência Semanal Analítica** `[Prioridade: 8/10]`
    *   *Descrição*: Painel de monitoramento calculando a taxa de comparecimento e ordenando o dashboard por maior tempo sem treinar.
*   [ ] **Internet Instável (Offline & Idempotência)** `[Prioridade: 8/10]`
    *   *Descrição*: Fila de ações no cliente (`IndexedDB`) e uso do cabeçalho `Idempotency-Key` com UUID nas chamadas mutáveis da API.
*   [ ] **Edição, Exclusão e Leitura de Mensagens** `[Prioridade: 8/10]`
    *   *Descrição*: Endpoints `PUT`/`DELETE` em mensagens de chat e rota dedicada `POST /api/chat/:userId/read` para marcação de visualização.
*   [ ] **Ciclo de Inativação e Abas de Filtragem** `[Prioridade: 8/10]`
    *   *Descrição*: Possibilidade de inativar alunos antigos sem deletar seu prontuário físico e separação por abas "Ativos" / "Inativos" na listagem.
*   [ ] **Cobranças Recorrentes e Isolamento Financeiro** `[Prioridade: 7/10]`
    *   *Descrição*: Tabela de assinaturas de personais e interceptor middleware retornando `402 Payment Required` para assinaturas expiradas.
*   [ ] **Gestão de Equipe e Hierarquias (Clínicas)** `[Prioridade: 6/10]`
    *   *Descrição*: Papéis coordenadores e juniores, compartilhamento de acervos institucionais e migrações em lote de carteiras de alunos.
*   [ ] **Indicador de "Digitando..." no Chat** `[Prioridade: 5/10]`
    *   *Descrição*: Envio de evento temporário via stream SSE com limitação de chamadas de input.
*   [ ] **Integração Multiprofissional (Parceiros Clínicos)** `[Prioridade: 5/10]`
    *   *Descrição*: Painéis de consulta read-only autorizados de exames e fichas para Nutricionistas, Fisioterapeutas e Médicos parceiros do aluno.
*   [ ] **Motores de Engajamento CRM** `[Prioridade: 5/10]`
    *   *Descrição*: Disparador automático de alertas ao personal de alunos ausentes a mais de 5 dias e pesquisas de NPS em marcos temporais.
*   [ ] **Integração Passiva com Wearables** `[Prioridade: 4/10]`
    *   *Descrição*: Conectores para Apple Health, Google Fit e Garmin para ingestão passiva de sono, HRV, passos e estimador de fadiga central.
*   [ ] **Agendamentos e Check-ins Geolocalizados** `[Prioridade: 4/10]`
    *   *Descrição*: Registro de presenças baseado em GPS ou Wi-Fi das academias parceiras e sincronização bidirecional de agendas.

## 5. Privacidade, LGPD e Observabilidade

*   [ ] **Conformidade LGPD e Termo de Consentimento** `[Prioridade: 9/10]`
    *   *Descrição*: Termos de consentimento explícitos, rotas para exportação de dados pessoais e funcionalidade de anonimização total pós-exclusão.
*   [ ] **Health Checks e Observabilidade** `[Prioridade: 8/10]`
    *   *Descrição*: Endpoints `/health/live` e `/health/ready` conectores de integridade e logs estruturados em JSON contendo `requestId`.
*   [ ] **Gerenciamento de Sessões por Dispositivo** `[Prioridade: 6/10]`
    *   *Descrição*: Tabela `user_sessions` para listar e revogar conexões de outros navegadores de forma isolada.
*   [ ] **Backoffice Operacional (Suporte e Impersonation)** `[Prioridade: 6/10]`
    *   *Descrição*: Modo de impersonation restrito a administradores com log de auditoria associado a tickets de suporte nível 3.

## 6. Compilação e Empacotamento Mobile (APK)

*   [ ] **Resolução Dinâmica da URL da API** `[Prioridade: 8/10]`
    *   *Descrição*: Frontend detectando a execução móvel (Capacitor) para prefixar chamadas com o domínio absoluto da API.
*   [ ] **CORS Configurado para WebView** `[Prioridade: 8/10]`
    *   *Descrição*: Whitelist do backend liberando requisições com origens `http://localhost` e `capacitor://localhost`.
*   [ ] **Armazenamento Seguro no Dispositivo** `[Prioridade: 7/10]`
    *   *Descrição*: Armazenamento criptografado nativo de chaves/JWT no Keystore/Keychain através do Capacitor Secure Storage.
*   [ ] **Compilação e Wrapper Híbrido (Capacitor)** `[Prioridade: 7/10]`
    *   *Descrição*: Instalação, configuração da plataforma Android e compilação do arquivo de release `.apk`.

---

## Planos de Ação e Etapas de Implementação Detalhadas

Esta seção desmembra exaustivamente cada um dos **42 requisitos e correções** mapeados em [funcionalidades_faltantes.md](file:///c:/Nestjs/sistema-tonho/docs/funcionalidades_faltantes.md) em etapas sequenciais e detalhadas de implementação.

---

### FASE 1: AMBIENTE, PERSISTÊNCIA E INFRAESTRUTURA (P0 - Prioridades 9 e 10)

#### 1. Mapeamento de Volumes Persistentes (Docker)
*   **Ação**: Impedir perda de dados no banco SQLite e imagens de avatar.
*   **Modificações**:
    *   No arquivo `docker-compose.yml`, configurar named volumes `sqlite_data` (mapeando `/app/data`) e `uploads_data` (mapeando `/usr/src/app/backend/uploads`) nos serviços `app` e `web`.
*   **Validação**: Executar `docker compose down && docker compose up -d` e verificar a persistência dos cadastros efetuados.

#### 2. Configurações de Concorrência SQLite (WAL e Busy Timeout)
*   **Ação**: Evitar erros `SQLITE_BUSY` durante concorrência de chat SSE e background workers.
*   **Modificações**:
    *   Injetar no `afterCreate` do `knexfile.js` a execução de:
        ```sql
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA foreign_keys = ON;
        ```
*   **Validação**: Rodar os testes de concorrência com requisições simuladas simultâneas.

#### 3. Rotina de Backup Seguro (SQLite VACUUM INTO)
*   **Ação**: Gerar backups consistentes sem corromper transações WAL ativas.
*   **Modificações**:
    *   Substituir a cópia física em `backend/src/scripts/dbBackup.js` por `knex.raw("VACUUM INTO '...' ")`.
    *   Definir limpeza automática baseada nas variáveis de ambiente `BACKUP_RETENTION` (limite de 7 snapshots).
*   **Validação**: Testar a integridade do arquivo gerado rodando `PRAGMA integrity_check;`.

#### 4. Constraints e Índices Relacionais
*   **Ação**: Otimizar queries e garantir integridade física.
*   **Modificações**:
    *   Criar migration adicionando constraints `UNIQUE` para `users.email` e chave composta para `personal_exercise_settings(personal_id, exercise_id)`.
    *   Criar índices em `chat_messages(sender_id, receiver_id, created_at)` e `workout_sessions(student_id, started_at)`.
*   **Validação**: Inspecionar o esquema do banco via terminal SQLite.

#### 5. Configuração de Upload Nginx (HTTP 413)
*   **Ação**: Permitir uploads de imagens de até 10 MB sem bloqueio do proxy.
*   **Modificações**:
    *   Adicionar a linha `client_max_body_size 10M;` nos blocos `http` ou `server` no [nginx.conf](file:///c:/Nestjs/sistema-tonho/nginx.conf).
*   **Validação**: Enviar imagem de 5 MB pela API e confirmar que o Nginx repassa a requisição retornando `200` ou `400` (e não `413`).

#### 6. Multiplexação HTTP/2 para SSE no Nginx
*   **Ação**: Evitar o limite de 6 conexões HTTP/1.1 concorrentes por domínio.
*   **Modificações**:
    *   Configurar a porta de escuta do Nginx para usar HTTP/2 (`listen 443 ssl http2;`).
*   **Validação**: Abrir 10 abas concorrentes do chat e validar que a décima aba conecta com sucesso.

#### 7. Desligamento Gracioso (Graceful Shutdown)
*   **Ação**: Evitar interrupções abruptas em sockets abertos de chat SSE durante deploys.
*   **Modificações**:
    *   Adicionar listeners em `backend/src/index.js` para `SIGTERM` e `SIGINT`.
    *   Percorrer o Map `activeClients` escrevendo a mensagem de encerramento amigável antes de encerrar o servidor http.
*   **Validação**: Disparar sinal `kill` e conferir se as instâncias limpam os sockets.

---

### FASE 2: SEGURANÇA, CONTROLE DE ACESSO E ONBOARDING (P0 - Prioridades 9 e 10)

#### 8. Middleware contra IDOR
*   **Ação**: Bloquear personais de acessar dados de alunos alheios.
*   **Modificações**:
    *   Criar middleware `validateStudentOwnership` validando o vínculo na tabela `student_profiles` cruzando o `personal_id` logado com o `student_id` do parâmetro da rota.
*   **Validação**: Teste de integração enviando requisição com credenciais do Personal A para aluno do Personal B, confirmando retorno `403 Forbidden`.

#### 9. Onboarding com Troca Obrigatória de Senha
*   **Ação**: Impedir que credenciais provisórias fiquem ativas permanentemente.
*   **Modificações**:
    *   Coluna `must_change_password` (default `TRUE`) na tabela `users`.
    *   Ao efetuar login, se a flag for true, o frontend exibe um modal forçando o cadastro de uma nova senha forte (mínimo 10 caracteres).
*   **Validação**: Logar com conta nova e verificar o bloqueio da tela até a troca de senha.

#### 10. Fluxo de Convites de Alunos
*   **Ação**: Evitar definição de senhas manuais pelo personal no cadastro de alunos.
*   **Modificações**:
    *   Tabela `student_invitations` armazenando `onboarding_token` (UUID hash).
    *   Ao cadastrar aluno, o personal envia um convite com o link do token por e-mail. O aluno acessa e autodefine suas credenciais.
*   **Validação**: Cadastro de aluno deve disparar e-mail com token válido por 24h.

#### 11. Rate Limit Combinado
*   **Ação**: Mitigar ataques de dicionário ou brute force contra credenciais.
*   **Modificações**:
    *   Integrar limitador Express Rate Limit combinando no cache o IP da requisição com o e-mail submetido no formulário de login.
*   **Validação**: Tentar logins repetidos falhos para a mesma conta de IPs diferentes.

#### 12. Verificação de E-mail
*   **Ação**: Validar a posse da conta cadastrada antes de liberar fluxos sensíveis.
*   **Modificações**:
    *   Gravação de token e data em `email_verified_at` na tabela `users`. Bloquear recuperação de senha para e-mails não validados.
*   **Validação**: Fluxo de reset deve exigir `email_verified_at IS NOT NULL`.

#### 13. PAR-Q e Assinatura Digital de Waivers
*   **Ação**: Garantir resguardo legal contra lesões desportivas.
*   **Modificações**:
    *   Interface no onboarding exigindo preenchimento de questionário PAR-Q e termos de isenção de responsabilidade.
    *   Gravação em banco do hash da assinatura, IP, e data/hora.
*   **Validação**: Bloquear acesso ao aplicativo do aluno se o PAR-Q não estiver assinado.

#### 14. Reset de Senha do Personal por E-mail
*   **Ação**: Permitir recuperação autônoma de acessos por instrutores.
*   **Modificações**:
    *   Tabela `password_reset_tokens` com hash criptográfico expirando em 15 minutos.
    *   Endpoints `/forgot-password` e `/reset-password` integrados com envio de e-mails transacionais.
*   **Validação**: Testar a redefinição gerando token, alterando a senha e logando com a nova credencial.

#### 15. Segregação de Autenticação Web vs Mobile (APK)
*   **Ação**: Evitar vazamentos de tokens e incompatibilidades de cookies em WebViews móveis.
*   **Modificações**:
    *   **Web**: Autenticação via cookies seguros `HttpOnly` com `SameSite=Strict`.
    *   **Mobile**: Token curto (Access Token) + Refresh Token rotacionado no cabeçalho `Authorization: Bearer` armazenados em secure storage nativo.
*   **Validação**: Testar requisições web com cookies e requisições mobile simuladas com bearer token.

---

### FASE 3: MECANISMO DE EXECUÇÃO DE TREINOS (P0 - Prioridades 9 e 10)

#### 16. Execução Real de Treino (Workout Sessions)
*   **Ação**: Persistir o histórico de execuções (cargas, séries, reps e RPE reais).
*   **Modificações**:
    *   Criação das tabelas `workout_sessions` (IDs, datas, status) e `exercise_logs` (vinculada à sessão, registrando carga real, concluído, séries, reps e percepção de esforço - RPE).
    *   Endpoints `/api/sessions/start`, `/api/sessions/:id/log` e `/api/sessions/:id/finish`.
*   **Validação**: Validar se os logs gravados no banco correspondem ao executado pelo aluno.

#### 17. Estados de Publicação da Ficha de Treino
*   **Ação**: Impedir visualização de treinos em rascunho.
*   **Modificações**:
    *   Adicionar coluna `status` (`'draft'`, `'published'`, `'archived'`) nas fichas.
    *   Ao publicar, as fichas anteriores do aluno mudam para `'archived'` automaticamente. Rota do aluno filtra apenas por `'published'`.
*   **Validação**: Testar se o aluno consegue ver uma ficha em rascunho (`draft`).

#### 18. Ciclo de Vida do Aluno e do Vínculo
*   **Ação**: Separar status da conta global do aluno de seu relacionamento com o Personal.
*   **Modificações**:
    *   Status do Vínculo: `invited`, `active`, `paused`, `blocked`.
    *   Status da Conta: `active`, `archived` (soft-delete).
    *   Se pausado, o aluno mantém apenas leitura ao histórico anterior.
*   **Validação**: Desvincular aluno e garantir que seu histórico de pesos e medições permaneça íntegro para visualização individual dele.

#### 19. Anamnese (Fichas Clínicas)
*   **Ação**: Mapear restrições, lesões e contraindicações de exercícios.
*   **Modificações**:
    *   Tabela `student_assessments` registrando nível de experiência, limitações e objetivos.
    *   Segregar o campo `personal_notes` (restrito ao personal) do `student_notes` (compartilhado).
*   **Validação**: Consultar anamnese pelo perfil do aluno e assegurar que as notas privadas do personal não sejam expostas.

#### 20. Chaves de Cadastro de Personais via CLI
*   **Ação**: Restringir novos cadastros de personais em produção sem expor painel público.
*   **Modificações**:
    *   Tabela `registration_keys`.
    *   Script CLI `backend/src/scripts/accessKey.js` para criar, listar e revogar chaves via terminal SSH.
*   **Validação**: Tentar cadastrar um personal sem chave válida e verificar se o backend recusa a inserção.

---

### FASE 4: UX/UI, DESEMPENHO E MENSAGERIA (P1 - Prioridades 7 e 8)

#### 21. Paginação por Cursor no Chat
*   **Ação**: Otimizar leitura de mensagens em históricos longos.
*   **Modificações**:
    *   Rota `/api/chat/:userId?before=<id>&limit=50`. O backend busca apenas registros com ID inferior ao cursor.
*   **Validação**: Rolar chat para cima e conferir requisições buscando blocos de forma incremental.

#### 22. Virtual Scrolling no Catálogo
*   **Ação**: Evitar lentidão do DOM no carregamento do catálogo de 1.300+ itens.
*   **Modificações**:
    *   Lógica no frontend para renderizar apenas cartões visíveis na viewport baseando-se no posicionamento de scroll.
*   **Validação**: Abrir o catálogo e monitorar quantidade de nós HTML ativos no inspetor de elementos.

#### 23. Timezones (Fuso Horário Local)
*   **Ação**: Evitar distorções de datas biométricas e treinos em servidores UTC.
*   **Modificações**:
    *   SQLite armazena strings ISO UTC (`Z`).
    *   Frontend converte datas usando a API nativa `Intl.DateTimeFormat` baseada no locale do navegador.
*   **Validação**: Alterar fuso do computador do aluno e testar o registro de medições às 23h.

#### 24. Limpeza de Mídias Órfãs (fs.unlink)
*   **Ação**: Evitar acúmulo de imagens/GIFs deletados no volume físico do Docker.
*   **Modificações**:
    *   Acoplar chamadas `fs.promises.unlink()` nos métodos `DELETE /api/catalog/exercises/:id` e na atualização de avatares de perfis.
*   **Validação**: Excluir exercício e verificar se o arquivo correspondente desaparece da pasta `/uploads`.

#### 25. Controle de Cache no Nginx e Cache-Busting
*   **Ação**: Impedir navegadores de usar arquivos estáticos obsoletos pós-deploys.
*   **Modificações**:
    *   Versão com hash no build de bundles CSS/JS e diretiva `Cache-Control: no-cache` no Nginx para o `index.html`.
*   **Validação**: Inspecionar os cabeçalhos de resposta HTTP do `index.html` em produção.

#### 26. Optimistic Locking para Edições
*   **Ação**: Evitar que dois profissionais sobrescrevam alterações da mesma ficha simultaneamente.
*   **Modificações**:
    *   Coluna `version` (INTEGER) nos treinos. Frontend envia header `If-Match: <versao>`. Se divergente, o Express retorna `409 Conflict`.
*   **Validação**: Simular duas requisições de alteração concorrentes com a mesma versão inicial.

#### 27. Edição, Exclusão e Leitura de Mensagens no Chat
*   **Ação**: Permitir correções de texto e controle de status de visualização.
*   **Modificações**:
    *   Rotas `PUT /api/chat/:messageId` e `DELETE /api/chat/:messageId`.
    *   Rota dedicada `POST /api/chat/:userId/read` para confirmar leitura de mensagens sem requisições de escrita em rotas de listagem.
*   **Validação**: Excluir mensagem no chat e verificar se a bolha de texto exibe *"Mensagem apagada"*.

#### 28. Indicador de "Digitando..." via SSE
*   **Ação**: Prover feedback tátil de presença.
*   **Modificações**:
    *   Rota rápida `POST /api/chat/typing` que emite evento efêmero via stream ativa de SSE (`event: typing`) para o destinatário por 3 segundos.
*   **Validação**: Digitar no chat e verificar o surgimento do indicador "..." na tela do destinatário.

#### 29. Inativação e Abas de Filtragem de Alunos
*   **Ação**: Otimizar a visualização inicial de alunos no dashboard do personal.
*   **Modificações**:
    *   Adicionar campo `status` (`'active'`, `'inactive'`) nos perfis de alunos e controle de abas de filtragem no frontend.
*   **Validação**: Inativar aluno e conferir que ele desaparece da aba padrão de alunos ativos.

#### 30. Central de Preferências de Notificações
*   **Ação**: Permitir ao usuário silenciar disparos indesejados.
*   **Modificações**:
    *   Tela de perfil com checkboxes de canais (E-mail, WhatsApp, Push) vinculados a eventos (novas mensagens, treinos).
*   **Validação**: Desmarcar notificações de chat e validar que o worker de envio ignora a conta.

---

### FASE 5: OBSERVABILIDADE, GOVERNANÇA E NEGÓCIO (P1 - Prioridades 7 e 8)

#### 31. Exportação e Anonimização de Dados (LGPD)
*   **Ação**: Atender direitos de portabilidade e eliminação garantidos pela lei.
*   **Modificações**:
    *   Rota `/api/compliance/export` (gera dump JSON dos dados do titular).
    *   Rota `/api/compliance/delete` (substitui nomes, e-mails e contatos por hashes anônimas, mantendo apenas métricas agregadas descaracterizadas).
*   **Validação**: Executar a anonimização e inspecionar a tabela `users` verificando ausência de dados pessoais identificáveis.

#### 32. Health Checks e Observabilidade
*   **Ação**: Monitorar a saúde física e conectividade em produção.
*   **Modificações**:
    *   Endpoints `/health/live` (saúde do container) e `/health/ready` (testa conexão ativa com SQLite e migrações aplicadas).
    *   Logs estruturados em JSON contendo identificadores únicos de requisição `requestId` e latência.
*   **Validação**: Chamar `/health/ready` e verificar se a resposta é `200 OK` contendo status do banco.

#### 33. Gerenciamento de Sessões por Dispositivo
*   **Ação**: Permitir ao usuário derrubar conexões suspeitas remotamente.
*   **Modificações**:
    *   Tabela `user_sessions` guardando `token_hash`, `user_agent`, `ip` e `revoked_at`. Middleware JWT consulta a tabela a cada requisição.
*   **Validação**: Encerrar sessão remota pelo painel e conferir se o outro navegador recebe `401 Unauthorized` no próximo clique.

#### 34. Backoffice e Impersonation de Suporte
*   **Ação**: Diagnosticar bugs sob o ponto de vista do usuário sem coletar senhas.
*   **Modificações**:
    *   Rota `/api/admin/impersonate/:userId`. Exige papel administrativo e gera log de auditoria imutável associado a um ticket do suporte nível 3.
*   **Validação**: Acessar o impersonation e verificar no banco a gravação do log registrando o administrador responsável e a justificativa.

#### 35. Assinaturas e Isolamento Financeiro (Tenant)
*   **Ação**: Bloquear acesso de personais inadimplentes e seus respectivos alunos.
*   **Modificações**:
    *   Tabela `subscriptions` registrando datas de vigência de planos.
    *   Middleware financeiro interceptando requisições dos personais e retornando `402 Payment Required` para assinaturas expiradas.
*   **Validação**: Expirar assinatura de teste de um personal e verificar se o aluno associado é bloqueado ao tentar ler treinos.

#### 36. Periodização Biomecânica e Calculadora de 1-RM
*   **Ação**: Prescrição periodizada científica e automações de carga.
*   **Modificações**:
    *   Cadastro de tempo de cadência excêntrica/isométrica/concêntrica nos exercícios.
    *   Cálculo de 1-RM estimado a partir de logs submetidos (`carga * (1 + reps/30)`).
*   **Validação**: Validar se a calculadora de 1-RM propõe cargas progressivas coerentes no próximo ciclo.

---

### FASE 6: INTEGRAÇÕES, AUTOMAÇÕES E MOBILE APK (P2 - Prioridades 4 a 6)

#### 37. Gestão de Equipes (Clínicas e Assessorias)
*   **Ação**: Suportar hierarquias multiníveis de instrutores e rateio de receitas.
*   **Modificações**:
    *   Hierarquia Head Trainer / Junior no banco de dados. Compartilhamento de bibliotecas de mídias de exercícios apenas para leitura.
    *   Integração de split de faturamento direto no gateway de pagamentos.
*   **Validação**: Testar a migração em lote de alunos entre personais juniores da mesma clínica.

#### 38. Acesso Multiprofissional (Parceiros Clínicos)
*   **Ação**: Permitir integração de nutricionistas e fisioterapeutas no acompanhamento.
*   **Modificações**:
    *   Perfis clínicos read-only. Upload de planos alimentares e laudos fisioterapêuticos integrados no prontuário do aluno.
*   **Validação**: Acessar o perfil nutricionista parceiro e validar o bloqueio contra edição de planilhas de exercícios físicos do personal.

#### 39. Integração Passiva com Wearables
*   **Ação**: Capturar dados biológicos objetivos para controle de cansaço e fadiga.
*   **Modificações**:
    *   Adaptadores assíncronos para Apple HealthKit, Google Fit e Garmin. Ingestão de HRV e sono para calibrar estresse basal.
*   **Validação**: Sincronizar dados simulados do HealthKit e verificar a gravação de fadiga na sessão do aluno.

#### 40. Alertas CRM de Ausência e Pesquisas NPS
*   **Ação**: Reduzir Churn de alunos e acompanhar satisfação.
*   **Modificações**:
    *   Rotinas diárias em background (Cron) disparando tarefas de resgate no painel do Personal se o aluno não treinar por 5 dias corridos.
    *   Disparos automáticos de pesquisas NPS no final de macrociclos de treinos concluídos.
*   **Validação**: Simular aluno inativo por 6 dias e validar geração de alerta na fila do personal.

#### 41. Agendamento de Aulas e Check-ins Geolocalizados
*   **Ação**: Evitar no-shows e agendar horários integrando agendas externas.
*   **Modificações**:
    *   Validação de presença via GPS ou roteadores Wi-Fi cadastrados da academia. Sincronização ICS com Google/Apple Calendar.
*   **Validação**: Testar check-in de aluno posicionado fora das coordenadas limites da academia (deve retornar erro de localização).

#### 42. Check-in de Prontidão Física Diária (Readiness)
*   **Ação**: Ajustar a intensidade com base na condição diária do aluno.
*   **Modificações**:
    *   Formulário rápido de prontidão física (escala 1 a 5 para fadiga, DOMS, sono e humor) exigido antes da inicialização do treino.
*   **Validação**: Responder com dor extrema e validar o alerta emitido no painel de acompanhamento do personal.

#### 43. Wrapper Híbrido Mobile APK (Capacitor)
*   **Ação**: Empacotar a aplicação Vanilla HTML/CSS/JS como APK nativo Android.
*   **Modificações**:
    *   CLI Capacitor (`npx cap init` e `npx cap add android`) mapeando a pasta `frontend`.
*   **Validação**: Compilar APK e rodar com sucesso no emulador Android.

#### 44. Resolução Dinâmica de Base URL da API
*   **Ação**: Permitir que requisições nativas localizem o servidor remoto de produção.
*   **Modificações**:
    *   Implementar script `apiConfig.js` que chaveia caminhos condicionais prefixando a URL absoluta do servidor em ambiente nativo.
*   **Validação**: Confirmar chamadas de login apontando para o servidor correto nas requisições do APK.

#### 45. Liberação de CORS Whitelist para WebViews
*   **Ação**: Evitar bloqueios do Express contra requisições móveis locais.
*   **Modificações**:
    *   Adicionar as origens `http://localhost` e `capacitor://localhost` nas regras de CORS da API.
*   **Validação**: Submeter login pelo emulador e verificar se a API aceita e responde a requisição.

#### 46. Armazenamento Seguro de Chaves (Secure Storage)
*   **Ação**: Proteger o token JWT contra vulnerabilidade física do dispositivo móvel.
*   **Modificações**:
    *   Em ambiente móvel, ler e salvar tokens JWT através do plugin `@capacitor-community/secure-storage` (Keystore/Keychain nativos) e trafegar via header `Authorization: Bearer`.
*   **Validação**: Fechar o app móvel, reabrir e verificar se a sessão permanece ativa via leitura do hardware seguro.
