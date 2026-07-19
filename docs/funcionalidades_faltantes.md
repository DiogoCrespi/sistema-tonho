# Funcionalidades Faltantes, Lacunas de Segurança e Roadmap Pós-MVP

Este documento detalha as lacunas identificadas no ciclo de uso, consistência de dados, segurança, arquitetura de banco de dados e operação do **FitLife Sync**, propondo as ações, modelagens e correções necessárias para a evolução do sistema de protótipo acadêmico para uma plataforma comercial estável, escalável e resiliente.

---

## 0. Correções de Concepção Técnica (Ajustes de Premissa)

*   **XSS vs CSRF**: Cookies `HttpOnly` não impedem ataques XSS; eles apenas reduzem o risco de roubo físico do token via script. Da mesma forma, `SameSite` mitiga ataques CSRF, mas não impede a execução de scripts maliciosos injetados na página. A segurança do frontend contra XSS depende estritamente de sanitização ativa do DOM (como o uso de `safe-dom.js`).
*   **Backup Seguro do SQLite**: Copiar fisicamente o arquivo `database.sqlite` enquanto o banco de dados está ativo no modo WAL (Write-Ahead Logging) pode gerar cópias corrompidas ou inconsistentes caso existam transações pendentes nos arquivos temporários `-wal` e `-shm`. A rotina de backup deve utilizar a API de backup nativa do SQLite, o comando `.backup`, ou a instrução SQL `VACUUM INTO` para consolidar o estado de forma atômica.
*   **Deploy (Substituição Controlada)**: A substituição de uma réplica única por meio do comando `docker compose up -d --build --no-deps web` atualiza apenas o proxy reverso/frontend Nginx. Para atualizar a API, o comando correto deve referenciar o serviço `app`. Com uma única réplica, o deploy é uma **substituição controlada com curta indisponibilidade** (downtime < 2s), e não um rolling update real (que exigiria múltiplas instâncias atrás de um load balancer).
*   **Autenticação Web vs Mobile (APK)**: Em vez de misturar cookies e tokens JWT longos de forma indistinta, a arquitetura de autenticação deve ser segregada:
    *   **Web (Navegador)**: Autenticação via cookies `HttpOnly` + `SameSite=Strict` + validação de header de `Origin`/`Referer`.
    *   **Mobile (APK)**: Uso de um **Access Token de curta duração** e um **Refresh Token rotacionado**, ambos salvos de forma isolada em armazenamento seguro nativo (`Capacitor Secure Storage`), trafegados explicitamente via cabeçalhos `Authorization: Bearer <token>`.

---

## 1. Falhas Críticas de Segurança, Acesso e Onboarding

### 1.1. Proteção contra CSRF (Cross-Site Request Forgery)
*   **Requisitos**: Embora o uso de `SameSite=Strict` e validação rígida de `Origin` proteja a versão web tradicional, as requisições oriundas do aplicativo híbrido (APK) exigem proteções adicionais. O frontend móvel deve trafegar cabeçalhos de autorização explícitos ou token CSRF baseado em dupla submissão de cookie (`XSRF-TOKEN` lido pelo frontend e injetado no cabeçalho `X-XSRF-TOKEN` validado na API).

### 1.2. Recuperação de Senha do Personal Trainer (Self-Service Reset)
*   **Requisitos**: Rota `POST /api/auth/forgot-password` gerando tokens temporários (expiração em 15 minutos) salvos com hash no banco. O link de recuperação é enviado ao e-mail cadastrado (Nodemailer + serviço SMTP/Resend). O Personal redefine a credencial na rota `POST /api/auth/reset-password`.

### 1.3. Onboarding de Alunos e Senhas Provisórias
*   **Requisitos**: 
    1.  Adicionar flag `must_change_password` (BOOLEAN) na tabela `users`. No primeiro login do aluno, a tela inicial é bloqueada obrigando-o a cadastrar uma nova senha.
    2.  **Fluxo de Convites (Superior)**: O Personal cadastra apenas nome e e-mail do aluno. O sistema gera um convite atômico (`onboarding_token`) com expiração de 24h. O aluno acessa o link de ativação e autodefine sua senha.

