# Funcionalidades Faltantes e Melhorias (Roadmap Pós-MVP)

Este documento mapeia as lacunas funcionais, melhorias arquiteturais e regras de negócio periféricas que não foram escopadas para o MVP inicial do **FitLife Sync**, servindo como guia de implementação para futuras versões de produção.

---

## 1. Recuperação de Senha do Personal Trainer (Self-Service Reset)
*   **Status Atual**: O Personal Trainer pode redefinir a senha de qualquer um de seus alunos vinculados. No entanto, se o próprio Personal esquecer sua senha, não há fluxo autônomo de recuperação.
*   **Requisitos de Implementação**:
    1.  **Frontend**: Adicionar link "Esqueci minha senha" na tela de Login. Criar formulários para inserção de e-mail e posterior entrada de nova senha + token.
    2.  **Backend**:
        *   Tabela no banco de dados para armazenar hashes de tokens temporários (`password_reset_tokens`) com data de expiração (máximo 1 hora).
        *   Rota `POST /api/auth/forgot-password`: Valida o e-mail, gera o token criptográfico e despacha um e-mail transacional.
        *   Rota `POST /api/auth/reset-password`: Recebe o token, verifica a expiração e atualiza a hash de senha na tabela `users`.
    3.  **Infraestrutura**: Integração com provedor de disparo de e-mails via API ou SMTP (ex: Resend, SendGrid, Amazon SES).

---

## 2. Interface Visual de Auditoria (Painel de Logs)
*   **Status Atual**: O backend executa o registro estruturado de ações administrativas na tabela `audit_logs` (como redefinição de senhas, exclusão de treinos e criação de medições), mas esses logs só podem ser consultados diretamente no banco de dados.
*   **Requisitos de Implementação**:
    1.  **Frontend**: Aba "Logs de Atividade" restrita no modal de configurações do Personal Trainer. Exibição de tabela paginada listando data/hora, ação e metadados simplificados (ex: "Excluiu o treino X do aluno Y").
    2.  **Backend**: Rota `GET /api/personal/audit-logs` com paginação e filtragem por intervalo de datas.

---

## 3. Gestão Centralizada de Backups na UI
*   **Status Atual**: Os scripts de backup/restauração (`npm run db:backup` e `npm run db:restore`) e o serviço `backup-worker` rodam em background por linha de comando ou automação Compose, salvando localmente ou em pastas montadas.
*   **Requisitos de Implementação**:
    1.  **Frontend**: Área de "Gerenciamento de Dados" nas configurações. Botão para "Gerar Ponto de Restauração Agora" e listagem dos últimos backups gerados, permitindo download direto dos arquivos empacotados `.tar.gz`.
    2.  **Backend**: Rotas `GET /api/admin/backups` (listar arquivos de backup), `POST /api/admin/backups/generate` (disparar rotina de backup de forma assíncrona) e `POST /api/admin/backups/restore` (carregar arquivo de backup para restauração).

---

## 4. Integração com Armazenamento em Nuvem (Cloud Object Storage)
*   **Status Atual**: Imagens de perfil (avatares) e GIFs customizados criados pelos usuários são processados em Base64 e salvos localmente na pasta `backend/uploads/`.
*   **Requisitos de Implementação**:
    1.  **Armazenamento**: Migrar o local de escrita física para um serviço de Cloud Object Storage compatível com a API S3 (ex: Cloudflare R2, AWS S3 ou Google Cloud Storage) para evitar o preenchimento total do disco local em ambientes de produção.
    2.  **CDN**: Configurar Nginx ou CDN de borda para cachear as mídias estáticas de forma eficiente.

---

## 5. Notificações Offline (Web Push / E-mail de Ausência)
*   **Status Atual**: O chat em tempo real notifica os usuários instantaneamente usando Server-Sent Events (SSE) quando a janela do navegador está aberta e ativa. Mensagens recebidas enquanto o usuário está desconectado acumulam badges de contagem para a próxima sessão.
*   **Requisitos de Implementação**:
    1.  **Web Push API**: Registrar Service Worker no frontend para receber notificações do sistema mesmo com o navegador fechado.
    2.  **E-mail Transacional**: Envio de e-mail de alerta caso o usuário possua mensagens de chat não lidas há mais de 30 minutos (jobs agendados de verificação).

---

## 6. Calculadora Biométrica e Evolução Avançada
*   **Status Atual**: O sistema registra circunferência física (tórax, cintura, quadril, membros) e plota curvas brutas de alteração de peso.
*   **Requisitos de Implementação**:
    1.  **Fórmulas de Gordura Corporal**: Integração de inputs de dobra cutânea e fórmulas matemáticas (ex: Jackson & Pollock, método de circunferência da Marinha Americana) para estimar o percentual de gordura corporal (%GC) dinamicamente.
    2.  **Comparação Visual**: Permitir upload de fotos de evolução física organizadas por data lado a lado na aba de medidas.
