const fetch = require('node-fetch');
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const app = express();
const PORT = 3000;
const JWT_SECRET = 'Insinergia2025SuperSecretKey123!';

const dbConfig = {
    host: 'localhost',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'insinergia_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

const pool = mysql.createPool(dbConfig);

// Middleware
const authMiddleware = async (req, res, next) => {
    try {
        // 🔍 DEBUG COMPLETO
        console.log('🔍 Headers ricevuti:', req.headers.authorization?.substring(0, 50) + '...');
        
        let token = req.headers.authorization;
        if (!token) {
            console.log('❌ NO AUTH HEADER');
            return res.status(401).json({ error: 'Token mancante' });
        }
        
        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
            console.log('✅ Bearer rimosso, token:', token.substring(0, 20) + '...');
        }
        
        // ✅ VERIFY CON TRY-CATCH
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            console.log('✅ JWT verificato:', decoded);
        } catch (jwtError) {
            console.error('❌ JWT Error:', jwtError.message);
            return res.status(401).json({ error: 'Token invalido: ' + jwtError.message });
        }
        
        const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? AND attivo = 1', [decoded.id]);
        if (!rows[0]) {
            console.log('❌ Utente DB non trovato:', decoded.id);
            return res.status(401).json({ error: 'Utente non valido' });
        }
        
        req.user = rows[0];
        console.log('✅ AUTH OK:', req.user.username, req.user.ruolo);
        next();
        
    } catch (error) {
        console.error('❌ AuthMiddleware error:', error);
        res.status(401).json({ error: 'Auth fallita' });
    }
};

const adminOnlyMiddleware = (req, res, next) => {
    if (req.user.ruolo !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    next();
};

app.post('/api/admin/users', authMiddleware, adminOnlyMiddleware, async (req, res) => {
    try {
        const { username, email, nome, password } = req.body;
        const hashedPassword = await bcrypt.hash(password || 'Password123!', 10);

        await pool.execute(
            'INSERT INTO users (username, email, nome, password, ruolo) VALUES (?, ?, ?, ?, "medico")',
            [username, email, nome, hashedPassword]
        );

        res.status(201).json({ message: 'Medico creato' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username o email già esistente' });
        }
        res.status(500).json({ error: 'Errore server' });
    }
});

// 🧪 TEST
app.get('/api/test', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));
const DEFAULT_AVATAR = 'public/img/default-avatar.png';

// 🔐 LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('🔐 Login:', username);
        
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE (username = ? OR email = ?) AND attivo = 1', 
            [username, username]
        );
        
        if (!rows[0]) return res.status(401).json({ error: 'Credenziali errate' });
        const user = rows[0];
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Credenziali errate' });
        
        const token = jwt.sign({ id: user.id, ruolo: user.ruolo }, JWT_SECRET, { expiresIn: '7d' });
        
        console.log('✅ Login OK:', user.username);
        res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            nome: user.nome,
            ruolo: user.ruolo,
            avatar: user.avatar || DEFAULT_AVATAR  // ← fallback
        }
    });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Errore server' });
    }
});

