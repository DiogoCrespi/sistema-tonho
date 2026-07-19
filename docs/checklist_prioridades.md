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

Esta seção detalha o plano de execução para cada grupo de prioridades, divididos por fases técnicas de desenvolvimento, incluindo modificações de banco de dados, assinaturas de rotas de API, código e testes recomendados.

---

### FASE 1: HARDENING DE SEGURANÇA E ACESSO (P0 - Prioridades 9 e 10)

#### Bloco A: IDOR & Validação de Vínculo de Alunos
*   **Problema**: Personais conseguem acessar dados de alunos de outros personais manipulando o `:id` do aluno nas URLs da API.
*   **Etapas de Implementação**:
    1.  **Criar Middleware de Vínculo**: Escrever `validateStudentOwnership` em `backend/src/middleware/validateStudentOwnership.js`.
    2.  **Consulta SQL no Middleware**: O middleware intercepta a rota, lê o `student_id` do parâmetro da rota (ou do payload JSON) e o `personal_id` da sessão JWT. Consulta a tabela `student_profiles` verificando se o vínculo confere e se o status do vínculo não é `blocked`.
    3.  **Bloqueio Criptográfico**: Se não houver relacionamento ativo, aborta a requisição com `403 Forbidden` e registra um log de segurança na auditoria.
    4.  **Acoplamento**: Integrar o middleware nas rotas Express de treinos, medições, chat e anamnese.
*   **Validação/Testes**:
    *   *Teste de Integração*: Simular requisição do Personal A tentando obter a lista de treinos de um Aluno vinculado ao Personal B. Assertiva: Status da resposta deve ser `403`.

#### Bloco B: Onboarding de Alunos e Primeiro Acesso Seguro
*   **Problema**: Personais definem senhas de alunos de forma rudimentar, e não há troca obrigatória de credenciais temporárias.
*   **Etapas de Implementação**:
    1.  **Migração de Coluna**: Adicionar a coluna `must_change_password` (BOOLEAN, default TRUE) na tabela `users`.
    2.  **Tabela de Convites**: Criar a tabela `student_invitations` com colunas `id`, `email`, `personal_id`, `onboarding_token` (UUID hash), `expires_at` e `claimed_at`.
    3.  **Endpoint de Criação**: Substituir a rota `/api/personal/students` (que criava o aluno com senha estática) para gerar o token e enviar um convite transacional (SMTP/Resend) apontando para `#/onboarding?token=UUID`.
    4.  **Tela de Troca de Senha**: No login, se o backend retornar `must_change_password: true`, o frontend redireciona o fluxo para um modal bloqueante forçando o cadastramento de uma senha definitiva (mínimo 10 caracteres).
*   **Validação/Testes**:
    *   *Teste de Integração*: Tentar logar com credencial provisória. Confirmar se a propriedade `must_change_password` é retornada no JSON.