### 1.4. Proteção contra IDOR (Insegurança no Acesso Direto a Objetos)
*   **Requisitos**: Implementar o middleware `validateStudentOwnership` para interceptar todas as rotas parametrizadas por `:id` de aluno, garantindo que o Personal Trainer autenticado na sessão possua vínculo contratual ativo com o aluno acessado. Bloquear acessos cruzados com `403 Forbidden`.

### 1.5. Verificação de E-mail
*   **Requisitos**: Criação de tokens de verificação (`email_verification_tokens`) e gravação da coluna `email_verified_at` na tabela `users`. Bloquear fluxos de redefinição de senha ou ativação de cadastros para contas com e-mails não verificados.

### 1.6. Rate Limit Combinado por IP e Conta
*   **Requisitos**: Aplicar regras de limitação combinando a chave de IP com o endereço de e-mail/conta do usuário para impedir ataques distribuídos de brute force contra credenciais.

---

## 2. Riscos de Infraestrutura, Persistência e Deploy

### 2.1. Persistência de Dados em Containers (Mapeamento de Volumes)
*   **Requisitos**: Configurar no `docker-compose.yml` volumes nomeados persistidos no host:
    ```yaml
    volumes:
      - sqlite_data:/app/data
      - uploads_data:/usr/src/app/backend/uploads
    ```

### 2.2. Contenção de Escrita no SQLite (Database Locks)
*   **Requisitos**: Habilitação de `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;` e `PRAGMA foreign_keys = ON;` no pool de conexões do Knex. As transações de escrita do chat e workers devem ser curtas e sequenciadas para evitar concorrências físicas.

### 2.3. SQLite Safe Backups (Evitar Cópias Inconsistentes)
*   **Requisitos**: Proibir a cópia física direta (`cp`) do arquivo do banco de dados em produção enquanto o tráfego estiver ativo. A automação de backup deve executar `knex.raw("VACUUM INTO 'caminho/do/backup.sqlite'")` ou utilizar o utilitário oficial `.backup` para garantir a atonicidade.

### 2.4. Integridade de Banco de Dados: Constraints e Índices
*   **Requisitos**:
    *   **Constraints**:
        *   `UNIQUE(users.email)` (e-mail normalizado).
        *   `UNIQUE(student_profiles.student_id)`.
        *   `UNIQUE(personal_exercise_settings.personal_id, exercise_id)`.
        *   `CHECK(weight_kg > 0)` e `CHECK(status IN (...))`.
    *   **Índices recomendados**:
        *   `chat_messages(sender_id, receiver_id, created_at)`
        *   `workouts(student_id, status)`
        *   `workout_sessions(student_id, started_at)`
        *   `measurements(student_id, measurement_date)`
        *   `translation_jobs(status, locked_at)`

