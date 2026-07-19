# Funcionalidades Faltantes, Melhorias e Roadmap Pós-MVP

Este documento detalha as lacunas identificadas no ciclo de uso, consistência de dados, segurança, arquitetura do banco e operação do **FitLife Sync**, propondo as ações e modelagens necessárias para a evolução do sistema de protótipo acadêmico para uma plataforma comercial estável.

---

## 1. Execução Real de Treino e Histórico de Sessões
*   **Problema**: A marcação de exercícios concluídos é salva unicamente em `localStorage` do navegador do aluno. Isso impossibilita a sincronização entre dispositivos, gera perda de dados se o cache do navegador for limpo e impede o Personal Trainer de acompanhar a aderência semanal, evolução de carga, tempo de realização ou abandonos.
*   **Ação Proposta**: Criar uma tabela de sessões de treino e logs de execução no backend.
*   **Modelagem de Dados**:
    ```text
    workout_sessions
    - id (INTEGER, PK)
    - student_id (INTEGER, FK -> users)
    - workout_id (INTEGER, FK -> workouts)
    - started_at (TIMESTAMP)
    - completed_at (TIMESTAMP, NULLABLE)
    - status (VARCHAR: 'started', 'completed', 'abandoned')

    exercise_logs
    - id (INTEGER, PK)
    - session_id (INTEGER, FK -> workout_sessions)
    - workout_exercise_id (INTEGER, FK -> workout_exercises)
    - completed (BOOLEAN)
    - actual_sets (INTEGER)
    - actual_reps (INTEGER)
    - actual_weight (DECIMAL)
    - rpe (INTEGER, NULLABLE) -- Rate of Perceived Exertion (1 a 10)
    - notes (TEXT, NULLABLE)
    ```

---

## 2. Versionamento das Fichas de Treino
*   **Problema**: Quando o Personal Trainer altera um exercício ou remove uma prescrição de uma ficha existente, o histórico antigo de treinos realizados pelo aluno passa a exibir as modificações recentes, corrompendo a integridade dos dados históricos do aluno.
*   **Ação Proposta**: Versionar fichas de treinos ou criar uma cópia estática e imutável da ficha (snapshot) no momento em que o aluno inicia uma nova sessão de treino (`workout_sessions`).
*   **Modelagem para Versionamento Complexo**:
    ```text
    workout_plans
    - id (INTEGER, PK)
    - student_id (INTEGER, FK -> users)
    - name (VARCHAR)
    - status (VARCHAR: 'draft', 'active', 'archived')
    - active_from (DATE)
    - active_until (DATE, NULLABLE)

    workout_plan_versions
    - id (INTEGER, PK)
    - workout_plan_id (INTEGER, FK -> workout_plans)
    - version (INTEGER)
    - created_at (TIMESTAMP)
    - published_at (TIMESTAMP, NULLABLE)
    ```

---

## 3. Operações Básicas de Edição
*   **Problema**: A API atual está muito orientada à criação e exclusão física de recursos. Excluir e recriar treinos ou medidas destrói o contexto de uso e histórico de dados.
*   **Ação Proposta**: Implementar rotas parciais de atualização (`PATCH`) e deleção lógica.
*   **Novas Rotas Exigidas**:
    *   `PATCH /api/personal/students/:id` - Edição de metadados do aluno (Nome, Altura, Peso Meta, Nascimento).
    *   `PATCH /api/workouts/:id` - Edição de nome/descrição da ficha de treinos.
    *   `PATCH /api/workout-exercises/:id` - Edição das metas prescritas (séries, repetições, carga, descanso, notas).
    *   `PUT /api/workouts/:id/exercises/reorder` - Reordenação de exercícios dentro da ficha.
    *   `PATCH /api/measurements/:id` - Edição de medidas físicas lançadas incorretamente.
    *   `DELETE /api/measurements/:id` - Exclusão de medidas errôneas.
    *   `POST /api/personal/students/:id/archive` - Arquivamento de alunos (deleção lógica).

---