#### Bloco C: Persistência de Dados e Volumes Docker
*   **Problema**: Containers Docker são efêmeros; comandos de desligamento destróem a base física de dados e avatares carregados.
*   **Etapas de Implementação**:
    1.  **Ajuste de Paths**: Verificar no `backend/src/index.js` se os caminhos de uploads e banco de dados buscam variáveis de ambiente (ex: `DATABASE_PATH=/app/data/database.sqlite` e `UPLOADS_PATH=/app/uploads`).
    2.  **Configuração de Volumes**: No arquivo [docker-compose.yml](file:///c:/Nestjs/sistema-tonho/docker-compose.yml), declarar os volumes persistentes:
        ```yaml
        services:
          app:
            volumes:
              - sqlite_data:/app/data
              - uploads_data:/app/uploads
        volumes:
          sqlite_data:
          uploads_data:
        ```
    3.  **Permissões de Acesso**: Assegurar no `Dockerfile` que o comando `chown -R node:node /app` dê permissões de leitura/escrita para a execução em modo não-root.
*   **Validação/Testes**:
    *   *Teste de Resiliência*: Subir o ambiente, cadastrar um aluno, rodar `docker compose down`, reiniciar os containers com `docker compose up -d` e validar se o registro persiste.

#### Bloco D: Chaves de Cadastro CLI e Controle de Adesão
*   **Problema**: Cadastros de novos Personais na rota `/api/auth/register` necessitam de proteção por chaves convite controladas para limitar o acesso a usuários pagantes.
*   **Etapas de Implementação**:
    1.  **Tabela de Chaves**: Criar a tabela `registration_keys` no banco de dados (`key_hash`, `personal_id_claimed`, `expires_at`, `claimed_at`, `max_uses`, `uses_count`).
    2.  **Scripts CLI**: Escrever arquivos na pasta `backend/src/scripts/accessKey.js`:
        *   `access-key:create --uses=1 --expiry=30d` (Gera string randômica de chave e guarda o hash no SQLite).
        *   `access-key:list` (Exibe tabela com status das chaves).
        *   `access-key:revoke --key=<token>` (Inativa o token).
    3.  **Middleware de Validação**: Na rota `POST /api/auth/register`, exigir o campo `registrationKey`. O backend valida a vigência e incrementa o uso na tabela antes de criar o usuário.
*   **Validação/Testes**:
    *   *Teste E2E*: Cadastrar um Personal com chave inexistente ou já esgotada. Assertiva: Retorno `400 Bad Request`.

---

### FASE 2: CORE DE EXECUÇÃO E PERSISTÊNCIA DE DADOS (P0 - Prioridades 9 e 10)

#### Bloco E: Execução Real de Treino (Workout Sessions & Logs)
*   **Problema**: Marcação de conclusão é guardada apenas no `localStorage` do aluno, omitindo cargas, séries e repetições executadas do Personal Trainer.
*   **Etapas de Implementação**:
    1.  **Criação de Migration**: Criar tabelas `workout_sessions` e `exercise_logs` mapeando o histórico transacional da sessão.
    2.  **Endpoints da API**:
        *   `POST /api/sessions/start` -> Inicia sessão. Cria registro `workout_sessions` com status `started` e retorna o ID da sessão.
        *   `POST /api/sessions/:sessionId/log` -> Recebe dados de execução de uma série específica do exercício (carga real, repetições, concluído, RPE e observações) e grava no `exercise_logs`.
        *   `POST /api/sessions/:sessionId/finish` -> Altera o status da sessão para `completed` e calcula a duração total em segundos.
    3.  **Modificação no Frontend do Aluno**: Na tela de execução móvel, substituir a manipulação de `localStorage` para disparar as chamadas à API em tempo de execução.
*   **Validação/Testes**:
    *   *Teste de Integração*: Simular a sequência de requisições de início de treino, logs de dois exercícios, e encerramento de sessão, validando se os registros de progresso aparecem corretos no banco.

#### Bloco F: Estados de Publicação da Ficha de Treino
*   **Problema**: Fichas em elaboração ficam imediatamente visíveis aos alunos, poluindo a visualização e gerando erros.
*   **Etapas de Implementação**:
    1.  **Adicionar Campo de Status**: Coluna `status` (VARCHAR: `'draft'`, `'published'`, `'archived'`) na tabela `workouts`.
    2.  **Controle de Leitura do Aluno**: Na rota `GET /api/workouts`, filtrar para retornar apenas os treinos do aluno cujo status seja `'published'`.
    3.  **Processo de Publicação**: No painel do Personal, ao acionar o botão "Publicar Ficha", a API executa uma transação:
        *   Muda status da ficha atual para `'published'`.
        *   Muda status das fichas de treino antigas do mesmo aluno de `'published'` para `'archived'`.
*   **Validação/Testes**:
    *   *Teste de API*: Validar se a rota do aluno omite fichas marcadas como `'draft'`.

#### Bloco G: Contenção de escrita e Safe Backups
*   **Problema**: Copiar fisicamente o arquivo SQLite enquanto conexões de chat SSE geram transações causa backups corrompidos.
*   **Etapas de Implementação**:
    1.  **Refatoração do script de backup**: Editar o script `backend/src/scripts/dbBackup.js`. Substituir a cópia física direta (`fs.copyFile`) pela execução segura da query nativa `VACUUM INTO 'caminho/do/backup.sqlite'` do SQLite, chamando a transação atômica pelo Knex.
    2.  **Configuração de Retenção no Worker**: Mapear a leitura da variável `BACKUP_RETENTION` para garantir que apenas os 7 backups mais recentes automáticos permaneçam no volume `/app/data/backups/`.
*   **Validação/Testes**:
    *   *Teste Automatizado*: Rodar `npm run db:backup` e verificar se a integridade do arquivo gerado passa na validação `PRAGMA integrity_check;`.

---

### FASE 3: UX/UI E PRODUTIVIDADE OPERACIONAL (P1 - Prioridades 7 e 8)

#### Bloco H: Paginação e Virtual Scrolling
*   **Etapas de Implementação**:
    1.  **Paginação de Chat**: Rota `GET /api/chat/:userId` recebe os query parameters `before` (ID da última mensagem no client) e `limit` (default 50). O Knex realiza a busca filtrando com `WHERE id < before ORDER BY id DESC LIMIT 50`.
    2.  **Virtual Scrolling no Catálogo**: No arquivo [frontend/js/catalog.js](file:///c:/Nestjs/sistema-tonho/frontend/js/catalog.js), implementar listener de scroll no contêiner. Calcular a altura dos elementos e renderizar dinamicamente apenas os cartões que cruzam a viewport visible mais um buffer de segurança, evitando sobrecarga do navegador.

#### Bloco I: Timezones e Fuso Horário Local
*   **Etapas de Implementação**:
    1.  **Escrita Estrita UTC**: Certificar que o Knex salve todas as instâncias de `CURRENT_TIMESTAMP` ou `new Date()` como strings ISO UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
    2.  **Tratamento no Frontend**: No arquivo de utilitários do cliente (`frontend/js/utils.js`), escrever a função `formatToLocalDate(utcString)` que parseia a string UTC e retorna o padrão regional usando `Intl.DateTimeFormat(navigator.language, { dateStyle: 'short', timeStyle: 'short' })`.

#### Bloco J: Limpeza de Mídias e fs.unlink
*   **Etapas de Implementação**:
    1.  **Eventos de Exclusão**: No controller de catálogos e uploads, interceptar requisições de exclusão física ou substituição de imagens de exercícios e avatares.
    2.  **Varredura Física**: Ler o path do arquivo gravado no banco de dados e acionar a biblioteca nativa `fs.promises.unlink(filePath)` dentro de um bloco try-catch. Se o arquivo físico não for encontrado (ex: erro `ENOENT`), prosseguir com o delete do banco sem travar a requisição.

---

### FASE 4: COMPILAÇÃO E DISTRIBUIÇÃO MOBILE APK (P1 - Prioridades 7 e 8)

#### Bloco L: Capacitor Wrapper e URLs Dinâmicas
*   **Etapas de Implementação**:
    1.  **Instalação**: Executar `npm install @capacitor/core @capacitor/cli` na raiz e configurar o projeto com `npx cap init`. Definir `--web-dir=frontend`.
    2.  **API URL Resolver**: Criar um arquivo `frontend/js/apiConfig.js` que exporta a URL base da API:
        ```javascript
        export const API_BASE_URL = window.Capacitor 
          ? "https://tonho.personaltonho.online/api" 
          : "/api";
        ```
    3.  **Adicionar Plataforma**: Instalar e acionar plataforma Android (`npm install @capacitor/android && npx cap add android`).
    4.  **Compilação**: Rodar `npx cap sync` para transferir os códigos HTML/CSS/JS locais do frontend para a pasta do Gradle. Abrir em Android Studio e compilar o APK via menu *Build > Build Bundle(s) / APK(s) > Build APK(s)*.

#### Bloco M: CORS para WebViews e Secure Storage
*   **Etapas de Implementação**:
    1.  **Whitelisting CORS**: No arquivo de segurança HTTP da API Express, liberar a aceitação de cabeçalhos de origem vindos do emulador/dispositivo nativo: `http://localhost` e `capacitor://localhost`.
    2.  **Segregação de Sessão**: Se rodando nativamente no app, substituir a leitura/gravação de tokens JWT de cookies HTTP-Only para cabeçalhos HTTP explicitamente setados (`Authorization: Bearer <token>`). O token é gravado e obtido de forma criptografada usando o plugin `@capacitor-community/secure-storage` para impedir acessos ao Keychain local do Android/iOS.