### 2.5. Bloqueio de Upload pelo Nginx (HTTP 413)
*   **Requisitos**: Adicionar `client_max_body_size 10M;` nos blocos `http` ou `server` no [nginx.conf](file:///c:/Nestjs/sistema-tonho/nginx.conf).

### 2.6. Esgotamento de Conexões SSE (Gargalos HTTP/1.1)
*   **Requisitos**: Configurar o Nginx e Cloudflare com **HTTP/2** para habilitar a multiplexação de conexões persistentes na mesma porta TCP, evitando o travamento de abas.

### 2.7. Desligamento Gracioso (Graceful Shutdown)
*   **Requisitos**: Escutar sinais `SIGTERM` e `SIGINT` na API Express para encerrar conexões SSE abertas no Map `activeClients` antes do encerramento das instâncias.

---

## 3. Gargalos de Desempenho e UX (Frontend/Backend)

### 3.1. Paginação e Virtualização (DOM Lockup)
*   **Requisitos**:
    1.  **Chat**: Paginação por cursor no backend (`GET /api/chat/:userId?before=<msgId>&limit=50`).
    2.  **Catálogo**: Paginação por offset/limit no backend e implementação de **Virtual Scrolling** no frontend para renderizar apenas os cartões de exercícios atualmente visíveis no navegador.

### 3.2. Problema de Fuso Horário (Timezones)
*   **Requisitos**: O banco de dados armazena tudo em formato UTC estrito (ISO 8601). O frontend executa a conversão para o fuso local do navegador na renderização usando `Intl.DateTimeFormat`.

### 3.3. Conversão de Base64 e Arquivos Órfãos
*   **Requisitos**: Imagens convertidas em WebP no Express, salvando apenas a string do caminho no SQLite. Ao excluir exercícios customizados (`DELETE /api/catalog/exercises/:id`) ou avatares, o backend deve acionar `fs.unlink()` para remover o arquivo correspondente no disco, prevenindo vazamentos de armazenamento.

### 3.4. Controle de Cache no Nginx
*   **Requisitos**: Hashing exclusivo nos nomes dos arquivos estáticos (`app.[hash].js`) no build e injeção do cabeçalho `Cache-Control: no-cache` para o arquivo principal `index.html`.

### 3.5. Controle de Concorrência nas Edições (Optimistic Locking)
*   **Requisitos**: Adicionar as colunas `updated_at` e `version` (INTEGER) nos registros modificáveis. O frontend deve enviar o cabeçalho `If-Match: <versao_atual>`. Caso haja divergência no banco de dados, retornar `409 Conflict`, evitando sobrescritas acidentais de outros instrutores.

---

## 4. Lógica de Negócio, Resiliência e Operação

### 4.1. Execução Real de Treino e Histórico de Sessões
*   **Requisitos**: Substituir a conclusão salva em `localStorage`.
*   **Modelagem de Dados**:
    ```text
    workout_sessions (Sessões de Treino)
    - id (INTEGER, PK)
    - student_id (INTEGER, FK -> users)
    - workout_id (INTEGER, FK -> workouts)
    - started_at (TIMESTAMP)
    - last_activity_at (TIMESTAMP)
    - paused_at (TIMESTAMP, NULLABLE)
    - completed_at (TIMESTAMP, NULLABLE)
    - duration_seconds (INTEGER)
    - status (VARCHAR: 'started', 'completed', 'abandoned')

    exercise_logs (Logs de Execução)
    - id (INTEGER, PK)
    - session_id (INTEGER, FK -> workout_sessions)
    - workout_exercise_id (INTEGER, FK -> workout_exercises)
    - completed (BOOLEAN)
    - actual_sets (INTEGER)
    - actual_reps (INTEGER)
    - actual_weight (DECIMAL)
    - rpe (INTEGER, NULLABLE)
    - notes (TEXT, NULLABLE)
    ```

### 4.2. Estado de Publicação da Ficha de Treino
*   **Requisitos**: Adicionar campo de status nas fichas: `draft`, `published`, `archived`.
*   **Fluxo**: O Personal Trainer edita a ficha livremente em modo rascunho (`draft`). O aluno só visualiza após a publicação (`published`), momento em que a versão anterior da ficha do aluno é automaticamente alterada para `archived`.

### 4.3. Ciclo de Vida do Aluno e do Vínculo Profissional
*   **Requisitos**: Separar o status da conta do status do vínculo:
    *   **Status da Conta**: `active`, `suspended`, `archived` (soft delete via `deleted_at`).
    *   **Status do Vínculo**: `invited`, `active`, `paused`, `blocked`. Alunos com vínculo pausado perdem acesso a rotas mutáveis e chat, mas retêm visualização do histórico. O fim do vínculo não deve inativar permanentemente o perfil global do aluno.

### 4.4. Anamnese, Restrições e Objetivos
*   **Requisitos**: Mapear dados clínicos e objetivos.
*   **Modelagem de Dados**:
    ```text
    student_assessments
    - id (INTEGER, PK)
    - student_id (INTEGER, FK -> users)
    - goal (VARCHAR)
    - experience_level (VARCHAR)
    - weekly_availability (INTEGER)
    - available_equipment (JSON/TEXT)
    - limitations (TEXT)
    - injuries (TEXT)
    - contraindicated_exercises (JSON/TEXT)
    - personal_notes (TEXT) -- Visível apenas para o Personal Trainer
    - student_notes (TEXT) -- Visível para o Aluno
    ```

### 4.5. Acompanhamento de Aderência
*   **Requisitos**: Painel analítico para o Personal Trainer.
    *   Cálculo: `aderência = treinos concluídos / treinos previstos`.
    *   Ordenar listagem de alunos por: menor aderência, maior tempo sem treinar (dias desde a última sessão ativa), mensagens não lidas e avaliações/fichas vencendo.

### 4.6. Progressão de Carga e Recordes Pessoais
*   **Requisitos**: Monitoramento de desempenho por exercício. Registrar na tabela `exercise_logs` o volume total (`séries × repetições × carga`) e RPE. O frontend exibe a última carga realizada e a sugestão prescrita na tela de execução do aluno.

### 4.7. Uso com Internet Instável (Modo Offline e Idempotência)
*   **Requisitos**:
    1.  **Frontend**: Armazenar temporariamente as conclusões de exercícios e logs da sessão ativa em uma fila local de ações pendentes (`IndexedDB`) em caso de perda de conexão, com tentativa de sincronização periódica em background.
    2.  **Chave de Idempotência**: Toda requisição mutável de sessão ou medição deve carregar o cabeçalho `Idempotency-Key: <UUID>` gerado no cliente, evitando duplicidades de registros em caso de reenvios após oscilações de rede.

### 4.8. Gerenciamento das Chaves de Cadastro (CLI Administrativo)
*   **Requisitos**: Script em terminal para administração das chaves de acesso em produção:
    *   `npm run access-key:create` - Cria novas chaves.
    *   `npm run access-key:list` - Lista chaves e status de claiming (se/quem utilizou).
    *   `npm run access-key:revoke` - Invalida chaves expiradas.

### 4.9. Edição, Exclusão e Leitura de Mensagens no Chat
*   **Requisitos**:
    *   Rota `PUT /api/chat/:messageId` para edição de mensagens (com marcador visual de *(editado)*).
    *   Rota `DELETE /api/chat/:messageId` para exclusão lógica (substituindo texto por *"Mensagem apagada"*).
    *   Mudar a marcação de leitura para `POST /api/chat/:userId/read` para manter a rota `GET /api/chat/:userId` idempotente.

### 4.10. Indicador de "Digitando..." no Chat
*   **Requisitos**: Eventos efêmeros SSE (`typing`) enviados a partir do trigger `oninput` no frontend via requisição rápida `POST /api/chat/typing` (com limitador de debounce).

---

## 5. Privacidade, LGPD e Observabilidade

### 5.1. Conformidade com LGPD e Termo de Consentimento
*   **Requisitos**: Exibir termo de consentimento explícito para tratamento de dados físicos e de saúde no primeiro acesso do aluno. Implementar rotas para exportação de dados pessoais em JSON e anonimização de registros.

### 5.2. Observabilidade e Health Checks
*   **Requisitos**:
    *   Endpoints `/health/live` e `/health/ready` (valida conexão ativa do banco e status de migrações).
    *   Logs estruturados contendo `requestId` (repassado do Nginx), rota, status, duração e ID do usuário autenticado.

### 5.3. Gerenciamento de Sessões por Dispositivo
*   **Requisitos**: Substituir JWT stateless absoluto por controle de sessões ativas na tabela `user_sessions`, permitindo que o usuário visualize e encerre sessões em outros navegadores ou aparelhos de forma granular.

---

## 6. Plano de Testes Mínimo Obrigatório

### 6.1. Testes de Integração (Vulnerabilidades e Regras)
*   **IDOR**: Validar se o Personal A recebe `403 Forbidden` ao tentar obter detalhes, medições ou treinos do aluno do Personal B.
*   **Autorização**: Garantir que o Aluno não consiga modificar fichas de treinos (`POST /api/workouts` ou `DELETE /api/exercises`).
*   **Reutilização de Chaves**: Validar se uma `accessKey` já utilizada ou expirada é rejeitada no cadastro.
*   **Transações**: Garantir que erros de escrita na tabela pivô revertam a transação de criação da ficha principal (sem dados órfãos).

### 6.2. Testes End-to-End (Caminho Crítico)
*   Cadastro e Onboarding -> Login -> Criação e Publicação de Ficha de Treino -> Execução da Sessão de Treino no perfil do Aluno -> Registro de Medidas -> Envio de Mensagem no Chat -> Logout.

### 6.3. Testes de Recuperação e Resiliência
*   Restauração atômica de banco SQLite via instrução segura de backup.
*   Execução e Rollback automático de migrações sob falha controlada do script de inicialização do Docker.