## 4. Unificação de Contratos Frontend e API
*   **Problema**: Existem divergências nos caminhos (paths) descritos na arquitetura em relação aos mapeados nos roteadores da API. Por exemplo, a rota de exclusão de exercícios da ficha está mapeada como `DELETE /api/exercises/:id`, o que gera ambiguidade entre excluir um item da ficha ou excluir um exercício canônico do catálogo global.
*   **Ação Proposta**: Renomear e isolar os recursos de forma consistente, aplicando o prefixo `/api` em todas as requisições:
    *   `DELETE /api/workout-exercises/:workoutExerciseId` - Desvincula exercício da ficha.
    *   `DELETE /api/catalog/exercises/:catalogExerciseId` - Remove exercício do catálogo global.
    *   Unificar redefinição de senha para: `POST /api/personal/students/:id/reset-password`.
    *   Unificar lançamento de medidas para: `POST /api/student/measurements`.

---

## 5. Refatoração do Catálogo de Exercícios (Redundância de Dados)
*   **Problema**: A criação de um Personal Trainer executa síncronamente o seed de 1.324 registros de exercícios na tabela `exercises` duplicando-os por usuário. Com 500 personais cadastrados, a base acumulará mais de 660.000 registros redundantes, tornando a base de dados inflada, inviabilizando atualizações globais e gastando poder de processamento do worker de tradução de forma repetitiva.
*   **Ação Proposta**: Separar a biblioteca de exercícios em um catálogo global (canônico) compartilhado e tabelas de extensões e configurações customizadas por Personal.
*   **Modelagem de Banco Otimizada**:
    ```text
    base_exercises (Catálogo Canônico Compartilhado)
    - id (INTEGER, PK)
    - name_en (VARCHAR)
    - name_pt (VARCHAR, NULLABLE)
    - description_en (TEXT, NULLABLE)
    - description_pt (TEXT, NULLABLE)
    - gif_url (VARCHAR)

    personal_exercises (Customizados por Personal)
    - id (INTEGER, PK)
    - personal_id (INTEGER, FK -> users)
    - name (VARCHAR)
    - description (TEXT, NULLABLE)
    - gif_url (VARCHAR, NULLABLE)

    personal_exercise_settings (Customização de Favoritos/Ordem)
    - personal_id (INTEGER, FK -> users)
    - exercise_id (INTEGER, FK -> base_exercises ou personal_exercises)
    - is_favorite (BOOLEAN)
    - display_order (INTEGER)
    - custom_name (VARCHAR, NULLABLE)
    - custom_description (TEXT, NULLABLE)
    ```

---

## 6. Agenda Semanal e Organização de Fichas
*   **Problema**: Os alunos recebem uma lista desorganizada de treinos, sem definição de dias sugeridos para a realização ou de uma ordem lógica (A, B, C).
*   **Ação Proposta**: Implementar agendamento flexível nas fichas de treino.
*   **Campos Recomendados na tabela `workouts`**:
    *   `sequence` (INTEGER): Ex: `1` para Treino A, `2` para Treino B, etc.
    *   `recommended_weekdays` (JSON/VARCHAR): Dias de treino indicados (Ex: `["segunda", "quarta", "sexta"]`).
    *   `weekly_frequency` (INTEGER): Meta de realizações por semana (Ex: `3` vezes).

---

## 7. Modelos Reutilizáveis de Treinos (Templates)
*   **Problema**: O Personal Trainer precisa montar as fichas individualmente para cada aluno, reduzindo a eficiência operacional no uso comercial.
*   **Ação Proposta**: Adicionar suporte a templates de treino duplicáveis.
*   **Endpoints Propostos**:
    *   `POST /api/workout-templates` - Criação de ficha modelo.
    *   `POST /api/workout-templates/:id/apply` - Aplicação de um modelo a um aluno específico.
    *   `POST /api/workouts/:id/duplicate` - Duplicação rápida de uma ficha existente para outro aluno.

---

