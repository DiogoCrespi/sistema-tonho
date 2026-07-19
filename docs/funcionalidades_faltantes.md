# Funcionalidades Faltantes, Lacunas de Segurança e Roadmap Pós-MVP

Este documento detalha as lacunas identificadas no ciclo de uso, consistência de dados, segurança, arquitetura do banco e operação do **FitLife Sync**, propondo as ações e modelagens necessárias para a evolução do sistema de protótipo acadêmico para uma plataforma comercial estável e resiliente.

---

## 1. Falhas Críticas de Segurança e Acesso

### 1.1. Proteção Adicional contra CSRF (Cross-Site Request Forgery)
*   **Problema**: A autenticação via cookies `HttpOnly` com `SameSite=Strict` protege contra XSS. Contudo, como a API e o Nginx rodam sob o mesmo domínio, o sistema pode estar vulnerável a CSRF sob configurações específicas de proxy ou em navegadores legados que não suportam ou falham na política `SameSite`.
*   **Requisitos**:
    1.  **Double Submit Cookie**: O frontend deve ler um cookie não-HttpOnly (ex: `XSRF-TOKEN`) gerado no login e enviá-lo como um cabeçalho HTTP (`X-XSRF-TOKEN`) em toda requisição mutável (`POST`, `PUT`, `DELETE`).
    2.  **Validação Backend**: O backend deve interceptar a requisição e validar se o cabeçalho bate com o cookie da requisição. Alternativamente, deve-se validar rigidamente os cabeçalhos `Origin` e `Referer` no Express.

### 1.2. Recuperação de Senha do Personal Trainer (Self-Service Reset)
*   **Problema**: O Personal Trainer pode redefinir a senha de qualquer aluno vinculado, mas se o próprio Personal esquecer sua senha, não há fluxo autônomo de recuperação. Ele perde o acesso ao sistema, aos alunos e ao seu faturamento (ponto único de falha).
*   **Requisitos**:
    1.  **Tokens Temporários**: Tabela no banco de dados para armazenar hashes de tokens temporários (`password_reset_tokens`) com tempo de vida curto (ex: 15 minutos).
    2.  **Endpoints**:
        *   `POST /api/auth/forgot-password` - Valida o e-mail, gera o token criptográfico e despacha um e-mail transacional.
        *   `POST /api/auth/reset-password` - Recebe o token, verifica a expiração e atualiza a hash de senha na tabela `users`.
    3.  **Integração de E-mail**: Uso de Nodemailer integrado a um serviço de envio (ex: Resend, SendGrid ou Amazon SES).

### 1.3. Onboarding de Alunos e Senhas Provisórias
*   **Problema**: O Personal Trainer define a senha provisória do aluno e precisa repassá-la por canais externos. O Personal conhece a senha ativa do aluno e não há validação ou troca obrigatória no primeiro acesso.
*   **Requisitos**:
    1.  Adicionar flag `must_change_password` (BOOLEAN) na tabela `users`. No primeiro login do aluno, o frontend bloqueia a navegação e força a criação de uma nova senha pessoal.
    2.  Alternativamente, o Personal cadastra apenas nome/e-mail do aluno, gerando um token de primeiro acesso (`onboarding_token`) enviado por e-mail para que o próprio aluno defina sua senha no primeiro acesso.

### 1.4. Proteção contra IDOR (Insegurança no Acesso Direto a Objetos)
*   **Problema**: Risco de um Personal Trainer acessar dados de um aluno pertencente a outro Personal manipulando parâmetros numéricos (`:id`) nas URLs das rotas.
*   **Requisitos**:
    1.  Implementar um middleware de validação de vínculo (`validateStudentOwnership`) executado em todos os endpoints parametrizados que verifica na tabela `student_profiles` se o `personal_id` da requisição autenticada é o instrutor responsável pelo `student_id` informado na rota.
    2.  Implementar testes automatizados de controle de acesso cruzado para garantir que a API retorne `403 Forbidden` sob acessos não autorizados.

### 1.5. Rate Limit Combinado por IP e Conta
*   **Problema**: Brute force contra credenciais de login.
*   **Requisitos**: Configurar rate limit combinado por IP e conta/e-mail no backend para travar temporariamente logins sucessivos falhos para um mesmo e-mail, mesmo sob IPs alternados.

---

## 2. Riscos de Infraestrutura e Persistência

