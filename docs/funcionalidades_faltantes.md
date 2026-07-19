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
*   **Requisitos**: No arquivo `docker-compose.yml`, é obrigatório declarar e mapear volumes nomeados (named volumes) persistidos no host:
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

### 2.5. Bloqueio de Upload pelo Nginx (Erro HTTP 413)
*   **Problema**: A validação do frontend permite arquivos de imagem de até 5 MB. Contudo, o servidor Nginx possui um limite padrão embutido de 1 MB para o corpo da requisição (`client_max_body_size`). Qualquer tentativa de upload de um avatar ou exercício acima de 1 MB será abortada pelo proxy reverso antes de chegar à aplicação Node.js, retornando o erro *413 Payload Too Large*.
*   **Requisitos**: Adicionar a diretiva `client_max_body_size 10M;` nos blocos `http` ou `server` do arquivo de configuração [nginx.conf](file:///c:/Nestjs/sistema-tonho/nginx.conf).

### 2.6. Esgotamento de Conexões SSE no Navegador (Gargalo HTTP/1.1)
*   **Problema**: O sistema depende de Server-Sent Events (SSE) para o chat em tempo real. O protocolo HTTP/1.1 impõe um limite estrito no navegador de, no máximo, 6 conexões persistentes simultâneas por domínio. Se o usuário abrir 7 abas diferentes no desktop, a 7ª aba travará indefinidamente tentando conectar ao `/api/chat/stream`.
*   **Requisitos**:
    1.  **Multiplexação via HTTP/2**: Habilitar explicitamente o suporte a **HTTP/2** nas configurações de escuta do Nginx e no painel do Cloudflare Tunnel, permitindo centenas de conexões lógicas sobre a mesma porta TCP física.
    2.  **Frontend SharedWorker (Opcional)**: Implementar um `SharedWorker` no JavaScript do frontend para gerenciar e manter uma única conexão SSE persistente com a API, distribuindo os eventos entre as diferentes abas abertas pelo mesmo navegador.

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

### 3.3. Bloqueio de Imagens Base64 no Banco e Arquivos Órfãos
*   **Problema**: O envio de payloads Base64 de imagens de exercícios não deve ser armazenado como string Base64 diretamente no banco de dados, pois isso incha o SQLite, degradando o desempenho. Além disso, a deleção física de avatares ou exercícios customizados no banco sem apagar o respectivo arquivo no disco gera acúmulo progressivo de arquivos de mídia órfãos no volume Docker, esgotando o espaço do servidor.
*   **Requisitos**:
    1.  **Escrita Física**: O Express converte o payload Base64 recebido para WebP, salva o arquivo físico na pasta persistida (volume Docker) e grava **apenas o caminho relativo do arquivo** na coluna do banco de dados (ex: `/uploads/exercises/id.webp`).
    2.  **Limpeza no Delete**: Acoplar a deleção no banco de dados a chamadas de remoção física de arquivos (`fs.unlink()` ou equivalente) tanto na atualização/exclusão de avatares quanto na exclusão de exercícios customizados (`DELETE /api/catalog/exercises/:id`).


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

### 4.9. Edição e Exclusão de Mensagens no Chat
*   **Problema**: Mensagens trocadas no chat não podem ser alteradas ou excluídas. Erros de digitação ou envio de fichas/planilhas incorretas são permanentes.
*   **Requisitos**:
    1.  **Edição**: Rota `PUT /api/chat/:messageId` permitindo alterar o conteúdo da mensagem (exibindo um indicador visual de *(editado)* ao lado da bolha de texto).
    2.  **Exclusão**: Rota `DELETE /api/chat/:messageId` que remove fisicamente ou marca o conteúdo como excluído, substituindo o texto visualmente por *"Mensagem apagada"* no frontend para preservar o fluxo de conversa.

### 4.10. Indicador de "Digitando..." em Tempo Real
*   **Problema**: Falta de feedback presencial. O usuário não sabe se o interlocutor está escrevendo uma mensagem.
*   **Requisitos**:
    1.  **Frontend**: Monitorar o evento `oninput` no campo de texto de envio e disparar uma requisição `POST /api/chat/typing` com limitador de chamadas (debounce de 3 segundos).
    2.  **Backend**: Disparar um evento leve e efêmero via stream SSE para o destinatário (`event: typing`). Ao receber o evento, o frontend exibe uma animação de digitação ("...") por 3 segundos.

### 4.11. Ciclo de Inativação e Filtragem de Alunos
*   **Problema**: A listagem inicial do Personal Trainer retorna todos os alunos cadastrados na história da conta. Com o tempo, a tela inicial ficará poluída com dezenas de alunos inativos ou antigos.
*   **Requisitos**:
    1.  **Status do Aluno**: Adicionar campo de controle `status` (`'active'`, `'inactive'`) na tabela de perfis de alunos.
    2.  **Frontend**: Adicionar botão "Inativar Aluno" no modal de detalhes (bloqueando o acesso do aluno ao sistema) e um controle de abas de filtragem na tela inicial ("Ativos" / "Inativos") para ocultar os alunos antigos por padrão.

### 4.12. Isolamento de Tenant (Multi-Tenancy) e Controle de Cobrança
*   **Problema**: Não há controle de acesso comercial/financeiro. Personais inadimplentes ou com contas suspensas continuam utilizando a plataforma sem qualquer restrição para si ou seus alunos vinculados.
*   **Requisitos**:
    1.  **Tabela de Assinaturas**: Criar tabela `subscriptions` vinculada à conta do Personal (`user_id`).
    2.  **Middleware de Assinatura**: Adicionar middleware de validação financeira que verifica o status e validade da assinatura do Personal. Em caso de expiração, a API retorna `402 Payment Required`, bloqueando rotas modificadoras do Personal Trainer e impedindo alunos vinculados a ele de acessar suas fichas.

---

## 5. Privacidade e LGPD

### 5.1. Conformidade com LGPD
*   **Requisitos**: Termo de consentimento de tratamento de dados de saúde no primeiro acesso do aluno, rota de exportação em JSON e mecanismos para exclusão definitiva com anonimização (removendo colunas pessoais e preservando apenas métricas agregadas).

---

## 6. Processo de Deploy e Sistema de Atualizações em Produção

### 6.1. Migrações de Banco de Dados Automatizadas e Seguras
*   **Problema**: Em ambientes de produção com banco local SQLite montado em volume persistente, deploys de código novo que exigem mudanças de esquema (migrations) podem falhar ou gerar inconsistências se executados concorrentemente com o tráfego da API.
*   **Requisitos**:
    1.  **Release Phase / Init Container**: O script de inicialização do Docker (`Docker entrypoint`) deve executar `knex migrate:latest` de forma serial antes do servidor da API principal iniciar a escuta na porta TCP.
    2.  **Transações e Migrações Retrocompatíveis**: Toda migração deve ser transacional e projetada para ser retrocompatível (Ex: nunca remover ou alterar tipos de colunas ativas imediatamente; primeiro adicionar a nova coluna como nula, migrar os dados em background via script e apenas em um deploy futuro remover a coluna antiga).

### 6.2. Snapshot de Segurança Pré-Deploy (Backup e Rollback)
*   **Problema**: Uma migração corrompida ou com falha pode inutilizar o arquivo SQLite persistido no volume Docker em produção.
*   **Requisitos**: O script de entrypoint do container deve efetuar uma cópia física segura (`database.sqlite.bak`) antes de rodar `knex migrate:latest`. Em caso de falha da migração (código de saída não-zero), o script deve restaurar o snapshot automaticamente e abortar o deploy, mantendo a versão anterior ativa.

### 6.3. Atualização de Código com Tempo Mínimo de Inatividade (Rolling Update)
*   **Problema**: Como o SQLite é um banco de dados de arquivo único com suporte a apenas um escritor por vez, o uso de escalabilidade horizontal pesada com Blue-Green deployment pode causar bloqueios de concorrência ou duplicação temporária de containers acessando o mesmo arquivo.
*   **Requisitos**: Utilizar a estratégia de **Rolling Update** controlada no Docker Compose com apenas uma réplica da API ativa. O comando de deploy:
    ```bash
    docker compose up -d --build --no-deps web
    ```
    Reconstrói e substitui o container em menos de 2 segundos. O Nginx deve ter uma página estática temporária de manutenção em caso de falha do upstream.

### 6.4. Alerta de Atualização de Versão no Frontend SPA
*   **Problema**: Usuários com o app aberto em segundo plano no celular (PWA/SPA) continuam executando código JavaScript antigo em memória. Se a API for atualizada, as requisições do frontend antigo podem bater com contratos novos quebrados, gerando erros silenciosos para o usuário.
*   **Requisitos**:
    1.  **Endpoint de Versão**: Criar rota `GET /api/version` que retorna o hash de commit Git ou versão atual (ex: `{"version": "1.0.4"}`).
    2.  **Polling / Interceptor de Erro**: O frontend faz uma verificação periódica de hora em hora (ou lê o header de versão `X-App-Version` anexado a todas as respostas HTTP da API). Ao detectar uma mudança de versão, exibe um banner ou toast persistente: *"Nova versão disponível! Clique aqui para recarregar."*, forçando o recarregamento do navegador (`window.location.reload(true)`) para limpar o cache de bundles JavaScript.

---

## 7. Empacotamento e Compilação da Versão Mobile (APK / App Nativo)

### 7.1. Wrapper Híbrido Nativo com Capacitor
*   **Problema**: O sistema foi concebido como uma aplicação web Vanilla. Para ser distribuído nas lojas de aplicativos (Google Play Store) e executado como um aplicativo nativo (`.apk` no Android), os recursos do frontend precisam ser empacotados em um contêiner nativo.
*   **Requisitos**:
    1.  **Integração do Capacitor**: Instalar a CLI do Capacitor (`@capacitor/core` e `@capacitor/cli`) e inicializar o projeto mobile mapeando o diretório de arquivos estáticos (`--web-dir=frontend`).
    2.  **Plataforma Android**: Adicionar a plataforma nativa do Android (`npx cap add android`) e usar o Android Studio para compilação e assinatura do arquivo `.apk` ou `.aab` de produção.

### 7.2. Resolução Dinâmica de Base URL da API
*   **Problema**: Em navegadores web, caminhos relativos (Ex: `/api/auth/login`) resolvem automaticamente para o host da página. Em uma aplicação híbrida (APK), os arquivos estáticos são servidos a partir de um protocolo local (`http://localhost` no Android ou `capacitor://localhost` no iOS). Sem uma URL base fixa, as requisições falham ao tentar acessar recursos locais inexistentes.
*   **Requisitos**:
    1.  **Identificação de Ambiente**: O utilitário `API` no frontend JavaScript deve detectar se o app está rodando em ambiente híbrido (ex: verificando a existência de `window.Capacitor`).
    2.  **Base URL Condicional**: Se for detectado ambiente mobile/híbrido nativo, prefixar todas as chamadas HTTP com a URL absoluta do servidor em produção (ex: `https://tonho.personaltonho.online/api`), caso contrário, manter o uso de caminhos relativos.

### 7.3. Liberação de CORS para Origens Locais do WebView
*   **Problema**: O backend Express bloqueia requisições vindas de origens desconhecidas por segurança contra acessos cross-origin não autorizados. Os WebViews nativos do Android e iOS enviam cabeçalhos de origem locais.
*   **Requisitos**: No arquivo de segurança de cabeçalhos do backend (`httpSecurity.js`), adicionar as origens padrões dos WebViews na lista de permissões do CORS (CORS Whitelist):
    *   `http://localhost` (WebView Android)
    *   `capacitor://localhost` (WebView iOS/Capacitor)

### 7.4. Gerenciamento de Armazenamento Seguro no Dispositivo
*   **Problema**: Cookies HTTP-Only com flag `Secure` e `SameSite` não são gerenciados de forma consistente por WebViews nativos em algumas versões do Android, o que pode quebrar a persistência da sessão JWT ao fechar o app.
*   **Requisitos**:
    1.  **Capacitor Secure Storage**: Se rodando em APK nativo, contornar o uso de cookies substituindo pelo armazenamento de credenciais via plugin nativo `@capacitor-community/secure-storage` (criptografia em nível de hardware/Keystore do dispositivo).
    2.  **Cabeçalho Authorization**: Passar o token JWT explicitamente no cabeçalho `Authorization: Bearer <token>` nas requisições da API quando em modo mobile nativo.