// 📊 STATS
app.get('/api/stats', authMiddleware, async (req, res) => {
    console.log('Stats req.user:', req.user);
    try {
        const where = req.user.ruolo === 'admin' ? '' : 'WHERE medico_id = ?';
        const params = req.user.ruolo === 'admin' ? [] : [req.user.id];
        
        const [stats] = await pool.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN stato = 'attivo' THEN 1 ELSE 0 END) as attivi,
                SUM(CASE WHEN stato = 'in_sospeso' THEN 1 ELSE 0 END) as sospesi
            FROM patients ${where}`, params);
        
        res.json(stats[0] || { total: 0, attivi: 0, sospesi: 0 });
    } catch (error) {
        console.error('❌ Stats error:', error);
        return res.status(500).json({ error: 'Errore stats' });
        res.status(500).json({ error: 'Errore stats' });
    }
});

// 👥 PAZIENTI - FIX DEFINITIVO
app.get('/api/patients', authMiddleware, async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * parseInt(limit);
        
        let whereClause = req.user.ruolo === 'admin' ? 'WHERE 1=1' : 'WHERE medico_id = ?';
        let params = req.user.ruolo === 'admin' ? [] : [req.user.id];
        
        if (search) {
            whereClause += ' AND (nome LIKE ? OR cognome LIKE ? OR codice_univoco LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        // COUNT
        const countQuery = `SELECT COUNT(*) as total FROM patients ${whereClause}`;
        const [countResult] = await pool.execute(countQuery, params);
        
        // PAZIENTI - LIMIT/OFFSET INTERPOLATI
        const limitClause = `LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
        const patientQuery = `SELECT * FROM patients ${whereClause} ORDER BY created_at DESC ${limitClause}`;
        
        console.log('🔍 COUNT:', countQuery, params);
        console.log('🔍 PATIENTS:', patientQuery);
        
        const [patients] = await pool.execute(patientQuery, params);
        
        res.json({ 
            patients, 
            pagination: { 
                page: parseInt(page), 
                limit: parseInt(limit), 
                total: parseInt(countResult[0].total) 
            } 
        });
        
    } catch (error) {
        console.error('❌ Patients error:', error);
        res.status(500).json({ error: 'Errore pazienti', details: error.message });
    }
});

app.get('/api/patients/:id', authMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        const [rows] = await pool.execute(
            'SELECT * FROM patients WHERE id = ?',
            [id]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Paziente non trovato' });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error('❌ Errore GET /api/patients/:id', err);
        return res.status(500).json({ error: 'Errore caricamento paziente' });
    }
});


// ➕ CREA PAZIENTE
app.post('/api/patients', authMiddleware, async (req, res) => {
    try {
        const medicoId = req.user.ruolo === 'admin'
            ? (req.body.medico_id || req.user.id)
            : req.user.id;

        const [last] = await pool.execute(
            'SELECT codice_univoco FROM patients WHERE medico_id = ? ORDER BY id DESC LIMIT 1',
            [medicoId]
        );
        const num = last.length ? parseInt(last[0].codice_univoco.slice(3)) + 1 : 1;
        const codice_univoco = `PAT${num.toString().padStart(3, '0')}`;

        const {
            nome,
            cognome,
            data_nascita,
            sesso,
            luogo_nascita,
            codice_fiscale,
            indirizzo,
            provincia_residenza,
            comune_residenza,
            telefono,
            email,
            note
        } = req.body;

        const [result] = await pool.execute(
            `INSERT INTO patients
             (codice_univoco, medico_id, nome, cognome, data_nascita, sesso,
              luogo_nascita, codice_fiscale, indirizzo, provincia_residenza,
              comune_residenza, telefono, email, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              codice_univoco,
              medicoId,
              nome || null,
              cognome || null,
              data_nascita || null,
              sesso || null,
              luogo_nascita || null,
              codice_fiscale || null,
              indirizzo || null,
              provincia_residenza || null,
              comune_residenza || null,
              telefono || null,
              email || null,
              note || null
            ]
        );

        console.log('✅ Paziente creato:', codice_univoco);
        res.status(201).json({ id: result.insertId, codice_univoco });
    } catch (error) {
        console.error('❌ Create patient:', error);
        res.status(500).json({ error: 'Errore creazione' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📊 Test: http://localhost:${PORT}/api/test`);
});

const storageProfileUpload = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const patientId = req.params.id;
      if (!patientId) {
        console.error('destination: patientId mancante', req.params);
        return cb(new Error('patientId mancante'));
      }

      const dir = path.join(__dirname, 'uploads', 'patients', String(patientId));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      console.error('Errore in destination storageProfileUpload:', err);
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    try {
      if (!file || !file.originalname) {
        console.error('filename: file.originalname mancante', file);
        return cb(new Error('Nome file mancante'));
      }
      const ext = path.extname(file.originalname);
      const base = req.body.tipo || 'doc';
      cb(null, `${base}-${Date.now()}${ext}`);
    } catch (err) {
      console.error('Errore in filename storageProfileUpload:', err);
      cb(err);
    }
  }
});