## 8. Melhorias no Fluxo de Onboarding e Senhas
*   **Problema**: O Personal Trainer define a senha provisória do aluno e precisa repassá-la por canais externos. O Personal conhece a senha ativa do aluno e não há validação ou troca obrigatória no primeiro acesso.
*   **Ação Proposta**:
    1.  Adicionar flag `must_change_password` (BOOLEAN) na tabela `users`.
    2.  No primeiro login, se a flag for verdadeira, o frontend bloqueia a navegação e força a criação de uma nova senha pessoal, limpando a flag.
    3.  **Melhoria Adicional**: Fluxo de convite onde o Personal fornece apenas o e-mail, gerando um token de primeiro acesso (`onboarding_token`) enviado ao aluno para autodefinição de senha.

---

## 9. Ciclo de Vida da Conta e Arquivamento de Alunos
*   **Problema**: A desvinculação ou encerramento de conta utiliza deleções físicas directas (`DELETE`), que corrompem logs de auditoria e históricos.
*   **Ação Proposta**:
    *   Adicionar campo `status` (`'active'`, `'archived'`, `'suspended'`) e `archived_at` na tabela de perfis de usuários e alunos.
    *   Ao suspender/arquivar, invalidar instantaneamente as sessões ativas do usuário e bloquear novas tentativas de login.

---

## 10. Robustez Adicional do SQLite
*   **Problema**: Apesar de o modo WAL e o `busy_timeout` de 5.000ms terem sido implementados para mitigar bloqueios de concorrência, o SQLite precisa de proteções extras contra concorrência intensa devido ao chat SSE e ao worker de tradução em background.
*   **Melhorias Necessárias**:
    1.  **Foreign Keys**: Garantir a execução automática de `PRAGMA foreign_keys = ON;` em cada conexão obtida do pool do Knex para assegurar a integridade referencial.
    2.  **Mutex/Queue no Worker**: Limitar o número de conexões concorrentes de escrita do `translation-worker` e pausar suas tarefas pesadas de banco durante a execução de migrações (`migrations`) de esquema.

---

## 11. Estratégia de Backup Integrada
*   **Problema**: Embora existam scripts locais de backup, falta cobertura e regras de retenção claras sobre banco e uploads (avatares).
*   **Recomendação de Produção**:
    *   Automatação de rotina diária unificada empacotando o arquivo `database.sqlite` e a pasta `/uploads`.
    *   Política de retenção: 7 backups diários, 4 semanais e 1 mensal.
    *   Execução automática de backup de segurança antes da aplicação de migrations de banco.

---

## 12. Segurança e Validação de Uploads
*   **Problema**: O envio de arquivos através de Base64 integrado no payload JSON aumenta o consumo de banda em 33% e pode estourar limites de requisição de proxies. A validação baseia-se apenas em tipos MIME declarados pelo navegador, suscetível a uploads maliciosos.
*   **Ação Proposta**:
    1.  Adicionar assinaturas de cabeçalho mágico de arquivos (magic bytes) no backend para verificar se a imagem WebP/PNG/JPG é legítima.
    2.  Migrar rotas de upload para o formato padrão `multipart/form-data` para uploads grandes (GIFs customizados).
    3.  Implementar script cron periódico para limpeza de imagens órfãs na pasta de uploads (arquivos que não possuem registros correspondentes no banco).

---

## 13. Paginação e Idempotência no Chat
*   **Problema**: A rota de chat carrega o histórico completo sem paginação, o que gerará lentidão conforme a conversa crescer. Adicionalmente, o carregamento do histórico marca mensagens como lidas automaticamente, violando a idempotência do verbo `GET`.
*   **Ação Proposta**:
    1.  Adicionar paginação baseada em cursor no carregamento de histórico: `GET /api/chat/:userId?before=<messageId>&limit=50`.
    2.  Mudar o fluxo de leitura para um endpoint específico: `POST /api/chat/:userId/read`.
    3.  Adicionar token de identificação único gerado no cliente (`client_msg_id` UUID) para evitar duplicação de bolhas em caso de retentativas de envio sob conexões oscilantes.

---

## 14. Autoria e Correção de Medidas
*   **Problema**: A tabela de medidas carece de registro de quem efetuou o lançamento, impedindo auditorias de alterações errôneas.
*   **Ação Proposta**:
    *   Adicionar as colunas `recorded_by_user_id` (FK -> users), `measurement_date` (data civil da avaliação física) e `updated_at` (rastreio de edições).
    *   Permitir que o Personal Trainer edite ou remova medidas registradas. Bloquear o Aluno de alterar registros lançados pelo Personal.

