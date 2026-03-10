# Como vincular o MCP do HubSpot no Cursor

Você criou um **MCP Auth App** no HubSpot (com Redirect URL). Existem **duas formas** de o Cursor falar com o HubSpot; o app que você criou serve para a **opção 1**.

---

## Onde configurar o MCP no Cursor

1. Abra **Configurações do Cursor**: `Ctrl + ,` (ou **File → Preferences**).
2. No menu da esquerda, vá em **Tools & MCP** (ou pesquise por "MCP").
3. Ali você vê a lista de servidores MCP e pode **Add new MCP server** ou editar o que já existe.

O Cursor pode usar um arquivo de configuração em vez da interface. Se alguém tiver configurado por arquivo, costuma estar em:
- **Global**: em algum arquivo de configuração do Cursor no seu usuário (por exemplo em `%APPDATA%\Cursor`).
- **Projeto**: `.cursor/mcp.json` na raiz do projeto (se existir).

---

## Opção 1: Servidor REMOTO do HubSpot (usa o app OAuth que você criou)

O HubSpot tem um MCP **remoto** em `https://mcp.hubspot.com`. Esse é o que usa **OAuth** e o **MCP Auth App** que você criou (Client ID, Client Secret, Redirect URL).

### No Cursor

1. Em **Tools & MCP**, clique em **Add new MCP server** (ou **Edit** no HubSpot, se já existir).
2. Preencha:
   - **Name**: `hubspot` (ou outro nome, ex.: `hubspot-oauth`).
   - **Type**: escolha **Streamable HTTP** / **URL** (não “command”).
   - **URL**: `https://mcp.hubspot.com`
3. **Não** preencha headers nem env – o Cursor faz OAuth sozinho.
4. Salve.

### Conectar (fazer login)

1. Na lista de MCP, o HubSpot deve aparecer com um botão **Connect** (ou “Needs authentication”).
2. Clique em **Connect**.
3. O Cursor deve abrir o navegador na página do HubSpot para você **autorizar o app** e escolher a conta.
4. Depois de autorizar, o redirect volta para o Cursor e a conexão fica ativa.

Se o HubSpot reclamar de **Redirect URL inválida**, você pode precisar adicionar no app (no HubSpot) a URL que o Cursor usa. Nesse caso, anote a URL exata que o HubSpot mostrar no erro e adicione ela em **Redirect URLs** do seu MCP Auth App (Edit info).

---

## Opção 2: Servidor LOCAL do HubSpot (Private App – token fixo)

Hoje sua configuração está como **servidor local** (`npx @hubspot/mcp-server`) com um **Private App token**. Esse fluxo **não** usa o MCP Auth App que você criou; usa um **Private App** no HubSpot.

### No HubSpot (Private App)

1. **Settings** (engrenagem) → **Integrations** → **Private Apps**.
2. **Create a private app**.
3. Dê um nome, marque os escopos que precisa (ex.: crm.objects.deals.read, crm.objects.contacts.read, crm.objects.companies.read).
4. Crie o app e **copie o Access Token** (só aparece uma vez).

### No Cursor

1. Coloque o token no `.env` do projeto (nunca commite o `.env`):
   ```env
   HUBSPOT_PRIVATE_APP_ACCESS_TOKEN=seu_token_aqui
   ```
2. Em **Tools & MCP**, edite o servidor **hubspot** e use:
   - **Type**: Command.
   - **Command**: `npx`
   - **Args**: `-y`, `@hubspot/mcp-server`
   - **Env** (variáveis de ambiente):
     - Nome: `PRIVATE_APP_ACCESS_TOKEN`
     - Valor: `${env:HUBSPOT_PRIVATE_APP_ACCESS_TOKEN}`  
       (ou o nome da variável que você definiu no .env / no sistema)

Assim o Cursor usa o **token** em vez de OAuth. Não precisa de Redirect URL nem do MCP Auth App.

---

## Resumo

| O que você quer usar | Onde configurar no Cursor | O que usar no HubSpot |
|----------------------|---------------------------|------------------------|
| **App OAuth que você criou** | Novo servidor com **URL** `https://mcp.hubspot.com` (Streamable HTTP) e depois **Connect** | MCP Auth App (Client ID, Secret, Redirect URL) |
| **Token fixo, sem OAuth** | Servidor **command** `npx -y @hubspot/mcp-server` + env `PRIVATE_APP_ACCESS_TOKEN` | Private App → Access Token no .env |

Se o objetivo é usar **só** o app que você acabou de criar, use a **Opção 1** (URL `https://mcp.hubspot.com` e botão **Connect** em Tools & MCP).
