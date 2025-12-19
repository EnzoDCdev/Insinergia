// ✅ SERVER.JS RICOMPILATO E PULITO

require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'Insinergia2025-SecretKey-ChangeInProduction-12345';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MIDDLEWARE GLOBALI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

const DEFAULT_AVATAR = 'public/img/default-avatar.png';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH MIDDLEWARE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const authMiddleware = async (req, res, next) => {
    try {
        let token = req.headers.authorization;
        
        if (!token) {
            console.log('❌ NO AUTH HEADER');
            return res.status(401).json({ error: 'Token mancante' });
        }
        
        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }
        
        console.log('🔍 Verifying token:', token.substring(0, 20) + '...');
        
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
    if (req.user.ruolo !== 'admin') {
        return res.status(403).json({ error: 'Solo admin' });
    }
    next();
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ LOGIN ENDPOINT UNICO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.post('/api/auth/login', async (req, res) => {
    try {
        const { emailOrUsername, password } = req.body;

        if (!emailOrUsername || !password) {
            return res.status(400).json({ 
                message: 'Username/Email e password richiesti' 
            });
        }

        console.log('🔐 Login attempt:', emailOrUsername);

        // Cerca per username O email
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE (username = ? OR email = ?) AND attivo = 1', 
            [emailOrUsername, emailOrUsername]
        );
        
        if (!rows[0]) {
            console.log('❌ Utente non trovato:', emailOrUsername);
            return res.status(401).json({ 
                message: 'Credenziali non valide' 
            });
        }

        const user = rows[0];

        // Verifica password
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            console.log('❌ Password errata per:', emailOrUsername);
            return res.status(401).json({ 
                message: 'Credenziali non valide' 
            });
        }

        // Genera JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, ruolo: user.ruolo },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('✅ Login OK:', user.username);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                nome: user.nome,
                cognome: user.cognome,
                ruolo: user.ruolo,
                avatar: user.avatar || DEFAULT_AVATAR
            }
        });
    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({ message: 'Errore server' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧪 TEST ENDPOINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get('/api/test', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 STATS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get('/api/stats', authMiddleware, async (req, res) => {
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
    }
});

app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
    try {
        res.json({
            totalPatients: 42,
            todayAppointments: 5,
            pendingAnalyses: 3,
            abnormalResults: 1
        });
    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        res.status(500).json({ error: 'Errore dashboard' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👥 PAZIENTI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
        
        // PAZIENTI
        const limitClause = `LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
        const patientQuery = `SELECT * FROM patients ${whereClause} ORDER BY created_at DESC ${limitClause}`;
        const [patients] = await pool.execute(patientQuery, params);
        
        res.json({ 
            data: patients,
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

        return res.json({ data: rows[0] });
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
              codice_univoco, medicoId, nome || null, cognome || null,
              data_nascita || null, sesso || null, luogo_nascita || null,
              codice_fiscale || null, indirizzo || null, provincia_residenza || null,
              comune_residenza || null, telefono || null, email || null, note || null
            ]
        );

        console.log('✅ Paziente creato:', codice_univoco);
        res.status(201).json({ id: result.insertId, codice_univoco });
    } catch (error) {
        console.error('❌ Create patient:', error);
        res.status(500).json({ error: 'Errore creazione' });
    }
});

// 📝 UPDATE PAZIENTE
app.put('/api/patients/:id', authMiddleware, async (req, res) => {
    const id = req.params.id;

    const {
        nome, cognome, data_nascita, sesso, luogo_nascita, codice_fiscale,
        indirizzo, comune_residenza, provincia_residenza, telefono, email, note
    } = req.body;

    if (!nome || !cognome) {
        return res.status(400).json({ error: 'Nome e cognome sono obbligatori' });
    }

    try {
        const [rows] = await pool.execute('SELECT * FROM patients WHERE id = ?', [id]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Paziente non trovato' });
        }

        await pool.execute(
            `UPDATE patients SET
                nome = ?, cognome = ?, data_nascita = ?, sesso = ?,
                luogo_nascita = ?, codice_fiscale = ?, indirizzo = ?,
                comune_residenza = ?, provincia_residenza = ?, telefono = ?,
                email = ?, note = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                nome, cognome, data_nascita, sesso, luogo_nascita,
                codice_fiscale, indirizzo, comune_residenza, provincia_residenza,
                telefono, email, note, id
            ]
        );

        const [rowsAfter] = await pool.execute('SELECT * FROM patients WHERE id = ?', [id]);
        return res.json({ data: rowsAfter[0] });
    } catch (err) {
        console.error('❌ Errore update paziente:', err);
        return res.status(500).json({ error: 'Errore aggiornamento paziente' });
    }
});

