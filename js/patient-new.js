function debug(msg) {
    const box = document.getElementById('debug');
    if (box) {
        box.innerHTML += `<div>${new Date().toLocaleTimeString()} - ${msg}</div>`;
        box.scrollTop = box.scrollHeight;
    }
    console.log(msg);
}

function showToast(message, type='info') {
    const t = document.createElement('div');
    t.textContent = message;
    t.style.cssText = `
        position:fixed;top:20px;right:20px;padding:.7rem 1.3rem;
        border-radius:999px;color:#fff;font-size:.85rem;z-index:9999;
        background:${type==='success'?'#16a34a':'#dc2626'};
    `;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),2500);
}

/* ===================== CODICE FISCALE LOCALE ===================== */

async function calcolaCFConApi({ nome, cognome, dataNascita, sesso, comune }) {
    const res = await fetch('https://www.miocodicefiscale.com/api/codicefiscale', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': '610c91d1d068be892bc2c54531bccbb710571666d8582a89880c2b9b5b3739065267'
        },
        body: JSON.stringify({
            nome,
            cognome,
            sesso,                 // "M" / "F"
            giorno: dataNascita.split('-')[2],  // se usi yyyy-mm-dd
            mese: dataNascita.split('-')[1],
            anno: dataNascita.split('-')[0],
            comuneNascita: comune
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Errore API codice fiscale');
    }

    const data = await res.json();
    // Nella docs il campo CF è restituito come stringa (adatta al nome reale, es. data.codiceFiscale)
    return data.codiceFiscale;
}

// Dizionario di esempio (da completare)
let codiciCatastaliMap = {};

async function caricaCodiciCatastali() {
    try {
        const res = await fetch('data/codici-catastali.json');
        if (!res.ok) throw new Error('Impossibile caricare codici catastali');
        const comuni = await res.json();
        codiciCatastaliMap = {};
        comuni.forEach(c => {
            if (c.nome && c.codiceCatastale) {
                codiciCatastaliMap[c.nome.toUpperCase()] = c.codiceCatastale;
            }
        });
        debug('✅ Codici catastali caricati: ' + Object.keys(codiciCatastaliMap).length);
    } catch (err) {
        debug('❌ Errore caricamento codici catastali: ' + err.message);
        showToast('Errore caricamento codici catastali', 'error');
    }
}

function estraiConsonanti(str) {
    return str.replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/gi, '').toUpperCase();
}
function estraiVocali(str) {
    return str.replace(/[^AEIOU]/gi, '').toUpperCase();
}

function codificaCognome(cognome) {
    const cons = estraiConsonanti(cognome);
    const voc = estraiVocali(cognome);
    const base = (cons + voc + 'XXX').slice(0, 3);
    return base.toUpperCase();
}

function codificaNome(nome) {
    const cons = estraiConsonanti(nome);
    const voc = estraiVocali(nome);
    if (cons.length >= 4) {
        return (cons[0] + cons[2] + cons[3]).toUpperCase();
    }
    const base = (cons + voc + 'XXX').slice(0, 3);
    return base.toUpperCase();
}

function codificaDataESesso(dataNascita, sesso) {
    const [year, month, day] = dataNascita.split('-').map(Number);
    const yearCode = String(year).slice(-2);

    const mesi = ['A','B','C','D','E','H','L','M','P','R','S','T'];
    const monthCode = mesi[month - 1];

    let dayCode = day;
    if (sesso === 'F') dayCode = day + 40;
    const dayStr = String(dayCode).padStart(2, '0');

    return yearCode + monthCode + dayStr;
}

function codiceCatastale(comune) {
    const key = comune.trim().toUpperCase();
    return CODICI_CATASTALI[key] || null;
}

const ODD_TABLE = {
    '0': 1,'1': 0,'2': 5,'3': 7,'4': 9,'5': 13,'6': 15,'7': 17,'8': 19,'9': 21,
    'A': 1,'B': 0,'C': 5,'D': 7,'E': 9,'F': 13,'G': 15,'H': 17,'I': 19,'J': 21,
    'K': 2,'L': 4,'M': 18,'N': 20,'O': 11,'P': 3,'Q': 6,'R': 8,'S': 12,'T': 14,
    'U': 16,'V': 10,'W': 22,'X': 25,'Y': 24,'Z': 23
};
const EVEN_TABLE = {
    '0': 0,'1': 1,'2': 2,'3': 3,'4': 4,'5': 5,'6': 6,'7': 7,'8': 8,'9': 9,
    'A': 0,'B': 1,'C': 2,'D': 3,'E': 4,'F': 5,'G': 6,'H': 7,'I': 8,'J': 9,
    'K': 10,'L': 11,'M': 12,'N': 13,'O': 14,'P': 15,'Q': 16,'R': 17,'S': 18,'T': 19,
    'U': 20,'V': 21,'W': 22,'X': 23,'Y': 24,'Z': 25
};
const CONTROL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function calcolaCarattereControllo(base) {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
        const c = base[i].toUpperCase();
        if (i % 2 === 0) { // posizioni dispari 1,3... (0-based)
            sum += ODD_TABLE[c] || 0;
        } else {
            sum += EVEN_TABLE[c] || 0;
        }
    }
    return CONTROL_CHARS[sum % 26];
}