const upload = multer({ storage: storageProfileUpload });

// Storage avatar utente
const avatarStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join('uploads', 'avatars', String(req.user.id));
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'avatar' + ext);
    }
});
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: MAX_AVATAR_SIZE },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Sono consentiti solo file immagine'));
        }
        cb(null, true);
    }
});

// GET profilo
app.get('/api/me', authMiddleware, async (req, res) => {
    const { id, username, email, nome, ruolo, avatar, created_at } = req.user;
    res.json({
        id,
        username,
        email,
        nome,
        ruolo,
        avatar: avatar || DEFAULT_AVATAR,  // ← fallback
        created_at
    });
});

// PUT profilo base
app.put('/api/me', authMiddleware, async (req, res) => {
    try {
        const { nome, email } = req.body;
        if (!nome || !email) {
            return res.status(400).json({ error: 'Nome ed email sono obbligatori' });
        }
        await pool.execute(
            'UPDATE users SET nome = ?, email = ? WHERE id = ?',
            [nome, email, req.user.id]
        );
        res.json({ message: 'Profilo aggiornato' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email già in uso' });
        }
        res.status(500).json({ error: 'Errore aggiornamento profilo' });
    }
});

// PUT password
app.put('/api/me/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Compila tutti i campi' });
        }
        const valid = await bcrypt.compare(currentPassword, req.user.password);
        if (!valid) {
            return res.status(400).json({ error: 'Password attuale errata' });
        }
        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
        res.json({ message: 'Password aggiornata' });
    } catch {
        res.status(500).json({ error: 'Errore aggiornamento password' });
    }
});

// POST avatar
app.post('/api/me/avatar', authMiddleware, (req, res) => {
    uploadAvatar.single('avatar')(req, res, async (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'L\'immagine non può superare 2 MB' });
            }
            return res.status(400).json({ error: err.message || 'Errore upload' });
        }
        if (!req.file) return res.status(400).json({ error: 'File mancante' });

        const filePath = req.file.path.replace(/\\/g, '/');
        await pool.execute('UPDATE users SET avatar = ? WHERE id = ?', [filePath, req.user.id]);
        res.json({ message: 'Avatar aggiornato', avatar: filePath });
    });
});

app.put('/api/me/avatar', authMiddleware, async (req, res) => {
    try {
        const { avatar } = req.body;
        if (!avatar) return res.status(400).json({ error: 'Avatar mancante' });

        await pool.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id]);
        res.json({ message: 'Avatar aggiornato', avatar });
    } catch {
        res.status(500).json({ error: 'Errore aggiornamento avatar' });
    }
});

app.post('/api/codice-fiscale', authMiddleware, async (req, res) => {
    try {
        const { nome, cognome, data_nascita, sesso, comune, provincia_residenza } = req.body;

        if (!nome || !cognome || !data_nascita || !sesso || !comune) {
            return res.status(400).json({ error: 'Dati insufficienti' });
        }

        const [anno, mese, giorno] = data_nascita.split('-');

        const params = new URLSearchParams({
            lname: cognome,
            fname: nome,
            gender: sesso,                         // "M"/"F"
            city: comune,
            state: provincia_residenza || '',
            abolished: '0',
            day: giorno,
            month: mese,
            year: anno,
            omocodia_level: '0',
            access_token: '610c91d1d068be892bc2c54531bccbb710571666d8582a89880c2b9b5b3739065267'
        });

        const url = 'http://api.miocodicefiscale.com/calculate?' + params.toString();

        const apiRes = await fetch(url);
        const text = await apiRes.text();
        console.log('MioCodiceFiscale raw response:', apiRes.status, text);

        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('Errore parsing JSON CF:', e);
        }
        console.log('MioCodiceFiscale parsed:', data);
        if (!apiRes.ok || data.status === false) {
            return res.status(502).json({ error: data.message || 'Errore servizio codice fiscale' });
        }

        // SCEGLI il campo giusto in base a ciò che vedi in console
        const codiceFiscale = data.data.cf;
        console.log('Codice fiscale estratto:', codiceFiscale);

        if (!codiceFiscale) {
            return res.status(500).json({ error: 'CF non presente nella risposta API' });
        }

        // ⬅️ IMPORTANTISSIMO: struttura identica al test
        return res.json({ codice_fiscale: codiceFiscale });
    } catch (err) {
        console.error('Errore proxy CF:', err);
        return res.status(500).json({ error: 'Errore interno generazione CF' });
    }
});

