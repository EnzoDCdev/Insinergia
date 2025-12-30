async function uploadDocument(file, tipo, descrizione) {
  try {
    console.log('📤 Upload:', file.name, 'Tipo:', tipo);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    if (descrizione) {
      formData.append('descrizione', descrizione);
    }

    const token = getToken();
    const response = await fetch(`/api/patients/${currentPatientId}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();
    console.log('✅ Upload completato:', data);

    // Reset form
    document.getElementById('documentUploadForm').reset();
    document.getElementById('fileInput').value = '';

    // Ricarica documenti
    await loadPatientData();

    alert('✅ Documento caricato con successo');
  } catch (err) {
    console.error('❌ Upload error:', err);
    alert(`❌ Errore: ${err.message}`);
  }
}




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


function setupEventListeners() {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      console.log('🔄 Switching to tab:', tabName);

      // Nascondi tutti i tab
      document.querySelectorAll('.tab-content').forEach((tab) => {
        tab.classList.remove('active');
      });

      // Deseleziona tutti i pulsanti
      document.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.remove('active');
      });

      // Seleziona il tab corretto in base al data-tab
      let tabId;
      if (tabName === 'dati') tabId = 'datiTab';
      else if (tabName === 'documenti') tabId = 'documenti-tab';
      else if (tabName === 'analisi') tabId = 'analisiTab';
      else if (tabName === 'log') tabId = 'logTab';

      if (tabId) {
        const tabEl = document.getElementById(tabId);
        if (tabEl) {
          tabEl.classList.add('active');
          console.log('✅ Tab attivato:', tabId);
        }
      }

      // Attiva il bottone
      btn.classList.add('active');
    });
  });

  // Back button
  const backBtn = document.querySelector('[data-action="back"]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = '/dashboard.html';
    });
  }

  // Logout button
  const logoutBtn = document.querySelector('[data-action="logout"]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof logout === 'function') {
        logout();
      }
    });
  }
}