// 📋 LOGS PAZIENTE
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
        res.json({ data: rows });
    } catch (err) {
        console.error('❌ Errore logs paziente:', err);
        res.status(500).json({ error: 'Errore caricamento log' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📄 DOCUMENTI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const storageProfileUpload = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            const patientId = req.params.id;
            if (!patientId) {
                return cb(new Error('patientId mancante'));
            }
            const dir = path.join(__dirname, 'uploads', 'patients', String(patientId));
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        } catch (err) {
            cb(err);
        }
    },
    filename: function (req, file, cb) {
        try {
            const ext = path.extname(file.originalname);
            const base = req.body.tipo || 'doc';
            cb(null, `${base}-${Date.now()}${ext}`);
        } catch (err) {
            cb(err);
        }
    }
});

const upload = multer({ storage: storageProfileUpload });

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

            const relativePath = path.join(
                'uploads',
                'patients',
                String(patientId),
                req.file.filename
            ).replace(/\\/g, '/');

            const [docResult] = await pool.execute(
                `INSERT INTO patient_documents (patient_id, user_id, tipo, file_path)
                 VALUES (?, ?, ?, ?)`,
                [patientId, userId, tipo, relativePath]
            );

            await pool.execute(
                `INSERT INTO patient_logs (patient_id, user_id, field, old_value, new_value)
                 VALUES (?, ?, ?, ?, ?)`,
                [patientId, userId, 'document_upload', null, `${tipo} - ${relativePath}`]
            );

            return res.json({
                ok: true,
                file_path: relativePath,
                document_id: docResult.insertId
            });
        } catch (err) {
            console.error('Errore upload documento:', err);
            return res.status(500).json({ error: 'Errore salvataggio documento' });
        }
    }
);

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
        res.json({ data: rows });
    } catch (err) {
        console.error('Errore get documenti paziente:', err);
        res.status(500).json({ error: 'Errore caricamento documenti' });
    }
});

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

        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('Errore get patient document:', err);
        return res.status(500).json({ error: 'Errore caricamento documento' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧬 ANALISI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const LAB_REFERENCE_RANGES = {
    'Emoglobina': { min: 12, max: 16 },
    'Glicemia': { min: 70, max: 99 },
    'GOT (AST)': { min: 10, max: 40 },
    'GPT (ALT)': { min: 10, max: 40 },
    'TSH': { min: 0.4, max: 4.5 },
    'Creatinina': { min: 0.6, max: 1.2 }
};

async function parseLabCsvAndDetectAnomalies(fileFullPath, referenceRanges) {
    return new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream(fileFullPath)
            .pipe(csv({ separator: ';' }))
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

app.get('/api/patient-documents/:documentId/analyses', authMiddleware, async (req, res) => {
    const documentId = req.params.documentId;

    try {
        const [rows] = await pool.execute(
            `SELECT d.* FROM patient_documents d
             WHERE d.id = ? AND d.tipo = 'analisi_csv'`,
            [documentId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Documento analisi non trovato' });
        }

        const doc = rows[0];
        const fileFullPath = path.join(__dirname, doc.file_path);

        const analyses = await parseLabCsvAndDetectAnomalies(fileFullPath, LAB_REFERENCE_RANGES);

        return res.json({ ok: true, data: analyses });
    } catch (err) {
        console.error('Errore get analisi documento:', err);
        return res.status(500).json({ error: 'Errore lettura analisi' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧬 ANALYSES ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - Lista analisi paziente
app.get('/api/patients/:patientId/analyses', authMiddleware, async (req, res) => {
    const patientId = req.params.patientId;
    try {
        const [rows] = await pool.execute(
            `SELECT a.* FROM analyses a
             WHERE a.patient_id = ?
             ORDER BY a.created_at DESC`,
            [patientId]
        );
        res.json({ data: rows });
    } catch (err) {
        console.error('❌ Errore get analisi paziente:', err);
        res.status(500).json({ error: 'Errore caricamento analisi' });
    }
});

// GET - Singola analisi
app.get('/api/patients/:patientId/analyses/:analysisId', authMiddleware, async (req, res) => {
    const { patientId, analysisId } = req.params;
    try {
        const [rows] = await pool.execute(
            `SELECT a.* FROM analyses a
             WHERE a.id = ? AND a.patient_id = ?`,
            [analysisId, patientId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Analisi non trovata' });
        }

        res.json({ data: rows[0] });
    } catch (err) {
        console.error('❌ Errore get analisi:', err);
        res.status(500).json({ error: 'Errore caricamento analisi' });
    }
});

// POST - Crea analisi
app.post('/api/patients/:patientId/analyses', authMiddleware, async (req, res) => {
    const patientId = req.params.patientId;
    const { tipo, valore, unita_misura, abnormal } = req.body;

    try {
        const [patient] = await pool.execute(
            'SELECT id FROM patients WHERE id = ?',
            [patientId]
        );

        if (!patient.length) {
            return res.status(404).json({ error: 'Paziente non trovato' });
        }

        const [result] = await pool.execute(
            `INSERT INTO analyses (patient_id, tipo, valore, unita_misura, abnormal)
             VALUES (?, ?, ?, ?, ?)`,
            [patientId, tipo, valore, unita_misura, abnormal || false]
        );

        console.log('✅ Analisi creata:', result.insertId);

        res.status(201).json({
            id: result.insertId,
            patient_id: patientId,
            tipo,
            valore,
            unita_misura,
            abnormal: abnormal || false
        });
    } catch (err) {
        console.error('❌ Errore creazione analisi:', err);
        res.status(500).json({ error: 'Errore creazione analisi' });
    }
});

// PUT - Aggiorna analisi
app.put('/api/patients/:patientId/analyses/:analysisId', authMiddleware, async (req, res) => {
    const { patientId, analysisId } = req.params;
    const { tipo, valore, unita_misura, abnormal } = req.body;

    try {
        const [analysis] = await pool.execute(
            'SELECT * FROM analyses WHERE id = ? AND patient_id = ?',
            [analysisId, patientId]
        );

        if (!analysis.length) {
            return res.status(404).json({ error: 'Analisi non trovata' });
        }

        await pool.execute(
            `UPDATE analyses SET tipo = ?, valore = ?, unita_misura = ?, abnormal = ?, created_at = NOW()
             WHERE id = ? AND patient_id = ?`,
            [tipo, valore, unita_misura, abnormal || false, analysisId, patientId]
        );

        console.log('✅ Analisi aggiornata:', analysisId);

        res.json({
            id: analysisId,
            patient_id: patientId,
            tipo,
            valore,
            unita_misura,
            abnormal: abnormal || false
        });
    } catch (err) {
        console.error('❌ Errore aggiornamento analisi:', err);
        res.status(500).json({ error: 'Errore aggiornamento analisi' });
    }
});

// DELETE - Cancella analisi
app.delete('/api/patients/:patientId/analyses/:analysisId', authMiddleware, async (req, res) => {
    const { patientId, analysisId } = req.params;

    try {
        const [analysis] = await pool.execute(
            'SELECT * FROM analyses WHERE id = ? AND patient_id = ?',
            [analysisId, patientId]
        );

        if (!analysis.length) {
            return res.status(404).json({ error: 'Analisi non trovata' });
        }

        await pool.execute(
            'DELETE FROM analyses WHERE id = ? AND patient_id = ?',
            [analysisId, patientId]
        );

        console.log('✅ Analisi eliminata:', analysisId);

        res.json({ message: 'Analisi eliminata' });
    } catch (err) {
        console.error('❌ Errore eliminazione analisi:', err);
        res.status(500).json({ error: 'Errore eliminazione analisi' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👤 PROFILO UTENTE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get('/api/me', authMiddleware, async (req, res) => {
    const { id, username, email, nome, cognome, ruolo, avatar, created_at } = req.user;
    res.json({
        data: {
            id, username, email, nome, cognome, ruolo,
            avatar: avatar || DEFAULT_AVATAR,
            created_at
        }
    });
});

app.put('/api/me', authMiddleware, async (req, res) => {
    try {
        const { nome, email, cognome } = req.body;
        if (!nome || !email) {
            return res.status(400).json({ error: 'Nome ed email sono obbligatori' });
        }
        await pool.execute(
            'UPDATE users SET nome = ?, email = ?, cognome = ? WHERE id = ?',
            [nome, email, cognome || null, req.user.id]
        );
        res.json({ message: 'Profilo aggiornato' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email già in uso' });
        }
        res.status(500).json({ error: 'Errore aggiornamento profilo' });
    }
});

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
    } catch (error) {
        res.status(500).json({ error: 'Errore aggiornamento password' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🏥 ADMIN - CREA UTENTE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.post('/api/admin/users', authMiddleware, adminOnlyMiddleware, async (req, res) => {
    try {
        const { username, email, nome, cognome, password } = req.body;
        const hashedPassword = await bcrypt.hash(password || 'Password123!', 10);

        await pool.execute(
            'INSERT INTO users (username, email, nome, cognome, password, ruolo, attivo) VALUES (?, ?, ?, ?, ?, "medico", 1)',
            [username, email, nome, cognome || null, hashedPassword]
        );

        res.status(201).json({ message: 'Medico creato' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username o email già esistente' });
        }
        res.status(500).json({ error: 'Errore server' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚀 START SERVER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.listen(PORT, () => {
    console.log(`\n🚀 SERVER INSINERGIA RUNNING`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🧪 Test: http://localhost:${PORT}/api/test`);
    console.log(`🔐 Login: POST /api/auth/login`);
    console.log(`\n`);
});