async function logPatientChange(patientId, before, after, userId) {
    const fields = [
        'nome','cognome','data_nascita','sesso','luogo_nascita',
        'codice_fiscale','indirizzo','comune_residenza',
        'provincia_residenza','telefono','email','note'
    ];

    const changes = [];
    for (const field of fields) {
        const oldVal = before[field] == null ? null : String(before[field]);
        const newVal = after[field] == null ? null : String(after[field]);
        if (oldVal !== newVal) {
            changes.push([patientId, userId, field, oldVal, newVal]);
        }
    }

    if (!changes.length) return;

    const placeholders = changes.map(() => '(?,?,?,?,?)').join(',');
    const flatValues = changes.flat();

    await pool.execute(
        `INSERT INTO patient_logs (patient_id, user_id, field, old_value, new_value)
         VALUES ${placeholders}`,
        flatValues
    );
}

app.put('/api/patients/:id', authMiddleware, async (req, res) => {
    const id = req.params.id;
    const user = req.user; // impostato da authMiddleware

    const {
        nome,
        cognome,
        data_nascita,
        sesso,
        luogo_nascita,
        codice_fiscale,
        indirizzo,
        comune_residenza,
        provincia_residenza,
        telefono,
        email,
        note
    } = req.body;

    if (!nome || !cognome) {
        return res.status(400).json({ error: 'Nome e cognome sono obbligatori' });
    }

    try {
        // Leggi stato attuale per log diff
        const [rows] = await pool.execute('SELECT * FROM patients WHERE id = ?', [id]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Paziente non trovato' });
        }
        const before = rows[0];

        await pool.execute(
            `UPDATE patients SET
                nome = ?, cognome = ?, data_nascita = ?, sesso = ?,
                luogo_nascita = ?, codice_fiscale = ?, indirizzo = ?,
                comune_residenza = ?, provincia_residenza = ?, telefono = ?,
                email = ?, note = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                nome,
                cognome,
                data_nascita,
                sesso,
                luogo_nascita,
                codice_fiscale,
                indirizzo,
                comune_residenza,
                provincia_residenza,
                telefono,
                email,
                note,
                id
            ]
        );

        // Rileggi record aggiornato
        const [rowsAfter] = await pool.execute('SELECT * FROM patients WHERE id = ?', [id]);
        const after = rowsAfter[0];

        // Log modifica (vedi sezione successiva)
        await logPatientChange(id, before, after, user.id);

        return res.json(after);
    } catch (err) {
        console.error('❌ Errore update paziente:', err);
        return res.status(500).json({ error: 'Errore aggiornamento paziente' });
    }
});

app.get('/api/patients/:id/logs', authMiddleware, async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await pool.execute(
            `SELECT l.*, u.nome AS user_nome, u.username
             FROM patient_logs l
             JOIN users u ON u.id = l.user_id
             WHERE l.patient_id = ?
             ORDER BY l.created_at DESC`,
            [id]
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Errore logs paziente:', err);
        res.status(500).json({ error: 'Errore caricamento log' });
    }
});

app.post('/api/patients/:id/documents',
  authMiddleware,
  upload.single('file'),
  async (req, res) => {
    const patientId = req.params.id;
    const userId = req.user.id;
    const tipo = req.body.tipo;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato' });
      }

      if (!['carta_identita', 'tessera_sanitaria', 'analisi_csv'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo documento non valido' });
      }

      const relativePath = path.join(
        'uploads',
        'patients',
        String(patientId),
        req.file.filename
      ).replace(/\\/g, '/');

      // 1) Salvo il documento
      const [docResult] = await pool.execute(
        `INSERT INTO patient_documents (patient_id, user_id, tipo, file_path)
         VALUES (?, ?, ?, ?)`,
        [patientId, userId, tipo, relativePath]
      );

          // 2) CSV ANALISI

    const fullPath = path.join(__dirname, relativePath);
    
let analyses = [];
if (tipo === 'analisi_csv') {
  try {
    analyses = await parseLabCsvAndDetectAnomalies(fullPath, LAB_REFERENCE_RANGES);
  } catch (err) {
    console.error('Errore parsing CSV analisi:', err);
  }
}

      // 3) Scrivo il log
      const tipoLabel = tipo === 'carta_identita'
          ? "Carta d'identità"
          : 'Tessera sanitaria';

        await pool.execute(
          `INSERT INTO patient_logs (patient_id, user_id, field, old_value, new_value, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            patientId,
            userId,
            'document_upload',                     // field
            null,                                  // old_value
            `${tipoLabel} - ${relativePath}`       // new_value
          ]
        );

      // 4) Risposta al client
      return res.json({
        ok: true,
        file_path: relativePath,
        document_id: docResult.insertId
      });
    } catch (err) {
      console.error('Errore upload documento paziente:', err);
      return res.status(500).json({ error: 'Errore salvataggio documento' });
    }
  }
);

