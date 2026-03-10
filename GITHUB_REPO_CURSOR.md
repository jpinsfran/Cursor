# Criar repositório "Cursor" no GitHub e enviar este projeto

## Passo 1: Criar o repositório no GitHub (site)

1. Acesse: **https://github.com/new**
2. **Repository name:** `Cursor`
3. **Description:** (opcional) Ex.: "Projeto Nola – scrapers, leads, automações"
4. Escolha **Public** (ou Private, se preferir).
5. **Não** marque "Add a README", "Add .gitignore" nem "Choose a license" (o projeto já tem conteúdo).
6. Clique em **Create repository**.

## Passo 2: Conectar este projeto e enviar (terminal)

No PowerShell, na pasta do projeto (`c:\Users\jpins\Documents\Nola`), rode:

```powershell
# Adicionar o remoto (troque SEU_USUARIO pelo seu login do GitHub)
git remote add origin https://github.com/SEU_USUARIO/Cursor.git

# Enviar o branch main
git push -u origin main
```

Se o GitHub pedir autenticação:
- **Senha:** use um **Personal Access Token** (não a senha da conta).
- Criar token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic). Marque pelo menos o escopo `repo`.

## Resumo

| O que              | Valor                          |
|--------------------|--------------------------------|
| Nome do repositório| `Cursor`                       |
| URL típica         | `https://github.com/SEU_USUARIO/Cursor` |
| Branch a enviar   | `main`                         |

Depois do primeiro `git push`, os próximos envios são só: `git push`.
