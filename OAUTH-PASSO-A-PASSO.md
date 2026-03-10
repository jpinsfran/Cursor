# Como criar e usar OAuth 2.0

Guia passo a passo para **criar** uma aplicação OAuth (obter client_id e client_secret) e **usar** no fluxo de login.

---

## Parte 1: Criar o app OAuth no provedor

Você precisa registrar sua aplicação no serviço que vai fazer o login (Google, GitHub, iFood, etc.). Cada um tem um “console” ou “developer panel”.

### Exemplo: Google

1. Acesse **[Google Cloud Console](https://console.cloud.google.com/)** e faça login.
2. Crie um projeto (ou escolha um existente).
3. Vá em **APIs e serviços** → **Credenciais**.
4. Clique em **+ Criar credenciais** → **ID do cliente OAuth**.
5. Tipo de aplicativo: **Aplicativo da Web**.
6. Nome: por exemplo `Nola Local`.
7. Em **URIs de redirecionamento autorizados**, adicione:
   - `http://localhost:3000/callback` (para desenvolvimento)
   - Em produção: `https://seudominio.com/callback`
8. Clique em **Criar**.
9. Copie o **ID do cliente** (`client_id`) e o **Segredo do cliente** (`client_secret`).  
   **Nunca** commite o `client_secret` no Git; use variáveis de ambiente.

### Exemplo: GitHub

1. Acesse **GitHub** → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. **Application name**: ex. `Nola`.
3. **Homepage URL**: ex. `http://localhost:3000`.
4. **Authorization callback URL**: `http://localhost:3000/callback`.
5. Registrar e anotar **Client ID** e **Client Secret**.

### Outros provedores (iFood, etc.)

O processo é o mesmo conceito:

- Criar um “app” ou “aplicação”.
- Definir **redirect_uri** (URL de callback), que deve ser **exatamente** a mesma que seu servidor usa.
- Obter **client_id** e **client_secret**.

---

## Parte 2: Fluxo OAuth (o que seu código faz)

Fluxo **Authorization Code** (recomendado para apps com backend):

```
1. Usuário clica "Login" no seu site
        ↓
2. Seu servidor redireciona para o provedor (Google, etc.)
   URL: authorizationEndpoint + ?client_id=...&redirect_uri=...&response_type=code&scope=...
        ↓
3. Usuário faz login no provedor e autoriza seu app
        ↓
4. Provedor redireciona de volta para: redirect_uri?code=XXX&state=YYY
        ↓
5. Seu servidor (rota /callback) recebe o "code"
        ↓
6. Seu servidor troca o "code" por access_token (e refresh_token)
   POST no tokenEndpoint com: code, client_id, client_secret, redirect_uri
        ↓
7. Com o access_token você chama a API do provedor em nome do usuário
```

---

## Parte 3: Usar o exemplo neste projeto

Foi criado o arquivo **`oauth-example.js`**, que implementa esse fluxo em Node.js puro (sem Express).

### 1. Configurar credenciais

No **`oauth-example.js`** as URLs e escopos estão configurados para **Google**. Ajuste se for outro provedor.

Defina as variáveis de ambiente (recomendado):

```bash
set OAUTH_CLIENT_ID=seu_client_id
set OAUTH_CLIENT_SECRET=seu_client_secret
node oauth-example.js
```

Ou edite no arquivo (só para teste local):

- `clientId`: seu Client ID
- `clientSecret`: seu Client Secret
- `redirectUri`: deve ser **igual** ao que você cadastrou no provedor (ex: `http://localhost:3000/callback`)

### 2. Rodar o servidor

```bash
node oauth-example.js
```

### 3. Abrir no navegador

Abra: **http://localhost:3000/login**

- Você será redirecionado para o provedor (ex.: Google).
- Faça login e autorize o app.
- Volta para `http://localhost:3000/callback` e o script mostra os tokens no **console** do Node e uma mensagem na página.

### 4. Usar o access_token

O objeto retornado na troca do `code` costuma ter:

- `access_token`: use no header `Authorization: Bearer <access_token>` nas chamadas à API do provedor.
- `refresh_token`: use para obter um novo `access_token` quando o atual expirar.
- `expires_in`: tempo de vida do `access_token` em segundos.

---

## Resumo: “como eu consigo criar o OAuth”

| O que você quer | O que fazer |
|-----------------|-------------|
| **Criar** o OAuth (ter client_id e client_secret) | Registrar um app no console do provedor (Google, GitHub, etc.) e definir o **redirect_uri**. |
| **Redirect URI** | URL para onde o provedor envia o usuário após o login; no exemplo é `http://localhost:3000/callback`. |
| **Usar** o OAuth no código | 1) Redirecionar para a URL de autorização; 2) Na rota de callback, trocar o `code` por tokens; 3) Usar o `access_token` nas APIs. |
| **Exemplo pronto** | Rodar `node oauth-example.js`, abrir `http://localhost:3000/login` e seguir o fluxo. |

Se disser qual provedor quer usar (Google, GitHub, iFood, outro), dá para ajustar o `oauth-example.js` com as URLs e escopos exatos.