function generaCodiceFiscaleLocale({ nome, cognome, dataNascita, sesso, comune, codiceCatastale}) {
    const cognomeCode = codificaCognome(cognome);
    const nomeCode = codificaNome(nome);
    const dataSessoCode = codificaDataESesso(dataNascita, sesso);
    const comuneCode = codiceCatastale;

    if (!comuneCode) {
        debug('Comune non trovato nei codici catastali, uso Z999 di default');
        // fallback di emergenza
        const baseSenzaComune = (cognomeCode + nomeCode + dataSessoCode + 'Z999').toUpperCase();
        const controlCharFallback = calcolaCarattereControllo(baseSenzaComune);
        return baseSenzaComune + controlCharFallback;
    }

    const base = (cognomeCode + nomeCode + dataSessoCode + comuneCode).toUpperCase();
    const controlChar = calcolaCarattereControllo(base);
    return base + controlChar;
}

/* ===================== LOGICA PAGINA ===================== */

window.addEventListener('load', () => {
    const auth = InsinergiaAuth.ensureAuthenticated();
    if (!auth) return;
    const token = auth.token;
    const user = auth.user;

    const headersJson = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // Tema
    const currentTheme = InsinergiaTheme.loadInitialTheme();
    InsinergiaTheme.updateToggleLabel(currentTheme);
    document.getElementById('themeToggleBtn').onclick = () => {
        InsinergiaTheme.toggleTheme();
    };

    // Nome utente
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = user.nome || user.username;

    // Back / cancel
    document.getElementById('backBtn').onclick =
    document.getElementById('cancelBtn').onclick = () => {
        window.location.href = 'dashboard.html';
    };

    // Gestione eventuale edit (id in querystring)
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('id');
    if (patientId) {
        document.getElementById('formTitle') && (document.getElementById('formTitle').textContent = 'Modifica Paziente');
        loadPatient(patientId, headersJson);
    }

    // Bottone CF
    document.getElementById('generaCFBtn').onclick = async () => {
        const nome = document.getElementById('nome').value.trim();
        const cognome = document.getElementById('cognome').value.trim();
        const dataNascita = document.getElementById('data_nascita').value;
        const sessoRadio = document.querySelector('input[name="sesso"]:checked');
        const sesso = sessoRadio ? sessoRadio.value : null;
        const comune = document.getElementById('luogo_nascita').value.trim();
        const provinciaResidenza = document.getElementById('provincia_residenza').value.trim() || null; 

        if (!nome || !cognome || !dataNascita || !sesso || !comune) {
            return showToast('Compila nome, cognome, data di nascita, sesso e luogo di nascita', 'error');
        }   

        try {
    const res = await fetch('http://localhost:3000/api/codice-fiscale', {
        method: 'POST',
        headers: headersJson,
        body: JSON.stringify({
            nome,
            cognome,
            data_nascita: dataNascita,
            sesso,
            comune,
            provincia_residenza: provinciaResidenza
        })
    });

    const data = await res.json();
    debug('CF API proxy response (client): ' + JSON.stringify(data));

    if (!res.ok) {
        return showToast(data.error || 'Errore generazione CF', 'error');
    }

    if (!data.codice_fiscale) {
        return showToast('CF non presente nella risposta', 'error');
    }

    document.getElementById('codice_fiscale').value = data.codice_fiscale;
    showToast('Codice fiscale generato', 'success');
} catch (err) {
    debug('Errore proxy CF: ' + err.message);
    showToast('Errore generazione CF', 'error');
}

    };

    // Submit form
    document.getElementById('patientForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const sessoRadio = document.querySelector('input[name="sesso"]:checked');
        const payload = {
            nome: document.getElementById('nome').value.trim(),
            cognome: document.getElementById('cognome').value.trim(),
            data_nascita: document.getElementById('data_nascita').value || null,
            sesso: sessoRadio ? sessoRadio.value : null,
            luogo_nascita: document.getElementById('luogo_nascita').value.trim() || null,
            codice_fiscale: document.getElementById('codice_fiscale').value.trim() || null,
            indirizzo: document.getElementById('indirizzo').value.trim() || null,
            provincia_residenza: document.getElementById('provincia_residenza').value.trim() || null,
            comune_residenza: document.getElementById('comune_residenza').value.trim() || null,
            telefono: document.getElementById('telefono').value.trim() || null,
            email: document.getElementById('email').value.trim() || null,
            note: document.getElementById('note').value.trim() || null
        };

        if (!payload.nome || !payload.cognome || !payload.sesso) {
            return showToast('Compila nome, cognome e sesso', 'error');
        }

        try {
            const url = patientId
                ? `http://localhost:3000/api/patients/${patientId}`
                : 'http://localhost:3000/api/patients';
            const method = patientId ? 'PUT' : 'POST';

            debug('🔄 Salvataggio paziente...');
            const res = await fetch(url, {
                method,
                headers: headersJson,
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            debug('Risposta nuovo/modifica paziente: ' + JSON.stringify(data));

            if (!res.ok) throw new Error(data.error || 'Errore salvataggio paziente');

            showToast('Paziente salvato', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1200);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
});

async function loadPatient(id, headersJson) {
    try {
        const res = await fetch(`http://localhost:3000/api/patients/${id}`, {
            headers: headersJson
        });
        const patient = await res.json();

        Object.keys(patient).forEach(key => {
            const el = document.getElementById(key);
            if (!el) return;
            if (key === 'sesso') {
                document
                    .querySelector(`input[name="sesso"][value="${patient[key]}"]`)
                    ?.setAttribute('checked', 'checked');
            } else {
                el.value = patient[key] || '';
            }
        });
    } catch (e) {
        showToast('Errore caricamento paziente', 'error');
    }
}