app.get('/api/patient-documents/:id', authMiddleware, async (req, res) => {
  const docId = req.params.id;

  try {
    const [rows] = await pool.execute(
      `SELECT d.*, u.nome AS user_nome, u.username
       FROM patient_documents d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [docId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('Errore get patient document:', err);
    return res.status(500).json({ error: 'Errore caricamento documento' });
  }
});

app.get('/api/patients/:id/documents', authMiddleware, async (req, res) => {
  const patientId = req.params.id;
  try {
    const [rows] = await pool.execute(
      `SELECT d.*, u.nome AS user_nome, u.username
       FROM patient_documents d
       JOIN users u ON u.id = d.user_id
       WHERE d.patient_id = ?
       ORDER BY d.created_at DESC`,
      [patientId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Errore get documenti paziente:', err);
    res.status(500).json({ error: 'Errore caricamento documenti' });
  }
});

const LAB_REFERENCE_RANGES = {
'Emoglobina': { min: 12, max: 16 },
'Glicemia': { min: 70, max: 99 },
'GOT (AST)': { min: 10, max: 40 },
'GPT (ALT)': { min: 10, max: 40 },
'TSH': { min: 0.4, max: 4.5 },
'Creatinina': { min: 0.6, max: 1.2 }
  // …
};

app.get(
  '/api/patient-documents/:documentId/analyses',
  authMiddleware,
  async (req, res) => {
    const documentId = req.params.documentId;

    try {
      const [rows] = await pool.execute(
        `SELECT d.*
         FROM patient_documents d
         WHERE d.id = ? AND d.tipo = 'analisi_csv'`,
        [documentId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Documento analisi non trovato' });
      }

      const doc = rows[0];
      const fileFullPath = path.join(__dirname, doc.file_path);

      const analyses = await parseLabCsvAndDetectAnomalies(
        fileFullPath,
        LAB_REFERENCE_RANGES
      );

      return res.json({ ok: true, analyses });
    } catch (err) {
      console.error('Errore get analisi documento:', err);
      return res.status(500).json({ error: 'Errore lettura analisi' });
    }
  }
);

// Analisi CSV
async function parseLabCsvAndDetectAnomalies(fileFullPath, referenceRanges) {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(fileFullPath)
      .pipe(csv({ separator: ';' })) // o ',' in base al tuo formato
      .on('data', (row) => {
        const testName = (row.esame || row.exam || '').trim();
        const value = parseFloat(row.valore || row.value);
        const unit = (row.unita || row.unit || '').trim();

        const ref = referenceRanges[testName];
        let flag = 'normal';

        if (ref && !isNaN(value)) {
          if (value < ref.min || value > ref.max) {
            flag = 'abnormal';
          }
        }

        results.push({ testName, value, unit, flag });
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}
