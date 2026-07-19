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

### 1.7. Waivers, PAR-Q e Assinatura Eletrônica de Termos (Conformidade Jurídica)
*   **Problema**: Risco de responsabilidade civil ou judicial do Personal Trainer e da plataforma em decorrência de lesões corporais, sobrecargas musculares ou incidentes médicos durante execuções de treinos sem salvaguardas contratuais explícitas.
*   **Requisitos**:
    1.  **Questionário PAR-Q**: Preenchimento obrigatório do questionário de aptidão física (PAR-Q) antes do primeiro treino.
    2.  **Isenção de Responsabilidade**: Assinatura e aceitação eletrônica de termos de uso e isenção de responsabilidade (*waivers*) com registro imutável do IP, data/hora e versão dos termos assinados pelo aluno.

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

### 3.6. Periodização Biomecânica e Estimador de Repetição Máxima (1-RM)
*   **Problema**: A maioria das prescrições digitais é estática, sem suporte a oscilações de volume e intensidade (periodização ondulatória ou em blocos) ou à prescrição fina de tempo sob tensão.
*   **Requisitos**:
    1.  **Tempo Sob Tensão**: Permitir prescrição de cadência por exercício (tempo em segundos para as fases excêntrica, isométrica e concêntrica do movimento).
    2.  **Sugestão de Sobrecarga**: Motor algorítmico que calcula a estimativa de 1-RM baseada no log de carga e repetições reais enviados pelo aluno. O sistema sugere acréscimos inteligentes e fisiologicamente seguros na carga dos exercícios para os ciclos subsequentes.

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

### 4.11. Ciclo de Inativação e Filtragem de Alunos
*   **Problema**: A listagem inicial do Personal Trainer retorna todos os alunos cadastrados. Com o tempo, a tela inicial ficará poluída com dezenas de alunos antigos/inativos.
*   **Requisitos**:
    1.  Adicionar botão "Inativar Aluno" no modal de detalhes (bloqueando o acesso do aluno ao sistema) e abas de filtragem na tela inicial ("Ativos" / "Inativos").

### 4.12. Isolamento de Tenant (Multi-Tenancy) e Controle de Cobrança
*   **Problema**: Personais inadimplentes continuam utilizando a plataforma sem qualquer restrição para si ou seus alunos vinculados.
*   **Requisitos**:
    1.  Criar tabela `subscriptions` vinculada à conta do Personal (`user_id`).
    2.  Adicionar middleware de validação financeira que verifica a validade da assinatura do Personal. Em caso de expiração, a API retorna `402 Payment Required`, bloqueando rotas modificadoras do Personal Trainer e impedindo alunos vinculados a ele de acessar suas fichas.

### 4.13. Gestão de Equipes e Hierarquias Multiníveis (Clínicas e Assessorias)
*   **Problema**: Relações simples um-para-muitos (um Personal para alunos) impedem micro-agências, stúdios ou clínicas multidisciplinares de escalar operações em equipe.
*   **Requisitos**:
    1.  **Estrutura de Equipe**: Mapeamento de papéis como "Head Trainer" / Coordenador e Treinadores Juniores/Associados. O coordenador pode supervisionar e delegar alunos para juniores.
    2.  **Bibliotecas Compartilhadas**: Centralização de metodologias padronizadas; as bibliotecas de exercícios e as capturas videográficas instrucionais precisam poder ser curadas exclusivamente pela coordenação global e, então, instanciadas em permissões somente leitura nos portfólios visíveis pela equipe associada.
    3.  **Migrações em Lote**: Em caso de demissões ou licenças de treinadores, o sistema deve migrar em lote as carteiras de alunos para outros instrutores da mesma organização, preservando logs, fotos de progresso e anotações clínicas intactas sob o ID da nova autoria.
    4.  **Rateio de Comissões**: Algoritmo de split de faturamento integrado a gateways para repassar comissões dinâmicas aos treinadores juniores antes da liquidação na conta do coordenador.

### 4.14. Integração Multiprofissional e Perfis de Parceiros Terceiros
*   **Problema**: Educadores físicos são vedados por conselhos regulatórios de prescrever dietas, calibrações de macronutrientes ou prontuários médicos.
*   **Requisitos**:
    1.  **Perfis de Parceiros**: Criar contas e painéis restritos para Nutricionistas, Fisioterapeutas e Endocrinologistas.
    2.  **Consentimento e Compartilhamento**: Mediante consentimento eletrônico explícito emitido pelo aluno em conformidade com as leis de privacidade, esses parceiros ganham acesso read-only ao histórico de treinos e cargas do aluno, e podem atachar laudos médicos, exames digitalizados e planos nutricionais em PDF diretamente no prontuário unificado do aluno.
    3.  **Rastreador de Hábitos Saudáveis**: Módulos complementares para checklists diários de consumo hídrico básico e margens elementares de macronutrientes recomendados (dentro dos limites de orientação não-clínica permitida).

