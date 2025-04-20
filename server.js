const express = require('express')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const multer = require('multer')
const cors = require('cors')
const unzipper = require('unzipper')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const sqlite3 = require('sqlite3').verbose()

const app = express()
const PORT = 4000
const BASE_PATH = path.join(__dirname, 'sites') // cria dentro da pasta do projeto
const LOG_PATH = path.join(__dirname, 'logs')
const SECRET = 'sua_chave_secreta_jwt' // Troque por uma chave segura

app.use(cors())
app.use(express.json())
fs.mkdirSync(LOG_PATH, { recursive: true })

// Banco SQLite
const db = new sqlite3.Database(path.join(__dirname, 'db.sqlite'))

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dominio TEXT UNIQUE,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS deploy_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dominio TEXT,
    status TEXT,
    mensagem TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  )`)

  const senhaHash = bcrypt.hashSync('123456', 10)
  db.run(`INSERT OR IGNORE INTO users (email, password) VALUES (?, ?)`, [
    'admin@painel.com',
    senhaHash,
  ])
})

function autenticarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return res.sendStatus(401)

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403)
    req.user = user
    next()
  })
}

app.post('/login', (req, res) => {
  const { email, password } = req.body

  db.get(
    `SELECT * FROM users WHERE email = ? LIMIT 1`,
    [email],
    (err, user) => {
      if (err || !user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).send('Credenciais inválidas')
      }

      const token = jwt.sign({ usuario: user.email }, SECRET, {
        expiresIn: '2h',
      })
      res.status(200).json({ token })
    }
  )
})

app.get('/usuarios', autenticarToken, (req, res) => {
  db.all(`SELECT id, email FROM users ORDER BY id ASC`, [], (err, rows) => {
    if (err) return res.status(500).send('Erro ao buscar usuários')
    res.json(rows)
  })
})

app.post('/usuarios', autenticarToken, (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).send('Campos obrigatórios')

  const hash = bcrypt.hashSync(password, 10)
  db.run(
    `INSERT INTO users (email, password) VALUES (?, ?)`,
    [email, hash],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE'))
          return res.status(409).send('Email já existe')
        return res.status(500).send('Erro ao criar usuário')
      }
      res.status(201).json({ id: this.lastID, email })
    }
  )
})

app.delete('/usuarios/:id', autenticarToken, (req, res) => {
  const { id } = req.params
  db.run(`DELETE FROM users WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).send('Erro ao deletar usuário')
    res.sendStatus(204)
  })
})

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dominio = req.body.dominio
    const destPath = path.join(BASE_PATH, dominio)
    fs.mkdirSync(destPath, { recursive: true })
    cb(null, destPath)
  },
  filename: (req, file, cb) => {
    cb(null, 'site.zip')
  },
})
const upload = multer({ storage })

function logDeployDB(dominio, status, mensagem = '') {
  db.run(
    `INSERT INTO deploy_logs (dominio, status, mensagem) VALUES (?, ?, ?)`,
    [dominio, status, mensagem]
  )
}

app.post(
  '/deploy',
  autenticarToken,
  upload.single('zipfile'),
  async (req, res) => {
    const dominio = req.body.dominio
    const sitePath = path.join(BASE_PATH, dominio)
    const zipPath = path.join(sitePath, 'site.zip')

    try {
      await fs
        .createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: sitePath }))
        .promise()
      fs.unlinkSync(zipPath)

      const nginxConf = `
server {
    listen 80;
    server_name ${dominio} www.${dominio};

    root ${sitePath};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}`
      const nginxDir = path.join(__dirname, 'nginx-config')
      fs.mkdirSync(nginxDir, { recursive: true })
      const confPath = path.join(nginxDir, `${dominio}.conf`)
      fs.writeFileSync(confPath, nginxConf)

      db.run(
        `INSERT INTO sites (dominio, status) VALUES (?, ?) ON CONFLICT(dominio) DO UPDATE SET status=excluded.status`,
        [dominio, 'Ativo']
      )

      logDeployDB(dominio, 'SUCESSO')
      res.send('Deploy realizado com sucesso!')
    } catch (error) {
      console.error('[ERRO NO DEPLOY]', error)
      logDeployDB(dominio, 'FALHA', error.message)
      res.status(500).send('Erro ao processar o deploy')
    }
  }
)

app.get('/logs/:dominio', autenticarToken, (req, res) => {
  const dominio = req.params.dominio
  db.all(
    `SELECT * FROM deploy_logs WHERE dominio = ? ORDER BY timestamp DESC`,
    [dominio],
    (err, rows) => {
      if (err) return res.status(500).send('Erro ao buscar logs')
      const formatted = rows
        .map(
          r =>
            `[${r.timestamp}] STATUS: ${r.status}${
              r.mensagem ? ' - ' + r.mensagem : ''
            }`
        )
        .join('\n')
      res.type('text/plain').send(formatted || 'Sem logs disponíveis')
    }
  )
})

app.get('/sites', autenticarToken, (req, res) => {
  db.all(`SELECT * FROM sites ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).send('Erro ao buscar sites')
    res.json(rows)
  })
})

app.listen(PORT, () => {
  console.log(`Painel backend rodando em http://localhost:${PORT}`)
})