---

## 15. Validações de Unidades e Parâmetros Físicos
*   **Problema**: Falta rigor e consistência nas unidades físicas salvas no banco de dados.
*   **Regras Recomendadas**:
    *   Alterar altura para `height_cm` (INTEGER) guardado em centímetros (ex: `175` em vez de `1.75`).
    *   Definir peso como DECIMAL com precisão fixa.
    *   Bloquear inserção de datas de nascimento, medições ou treinos no futuro em relação à data do servidor.

---

## 16. Segurança Avançada e IDOR
*   **Problema**: Inexistência de validações cruzadas sistemáticas que garantam que um Personal Trainer não possa acessar dados de um aluno de outro Personal ao manipular parâmetros numéricos (`:id`) nas URLs (vulnerabilidade IDOR).
*   **Ação Proposta**:
    *   Implementar middleware de validação de vínculo (`validateStudentOwnership`) que verifica na tabela `student_profiles` se o `personal_id` da requisição autenticada é de fato o proprietário ou instrutor responsável pelo `student_id` informado na rota.
    *   Adicionar rotação e expiração explícita de tokens JWT com chaves de renovação (refresh tokens).

---

## 17. Observabilidade e Health Checks
*   **Problema**: Os logs do servidor não estão estruturados de forma a rastrear o fluxo de uma mesma chamada que atravessa múltiplos serviços.
*   **Ação Proposta**:
    *   Integrar logs estruturados em formato JSON para produção.
    *   Injetar `Request-ID` (UUID) nos headers de entrada no Nginx e repassá-lo por todo o fluxo Express/Worker.
    *   Adicionar monitoramento do número de conexões SSE ativas no endpoint `/api/health`.

---

## 18. Controle do Worker de Tradução
*   **Problema**: O worker atual não gerencia backoff exponencial ou limite de tentativas em caso de quedas da API externa de tradução.
*   **Ação Proposta**:
    *   Criar estados estruturados na tabela de exercícios para o worker: `pending`, `processing`, `completed`, `failed`.
    *   Adicionar colunas `attempt_count` (limite máximo de 3 tentativas), `last_error` (log de erros) e `locked_at` (prevenção de concorrência com outras instâncias do worker).

---

## 19. Conformidade com LGPD e Privacidade
*   **Problema**: A aplicação processa dados biométricos sensíveis e históricos de chat.
*   **Ação Proposta**:
    *   Criar tela de consentimento de uso de dados de saúde no primeiro acesso do aluno.
    *   Implementar rota para exportação completa de dados do usuário em JSON.
    *   Disponibilizar exclusão definitiva com anonimização de dados no banco (apagando colunas pessoais mas preservando os logs numéricos agregados para fins estatísticos).

---

## 20. Ajustes de Usabilidade e Acessibilidade (UI)
*   **Melhorias**:
    *   Navegação por teclado: Injetar scripts de interceptação de foco (Focus Trap) em modais abertos, retornando o foco para o botão de ativação original ao fechar.
    *   Tratamento de formulários modificados: Exibir caixas de diálogo nativas confirmando saída do usuário se existirem inputs modificados não salvos.
    *   Suporte a `prefers-reduced-motion` no CSS para suavizar transições em sistemas com restrição de animação ativa.

---

## 21. Gerenciamento e Desligamento Gracioso (SSE Cleanup)
*   **Problema**: Ao reiniciar o container da API (durante deploys ou manutenção), os clientes conectados ao SSE mantêm conexões pendentes que podem travar o processo de finalização do servidor Express.
*   **Ação Proposta**:
    *   Implementar ouvinte para os sinais `SIGTERM` e `SIGINT` no backend.
    *   Ao interceptar o desligamento, percorrer a lista de conexões no Map `activeClients`, enviar uma mensagem de interrupção amigável (`data: {"event": "shutdown"}\n\n`), fechar as conexões ativas de forma limpa e permitir que o processo Node.js encerre graciosamente.
