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
// POST /api/patients/:id/logs
app.post('/api/patients/:id/logs', authMiddleware, async (req, res) => {
    const patientId = req.params.id;
    const userId = req.user.id; // Dall'authMiddleware
    const { field, old_value, new_value } = req.body;
    
    try {
        await pool.execute(
            `INSERT INTO patient_logs (patient_id, user_id, field, old_value, new_value, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [patientId, userId, field, old_value, new_value]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Errore creazione log:', err);
        res.status(500).json({ error: 'Errore creazione log' });
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
        res.json({ data: rows });
    } catch (err) {
        console.error('❌ Errore logs paziente:', err);
        res.status(500).json({ error: 'Errore caricamento log' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📄 GET DOCUMENTI PAZIENTE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get('/api/patients/:patientId/documents', authMiddleware, async (req, res) => {
    const patientId = req.params.patientId;
    console.log('🔍 GET /api/patients/:patientId/documents - patientId:', patientId);
    
    try {
        const [rows] = await pool.execute(
            `SELECT d.*, u.nome AS user_nome, u.username
             FROM patient_documents d
             LEFT JOIN users u ON u.id = d.user_id
             WHERE d.patient_id = ?
             ORDER BY d.created_at DESC`,
            [patientId]
        );
        
        console.log('📄 Documenti trovati:', rows.length);
        if (rows.length > 0) {
            console.log('✅ Primo documento:', rows[0]);
        }
        
        res.json({ data: rows });
    } catch (err) {
        console.error('❌ Errore get documenti paziente:', err);
        res.status(500).json({ error: 'Errore caricamento documenti', details: err.message });
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

// CONFIGURAZIONE MULTER
const uploadsDir = path.join(__dirname, 'uploads/patients');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const patientId = req.params.id;
        const patientDir = path.join(__dirname, 'uploads/patients', String(patientId));
        
        // Crea la cartella se non esiste
        if (!fs.existsSync(patientDir)) {
            fs.mkdirSync(patientDir, { recursive: true });
        }
        
        cb(null, patientDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `doc-${Date.now()}`;
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo .png, .jpg e .pdf sono consentiti'), false);
    }
};

const uploadMiddleware = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// POST UPLOAD DOCUMENTO
app.post('/api/patients/:id/documents', authMiddleware, uploadMiddleware.single('file'), async (req, res) => {
    const patientId = req.params.id;
    const userId = req.user.id;
    const { tipo, descrizione } = req.body;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File mancante' });
        }

        if (!tipo || !['ID', 'Codice Fiscale', 'Altro'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo documento non valido' });
        }

        if (tipo === 'Altro' && !descrizione) {
            return res.status(400).json({ error: 'Descrizione richiesta per "Altro"' });
        }

        // Crea la cartella del paziente se non esiste
        const patientDir = path.join(__dirname, 'uploads/patients', String(patientId));
        if (!fs.existsSync(patientDir)) {
            fs.mkdirSync(patientDir, { recursive: true });
        }

        // Crea il nome file
        const newFileName = `doc-${Date.now()}${path.extname(req.file.originalname)}`;
        const filePath = `uploads/patients/${patientId}/${newFileName}`;

        // ✅ Se tipo è "Altro", concatena la descrizione
        let tipoFinale = tipo;
        if (tipo === 'Altro' && descrizione) {
            tipoFinale = `Altro - ${descrizione}`;
        }

        // Salva nel database
        const result = await pool.execute(
            `INSERT INTO patient_documents (patient_id, tipo, file_path, file_name, user_id, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [patientId, tipoFinale, filePath, req.file.originalname, userId]
        );

        console.log('✅ Documento caricato:', result[0].insertId, 'Tipo:', tipoFinale);

        res.json({ 
            success: true, 
            id: result[0].insertId,
            file_path: filePath,
            file_name: req.file.originalname,
            tipo: tipoFinale
        });
    } catch (err) {
        console.error('❌ Errore upload documento:', err);
        res.status(500).json({ error: 'Errore caricamento documento', details: err.message });
    }
});

app.get('/api/documents/:id/view', authMiddleware, async (req, res) => {
    const docId = req.params.id;
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM patient_documents WHERE id = ?`,
            [docId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Documento non trovato' });
        }

        const doc = rows[0];
        console.log('📄 Documento trovato:', doc.file_path);

        // Il file_path contiene già il percorso completo relativo (es: uploads/patients/2/doc.csv)
        // Usa il percorso così com'è
        let filePath = doc.file_path;
        
        // Se non inizia con 'uploads/', aggiungi il percorso completo
        if (!filePath.startsWith('uploads/')) {
            filePath = path.join('uploads/documents', path.basename(filePath));
        }
        
        // Crea il percorso assoluto
        const fullPath = path.join(__dirname, filePath);
        
        console.log('📁 Full path:', fullPath);
        console.log('✅ File exists:', fs.existsSync(fullPath));

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File non trovato', path: fullPath });
        }

        // Determina il MIME type
        const ext = path.extname(fullPath).toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === '.pdf') mimeType = 'application/pdf';
        if (ext === '.png') mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        if (ext === '.csv') mimeType = 'text/csv';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', 'inline; filename=' + (doc.file_name || 'documento'));
        
        fs.createReadStream(fullPath).pipe(res);
    } catch (err) {
        console.error('❌ Errore visualizzazione documento:', err);
        res.status(500).json({ error: 'Errore visualizzazione documento' });
    }
});

// DELETE DOCUMENTO
app.delete('/api/documents/:id', authMiddleware, async (req, res) => {
    const docId = req.params.id;
    const userId = req.user.id;

    try {
        const [rows] = await pool.execute(
            `SELECT * FROM patient_documents WHERE id = ?`,
            [docId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Documento non trovato' });
        }

        const docData = rows[0];
        const filePath = path.join(__dirname, 'uploads/patients', path.basename(docData.file_path));

        // Elimina dal database
        await pool.execute(
            `DELETE FROM patient_documents WHERE id = ?`,
            [docId]
        );

        // Elimina il file fisico
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Crea log
        await createLogEntry(docData.patient_id, userId, 'documento_eliminato', docData.tipo, null);

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Errore eliminazione documento:', err);
        res.status(500).json({ error: 'Errore eliminazione documento' });
    }
});

// HELPER FUNCTION per i log
async function createLogEntry(patientId, userId, action, oldValue, newValue) {
    try {
        await pool.execute(
            `INSERT INTO patient_logs (patient_id, user_id, field, old_value, new_value, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [patientId, userId, action, oldValue, newValue]
        );
    } catch (err) {
        console.error('Errore creazione log:', err);
    }
}

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
// GET singola analisi
app.get('/api/patients/:patientId/analyses/:analysisId', authMiddleware, async (req, res) => {
    const { patientId, analysisId } = req.params;
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM patient_analyses WHERE id = ? AND patient_id = ?`,
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

// GET valori analisi
app.get('/api/analyses/:analysisId/values', authMiddleware, async (req, res) => {
    const { analysisId } = req.params;
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM analysis_values 
             WHERE analysis_id = ? 
             ORDER BY test_name ASC`,
            [analysisId]
        );

        res.json({ data: rows });
    } catch (err) {
        console.error('❌ Errore get valori analisi:', err);
        res.status(500).json({ error: 'Errore caricamento valori' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧬 ANALYSES CSV UPLOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Funzione per ottenere i range di riferimento
async function getReferenceRange(testName, sesso) {
    const [rows] = await pool.execute(
        `SELECT reference_min, reference_max, unit 
         FROM lab_reference_ranges 
         WHERE test_name = ? AND sesso = ?`,
        [testName, sesso]
    );
    
    return rows[0] || null;
}

// Nel parsing del CSV
app.post('/api/patients/:patientId/analyses', authMiddleware, uploadMiddleware.single('file'), async (req, res) => {
    const patientId = req.params.patientId;
    const userId = req.user.id;
    const { tipo } = req.body;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File mancante' });
        }

        // ✅ Leggi il sesso del paziente
        const [patientRows] = await pool.execute(
            `SELECT sesso FROM patients WHERE id = ?`,
            [patientId]
        );

        if (!patientRows.length) {
            return res.status(404).json({ error: 'Paziente non trovato' });
        }

        const sesso = patientRows[0].sesso;
        console.log('👥 Sesso paziente:', sesso);

        // Crea la cartella del paziente se non esiste
        const patientDir = path.join(__dirname, 'uploads/patients', String(patientId));
        if (!fs.existsSync(patientDir)) {
            fs.mkdirSync(patientDir, { recursive: true });
        }

        // Crea il nome file
        const newFileName = `analysis-${Date.now()}${path.extname(req.file.originalname)}`;
        const filePath = `uploads/patients/${patientId}/${newFileName}`;
        const fullFilePath = path.join(patientDir, newFileName);

        // Sposta il file
        fs.renameSync(req.file.path, fullFilePath);

        // Salva nel database l'analisi
        const [analysisResult] = await pool.execute(
            `INSERT INTO patient_analyses (patient_id, tipo, file_path, file_name, user_id, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [patientId, tipo, filePath, req.file.originalname, userId]
        );

        const analysisId = analysisResult.insertId;

        // ✅ Parsa il CSV e inserisci i valori con riferimenti in base al sesso
        await parseAnalysisCSV(fullFilePath, analysisId, patientId, sesso);

        console.log('✅ Analisi caricata:', analysisId);

        res.json({ 
            success: true, 
            id: analysisId,
            file_path: filePath,
            file_name: req.file.originalname,
            tipo: tipo,
            sesso: sesso
        });
    } catch (err) {
        console.error('❌ Errore upload analisi:', err);
        res.status(500).json({ error: 'Errore caricamento analisi', details: err.message });
    }
});

async function parseAnalysisCSV(filePath, analysisId, patientId, sesso) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv({ separator: ';' }))
            .on('data', async (row) => {
                const testName = (row.esame || row.test || row.test_name || '').trim();
                const value = parseFloat(row.valore || row.value);
                const unit = (row.unita || row.unit || '').trim();

                if (!testName || isNaN(value)) return;

                // ✅ Ottieni i riferimenti in base al sesso
                const reference = await getReferenceRange(testName, sesso);

                let isAbnormal = false;
                let flag = 'N'; // Normal

                if (reference) {
                    if (value < reference.reference_min) {
                        isAbnormal = true;
                        flag = 'L'; // Low
                    } else if (value > reference.reference_max) {
                        isAbnormal = true;
                        flag = 'H'; // High
                    }
                }

                // Salva nel database
                await pool.execute(
                    `INSERT INTO analysis_values 
                     (analysis_id, patient_id, test_name, value, unit, reference_min, reference_max, is_abnormal, flag)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        analysisId,
                        patientId,
                        testName,
                        value,
                        unit,
                        reference?.reference_min || null,
                        reference?.reference_max || null,
                        isAbnormal,
                        flag
                    ]
                );
            })
            .on('end', () => resolve())
            .on('error', reject);
    });
}

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