### 4.15. Integração Passiva com Sensores Vestíveis (Wearables)
*   **Problema**: Aferição de consistência dependente unicamente de digitação manual subjetiva dos dados pelo aluno sob fadiga.
*   **Requisitos**:
    1.  **APIs de Saúde**: Desenvolver adaptadores para sincronização assíncrona com as APIs do Apple HealthKit, Google Fit/Health Connect e Garmin.
    2.  **Análise de Recuperação**: Coleta de logs diários de frequência cardíaca de repouso, variabilidade cardíaca (HRV) e horas de sono profundo para calcular e sugerir autorregulação da intensidade de treino diária (central de estresse fisiológico basal), sinalizando alertas ao treinador.

### 4.16. Motores de Engajamento CRM e Prevenção de Churn
*   **Problema**: Falta de proatividade no resgate de alunos que abandonam o programa.
*   **Requisitos**:
    1.  **Gatilhos de Ausência**: Motores de busca diária na base de dados que disparam notificações ou geram tarefas no painel do Personal Trainer se o aluno correspondente não logar treinos por mais de 5 dias consecutivos.
    2.  **Pesquisas de NPS**: Disparador automatizado de pesquisas de satisfação líquida (Net Promoter Score) ao encerramento de cada macrociclo de treinamento periodizado.
    3.  **Broadcast Segmentado & Agendamento**: Ferramentas para o Personal enviar avisos e mensagens em lote para subgrupos de alunos (ex: "Todos os inativos") e agendar despachos automáticos de recados e tarefas.

### 4.17. Agendamentos Avançados e Check-ins Geolocalizados
*   **Problema**: Agendamentos manuais desorganizados e fraudes de presença/check-in em treinos presenciais.
*   **Requisitos**:
    1.  **Geofencing**: Validar check-in do aluno presencial por aproximação geográfica baseada em GPS/satélite ou conexão ativa a roteadores Wi-Fi cadastrados da academia de locação de horários.
    2.  **Sincronização**: Integração bidirecional com Google Calendar e Apple Calendar para evitar sobreposições horárias de agendas e aplicação de políticas de reembolso/cálculo de crédito sob cancelamentos de última hora.

### 4.18. Check-in de Prontidão Diário (Readiness Check-in)
*   **Problema**: Risco de lesões, overtraining ou baixo rendimento ao prescrever e iniciar rotinas pesadas sem mensurar a condição física atual do aluno naquele dia.
*   **Requisitos**:
    1.  **Avaliação Subjetiva Rápida**: Tela rápida opcional antes de iniciar a sessão ativa solicitando escalas de 1 a 5 para: dor muscular tardia (DOMS), fadiga geral, qualidade de sono anterior, humor e prontidão geral (readiness).
    2.  **Ajuste de Intensidade**: O sistema avisa o Personal Trainer se a prontidão estiver muito baixa, sugerindo autorregulações no treino.

### 4.19. Centro de Preferências de Notificações
*   **Problema**: Envio de mensagens e lembretes gerando ruído de comunicação e cansaço de notificações (churn por fadiga).
*   **Requisitos**: Tela para o usuário (tanto Personal quanto Aluno) marcar quais canais (E-mail, WhatsApp, Push) deseja utilizar para cada tipo de notificação (novos treinos, mensagens de chat, cobranças, etc.).

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

### 5.4. Backoffice Operacional (Suporte e Impersonation Seguro)
*   **Problema**: Operadores de suporte nível 3 necessitam inspecionar bugs relatados por usuários finais na interface, mas solicitar senhas temporárias infringe as regras mais básicas de segurança e sigilo de dados.
*   **Requisitos**:
    1.  **Impersonation**: Rota restrita no backend permitindo a administradores autorizados visualizar temporariamente a interface sob o perfil do usuário reclamante.
    2.  **Audit Trail**: Toda sessão de impersonation exige a inserção de justificativa formal associada a um ticket, gerando logs de auditoria imutáveis com alertas automáticos em canais de conformidade.

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
