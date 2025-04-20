# 🛠️ Painel de Hospedagem - Backend

API robusta em **Node.js** com **Express** para gerenciar deploys de sites estáticos, autenticação via JWT, criptografia de senhas e banco de dados SQLite.

## ✨ Funcionalidades

- Autenticação JWT
- Criptografia de senhas com Bcrypt
- Upload de sites em .zip com descompactação
- Registro de deploys e falhas
- CRUD de usuários com proteção de rotas
- Registro de logs em SQLite
- Compatível com deploy estático em VPS

## 🚀 Tecnologias

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [SQLite3](https://www.sqlite.org/)
- [JWT](https://jwt.io/)
- [Bcrypt](https://github.com/kelektiv/node.bcrypt.js)
- [Multer](https://github.com/expressjs/multer)
- [Unzipper](https://www.npmjs.com/package/unzipper)

## 📦 Instalação

```bash
cd backend
npm install
npm run start
```

A API estará disponível em: [http://localhost:4000](http://localhost:4000)

## 🔐 Usuário Padrão

Email: `admin@painel.com`  
Senha: `123456`

## 📁 Estrutura de Pastas

- `sites/` → Onde os sites são extraídos (pasta criada automaticamente)
- `logs/` → Armazena logs de deploy
- `nginx-config/` → Gera os arquivos `.conf` do NGINX (modo local)
- `db.sqlite` → Banco de dados SQLite com tabelas de usuários, sites e logs

## 📝 Scripts

| Comando        | Descrição             |
|----------------|------------------------|
| `npm run start` | Inicia o servidor Node.js |