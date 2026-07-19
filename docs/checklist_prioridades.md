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