### 2.1. Perda de Dados em Containers (Ephemeral Storage)
*   **Problema**: O banco fica em `/app/data/database.sqlite` e os avatares em `backend/uploads/avatars/`. Containers Docker são efêmeros por padrão. Comandos como `docker compose down` ou crashes podem destruir o banco inteiro e todas as imagens de avatar.
*   **Requisitos**: No arquivo `docker-compose.yml`, mapear volumes nomeados (named volumes) persistidos no host.
    ```yaml
    volumes:
      - sqlite_data:/app/data
      - avatar_uploads:/usr/src/app/backend/uploads/avatars
    ```

### 2.2. Contenção de Escrita no SQLite (Database Locks)
*   **Problema**: Sistemas de Chat (gravações de mensagens frequentes) e Workers em background (traduções em fila) causam alta concorrência de escrita. O SQLite padrão bloqueia o banco inteiro durante escritas, o que pode gerar erros frequentes de `SQLITE_BUSY`.
*   **Requisitos**:
    1.  **WAL Mode e Timeout**: Habilitar o modo WAL (Write-Ahead Logging) e o `busy_timeout` de 5.000ms na inicialização do pool Knex (melhoria de concorrência de escrita).
    2.  **Integridade Referencial**: Garantir a execução automática de `PRAGMA foreign_keys = ON;` em cada conexão obtida do pool do Knex.

### 2.3. Desligamento Gracioso (Graceful Shutdown) para SSE
*   **Problema**: Ao reiniciar o servidor Express para deploys ou manutenção, conexões abertas de SSE pendentes podem travar o encerramento do processo Node.
*   **Requisitos**: Ouvintes para sinais `SIGTERM` e `SIGINT` no Express percorrendo o Map `activeClients` de conexões SSE ativas, enviando sinal de shutdown amigável para reconexão automática nos navegadores e fechando os sockets de forma limpa.

### 2.4. Estratégia Integrada de Backups
*   **Problema**: Necessidade de garantir a integridade dos dados sob crashes físicos.
*   **Requisitos**: Rotina diária unificada empacotando a cópia consistente do `database.sqlite` e a pasta `/uploads` (com retenção de 7 backups diários, 4 semanais e 1 mensal), com disparo automático antes de migrações.

---

## 3. Gargalos de Desempenho e UX (Frontend/Backend)

### 3.1. Ausência de Paginação e Virtualização (DOM Lockup)
*   **Problema**: As rotas de catálogo de exercícios (1.300+ itens) e histórico de chat carregam todos os itens de uma vez. Inserir mais de 1.300 cartões no DOM do navegador trava a thread principal do JavaScript, inviabilizando o uso em celulares modestos.
*   **Requisitos**:
    1.  **Backend**: Implementar paginação baseada em cursor para chats (`before`/`limit`) e offset/limit para o catálogo.
    2.  **Frontend**: Utilizar técnica de **Virtual Scrolling** no catálogo de exercícios (renderizar no DOM apenas os itens visíveis na viewport + buffer de segurança superior/inferior).

### 3.2. Problema de Fuso Horário (Timezones)
*   **Problema**: Se o servidor Docker rodar em UTC (padrão) e um aluno registrar o peso às 22h no horário de Brasília, o servidor registrará no SQLite como 01h do dia seguinte, distorcendo o histórico biométrico do aluno.
*   **Requisitos**: O banco de dados (SQLite) deve armazenar todas as datas em padrão ISO 8601 UTC (ex: `2026-07-19T19:00:00Z`). A conversão para fuso horário local deve ocorrer estritamente no frontend do navegador usando a API nativa `Intl.DateTimeFormat`.

### 3.3. Bloqueio de Imagens Base64 no Banco de Dados
*   **Problema**: O envio de payloads Base64 de imagens de exercícios não deve ser armazenado como string Base64 diretamente no banco de dados, pois isso incha o SQLite, degradando o desempenho de leitura de tabelas indexadas.
*   **Requisitos**: O Express converte o payload Base64 recebido para WebP, salva o arquivo físico na pasta persistida (volume Docker) e grava **apenas o caminho relativo do arquivo** na coluna do banco de dados (ex: `/uploads/exercises/id.webp`).

### 3.4. Controle de Cache no Nginx e Cache Busting
*   **Problema**: Novos deploys do frontend podem fazer navegadores de usuários usarem arquivos JavaScript e CSS velhos armazenados em cache local, gerando quebras de integração com a API atualizada.
*   **Requisitos**:
    1.  **Cache Busting**: Utilizar hashes exclusivos nos nomes dos arquivos gerados no build (ex: `app.a3f9b.js`).
    2.  **Headers Nginx**: Configurar o Nginx com `Cache-Control: no-cache` para o arquivo principal `index.html` (forçando verificação de novidades), e cache máximo nos arquivos estáticos com hash (`.js`, `.css`, imagens).

### 3.5. Ajustes de Usabilidade e Acessibilidade (UI)
*   **Requisitos**: Injetar Focus Trap em modais abertos, caixas de diálogo nativas confirmando saída do usuário de formulários não salvos, e suporte a `prefers-reduced-motion` para desativar transições pesadas.

---

## 4. Lógica de Negócio, Resiliência e Operação

### 4.1. Execução Real de Treino e Histórico de Sessões
*   **Problema**: A marcação de exercícios concluídos é salva unicamente em `localStorage` do navegador do aluno. Isso impede o Personal Trainer de acompanhar a aderência semanal ou evolução de cargas.
*   **Requisitos**: Criar tabelas no banco de dados:
    *   `workout_sessions` - Controle do início, fim e status do treino do aluno (`started`, `completed`, `abandoned`).
    *   `exercise_logs` - Registro das séries, repetições, carga real realizada, esforço percebido (RPE) e notas de cada exercício da sessão.

### 4.2. Versionamento das Fichas de Treino
*   **Problema**: Quando o Personal Trainer altera um exercício de uma ficha, o histórico antigo de treinos realizados pelo aluno passa a exibir as modificações recentes.
*   **Requisitos**: Implementar versionamento estruturado de treinos (`workout_plans` e `workout_plan_versions`) ou criar uma cópia estática e imutável da ficha (snapshot) no banco no momento do início da sessão.

### 4.3. Soft Delete (Deleção Lógica)
*   **Problema**: Deleções físicas directas (`DELETE`) quebram a rastreabilidade e histórico de treinos antigos de alunos.
*   **Requisitos**: Adicionar a coluna `deleted_at` nas tabelas sensíveis (Fichas, Alunos, Medições). Ao excluir, fazer `UPDATE deleted_at = CURRENT_TIMESTAMP`, e nos métodos `GET` filtrar com `WHERE deleted_at IS NULL`.

### 4.4. Unificação de Contratos Frontend e API
*   **Requisitos**: Padronizar endpoints `/api`, isolar a rota de desassociação de exercícios da ficha para `DELETE /api/workout-exercises/:workoutExerciseId` e a exclusão do catálogo global para `DELETE /api/catalog/exercises/:catalogExerciseId`.

### 4.5. Refatoração do Catálogo de Exercícios (Redundância)
*   **Problema**: A inserção de 1.324 registros de exercícios para cada Personal Trainer cadastrado gera redundância massiva (ex: 660 mil registros para 500 personais) e processamentos lentos de tradução assíncrona.
*   **Requisitos**: Separar em:
    *   `base_exercises` - Catálogo canônico global compartilhado.
    *   `personal_exercises` - Exercícios customizados e criados pelos instrutores.
    *   `personal_exercise_settings` - Tabela pivô contendo o vínculo do personal com o exercício, flag de favorito e o `display_order` de ordenação.

### 4.6. Resiliência do Worker de Tradução
*   **Requisitos**: Estados de controle na fila de tradução (`pending`, `processing`, `completed`, `failed`). Colunas `attempt_count` para retries com limite e `locked_at` para prevenção de concorrência com outras instâncias do worker.

### 4.7. Agenda de Treinos e Templates
*   **Requisitos**: Mapear na ficha os dias sugeridos (`recommended_weekdays`) e sequências (A/B/C) para organizar um programa semanal. Permitir salvamento e replicação de modelos de treinos (`workout-templates`).

### 4.8. Autoria e Validação de Medições
*   **Requisitos**: Identificar quem lançou a medida (`recorded_by_user_id`), data de ocorrência retroativa (`measurement_date`), e controle de edição de erros.

---

## 5. Privacidade e LGPD

### 5.1. Conformidade com LGPD
*   **Requisitos**: Termo de consentimento de tratamento de dados de saúde no primeiro acesso do aluno, rota de exportação em JSON e mecanismos para exclusão definitiva com anonimização (removendo colunas pessoais e preservando apenas métricas agregadas).
