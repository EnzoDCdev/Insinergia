document.addEventListener("DOMContentLoaded", async () => {
  // 🔐 Auth
  const auth = InsinergiaAuth.ensureAuthenticated();
  if (!auth) return (window.location.href = "index.html");

  const token = auth.token;
  const user = auth.user;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 🌗 Tema
  const currentTheme = InsinergiaTheme.loadInitialTheme();
  InsinergiaTheme.updateToggleLabel(currentTheme);
  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    themeBtn.onclick = () => InsinergiaTheme.toggleTheme();
  }

  // 👤 User UI
  const userNameEl = document.getElementById("userName");
  if (userNameEl) userNameEl.textContent = user.nome || user.username;

  const avatarEl = document.getElementById("userAvatarSmall");
  if (avatarEl) {
    if (user.avatar) {
      avatarEl.src = `http://localhost:3000/${user.avatar}`;
      avatarEl.style.display = "inline-block";
    } else {
      avatarEl.style.display = "none";
    }
  }

  // 🔙 Back
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => (window.location.href = "dashboard.html");
  }

  // 🔎 ID paziente
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("id");
  if (!patientId) return (window.location.href = "dashboard.html");

  // Helpers
  function setReadOnlyMode(isReadOnly) {
    const ids = [
      "nome",
      "cognome",
      "data_nascita",
      "sesso",
      "luogo_nascita",
      "codice_fiscale",
      "indirizzo",
      "comune_residenza",
      "provincia_residenza",
      "telefono",
      "email",
      "note",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (isReadOnly) {
        el.setAttribute("readonly", "readonly");
        if (el.tagName === "SELECT") {
          el.setAttribute("disabled", "disabled");
        }
      } else {
        el.removeAttribute("readonly");
        if (el.tagName === "SELECT") {
          el.removeAttribute("disabled");
        }
      }
    });
  }

  function fillForm(patient) {
  // Header compatto
  document.getElementById("patientTitle").textContent =
    `${patient.cognome} ${patient.nome}`;
  document.getElementById("patientCode").textContent =
    patient.codice_univoco || "";

  const dobText =
    (patient.data_nascita || "").toString().substring(0, 10) || "";
  document.getElementById("patientHeaderDob").textContent = dobText;
  document.getElementById("patientHeaderGender").textContent =
    patient.sesso || "";
  document.getElementById("patientHeaderCF").textContent =
    patient.codice_fiscale || "";
  document.getElementById("patientHeaderPhone").textContent =
    patient.telefono || "";
  document.getElementById("patientHeaderEmail").textContent =
    patient.email || "";

  // Form dettagli
  document.getElementById("nome").value = patient.nome || "";
  document.getElementById("cognome").value = patient.cognome || "";
  document.getElementById("data_nascita").value = dobText;
  document.getElementById("sesso").value = patient.sesso || "";
  document.getElementById("luogo_nascita").value =
    patient.luogo_nascita || "";
  document.getElementById("codice_fiscale").value =
    patient.codice_fiscale || "";
  document.getElementById("indirizzo").value = patient.indirizzo || "";
  document.getElementById("comune_residenza").value =
    patient.comune_residenza || "";
  document.getElementById("provincia_residenza").value =
    patient.provincia_residenza || "";
  document.getElementById("telefono").value = patient.telefono || "";
  document.getElementById("email").value = patient.email || "";
  document.getElementById("note").value = patient.note || "";
}

  // 📥 Carica paziente
  async function loadPatient(patientId, headers) {
  try {
    const res = await fetch(
      `http://localhost:3000/api/patients/${patientId}`,
      { headers }
    );
    const data = await res.json();
    console.log('API /patients/:id risposta:', data);

    if (!res.ok) throw new Error(data.error || 'Errore caricamento paziente');

    // ADATTA QUI:
    const patient = data; // se l'API torna direttamente il paziente
    if (!patient) throw new Error('Paziente non trovato');
    fillForm(patient);
    setReadOnlyMode(true);
  } catch (err) {
    console.error('Errore load patient:', err);
    alert('Errore nel caricamento del paziente');
  }
}

  // 🧾 Logs
  async function loadLogs(patientId, headers) {
    try {
      const res = await fetch(
        `http://localhost:3000/api/patients/${patientId}/logs`,
        { headers }
      );
      const logs = await res.json();
      const tbody = document.getElementById("logsTableBody");
      if (!tbody) return;

      if (!Array.isArray(logs) || !logs.length) {
        tbody.innerHTML =
          '<tr><td colspan="3">Nessun log disponibile</td></tr>';
        return;
      }

      tbody.innerHTML = logs
        .map(
          (log) => `
          <tr>
            <td>${new Date(log.created_at).toLocaleString()}</td>
            <td>${log.user_nome || log.username}</td>
            <td>${log.field}: ${log.new_value || ""}</td>
          </tr>
        `
        )
        .join("");
    } catch (err) {
      console.error("Errore logs paziente:", err);
      const tbody = document.getElementById("logsTableBody");
      if (tbody)
        tbody.innerHTML =
          '<tr><td colspan="3">Errore caricamento log</td></tr>';
    }
  }

  // 📂 Documenti: lista laterale
  async function loadDocuments(patientId, headers) {
  try {
    const res = await fetch(
      `http://localhost:3000/api/patients/${patientId}/documents`,
      { headers }
    );
    const docs = await res.json();
    const listEl = document.getElementById("documentsList");
    if (!listEl) return;

    if (!Array.isArray(docs) || !docs.length) {
      listEl.innerHTML = "<li>Nessun documento caricato</li>";
      return;
    }

    listEl.innerHTML = docs
      .map((doc) => {
        const tipoLabel =
          doc.tipo === "carta_identita"
            ? "Carta d'identità"
            : doc.tipo === "tessera_sanitaria"
            ? "Tessera sanitaria"
            : doc.tipo === "analisi_csv"
            ? "Analisi (CSV)"
            : "Altro";

        const dateLabel = new Date(doc.created_at).toLocaleString();

        return `
          <li data-doc-id="${doc.id}" data-doc-tipo="${doc.tipo}">
            <span class="doc-type">${tipoLabel}</span>
            <span class="doc-meta">${dateLabel}</span>
            <span class="doc-meta">${doc.user_nome || doc.username}</span>
          </li>
        `;
      })
      .join("");

    listEl.querySelectorAll("li[data-doc-id]").forEach((li) => {
      li.addEventListener("click", () => {
        listEl
          .querySelectorAll("li.active")
          .forEach((el) => el.classList.remove("active"));
        li.classList.add("active");

        const docId = li.getAttribute("data-doc-id");
        const tipo = li.getAttribute("data-doc-tipo");
        onDocumentSelected(docId, tipo);
      });
    });
  } catch (err) {
    console.error("Errore documenti paziente:", err);
    const listEl = document.getElementById("documentsList");
    if (listEl) listEl.innerHTML = "<li>Errore caricamento documenti</li>";
  }
}

  // 🔎 GET singolo documento (per viewer)
  async function getDocumentById(docId) {
  const res = await fetch(
    `http://localhost:3000/api/patient-documents/${docId}`,
    { headers: { Authorization: headers.Authorization } }
  );

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('Risposta non JSON da /api/patient-documents/:id:', text);
    throw new Error('Risposta non valida dal server');
  }

  if (!res.ok) {
    throw new Error(data.error || 'Errore caricamento documento');
  }

  return data;
}

async function onDocumentSelected(docId, tipo) {
  const viewerTitle = document.getElementById("documentViewerTitle");
  const viewerContent = document.getElementById("documentViewerContent");
  const analisiCard = document.getElementById("analisiCard");

  if (!viewerTitle || !viewerContent || !analisiCard) return;

  analisiCard.style.display = "none";
  viewerContent.innerHTML = "<p>Caricamento documento...</p>";

  try {
    const doc = await getDocumentById(docId);

    const tipoLabel =
      tipo === "carta_identita"
        ? "Carta d'identità"
        : tipo === "tessera_sanitaria"
        ? "Tessera sanitaria"
        : tipo === "analisi_csv"
        ? "Analisi (CSV)"
        : "Altro";

    viewerTitle.textContent = tipoLabel;

    const fileUrl = `http://localhost:3000/${doc.file_path}`;
    const lower = doc.file_path.toLowerCase();

    if (tipo === "analisi_csv") {
      viewerContent.innerHTML = `
        <p>File CSV: <a href="${fileUrl}" target="_blank">${doc.file_path}</a></p>
      `;
      await loadAnalisiFromDocument(docId);
    } else {
      if (lower.endsWith(".pdf")) {
        viewerContent.innerHTML = `
          <iframe src="${fileUrl}" style="width:100%;height:400px;border:none;"></iframe>
        `;
      } else if (
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".gif")
      ) {
        viewerContent.innerHTML = `
          <img src="${fileUrl}" alt="${tipoLabel}" style="max-width:100%;max-height:400px;object-fit:contain;" />
        `;
      } else {
        viewerContent.innerHTML = `
          <p>File: <a href="${fileUrl}" target="_blank">${doc.file_path}</a></p>
        `;
      }
    }
  } catch (err) {
    console.error("Errore selezione documento:", err);
    viewerContent.innerHTML =
      "<p>Errore nel caricamento del documento selezionato.</p>";
  }
}

  // 🧪 Analisi: render tabella
  function renderAnalisiTable(analyses) {
  const tbody = document.getElementById("analisiTableBody");
  if (!tbody) return;

  if (!Array.isArray(analyses) || !analyses.length) {
    tbody.innerHTML =
      '<tr><td colspan="3">Nessun dato analisi</td></tr>';
    return;
  }

  tbody.innerHTML = analyses
    .map(
      (a) => `
      <tr class="${a.flag === "abnormal" ? "row-abnormal" : ""}">
        <td>${a.testName}</td>
        <td>${a.value}</td>
        <td>${a.unit}</td>
      </tr>
    `
    )
    .join("");
}

async function loadAnalisiFromDocument(documentId) {
  const tbody = document.getElementById("analisiTableBody");
  const analisiCard = document.getElementById("analisiCard");
  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="3">Caricamento analisi...</td></tr>';
  }
  if (analisiCard) {
    analisiCard.style.display = "block";
  }

  try {
    const res = await fetch(
      `http://localhost:3000/api/patient-documents/${documentId}/analyses`,
      {
        headers: { Authorization: headers.Authorization },
      }
    );
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || "Errore caricamento analisi");
    renderAnalisiTable(data.analyses || []);
  } catch (err) {
    console.error("Errore get analisi:", err);
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="3">Errore caricamento analisi</td></tr>';
    }
    alert("Errore caricamento analisi: " + err.message);
  }
}

  // 🧪 Analisi: chiamata API
  async function loadAnalisiFromDocument(documentId) {
    const tbody = document.getElementById("analisiTableBody");
    const analisiCard = document.getElementById("analisiCard");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="3">Caricamento analisi...</td></tr>';
    }
    if (analisiCard) {
      analisiCard.style.display = "block";
    }

    try {
      const res = await fetch(
        `http://localhost:3000/api/patient-documents/${documentId}/analyses`,
        {
          headers: { Authorization: headers.Authorization },
        }
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Errore caricamento analisi");
      renderAnalisiTable(data.analyses || []);
    } catch (err) {
      console.error("Errore get analisi:", err);
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="3">Errore caricamento analisi</td></tr>';
      }
      alert("Errore caricamento analisi: " + err.message);
    }
  }

  // 📄 Selezione documento dalla lista
  async function onDocumentSelected(docId, tipo) {
    const viewerTitle = document.getElementById("documentViewerTitle");
    const viewerContent = document.getElementById("documentViewerContent");
    const analisiCard = document.getElementById("analisiCard");

    if (!viewerTitle || !viewerContent || !analisiCard) return;

    analisiCard.style.display = "none";
    viewerContent.innerHTML = "<p>Caricamento documento...</p>";

    try {
      const doc = await getDocumentById(docId);

      const tipoLabel =
        tipo === "carta_identita"
          ? "Carta d'identità"
          : tipo === "tessera_sanitaria"
          ? "Tessera sanitaria"
          : tipo === "analisi_csv"
          ? "Analisi (CSV)"
          : "Altro";

      viewerTitle.textContent = tipoLabel;

      const fileUrl = `http://localhost:3000/${doc.file_path}`;
      const lower = doc.file_path.toLowerCase();

      if (tipo === "analisi_csv") {
        // CSV analisi: link + tabella analisi
        viewerContent.innerHTML = `
          <p>File CSV: <a href="${fileUrl}" target="_blank">${doc.file_path}</a></p>
        `;
        await loadAnalisiFromDocument(docId);
      } else {
        // documenti normali
        if (lower.endsWith(".pdf")) {
          viewerContent.innerHTML = `
            <iframe src="${fileUrl}" style="width:100%;height:400px;border:none;"></iframe>
          `;
        } else if (
          lower.endsWith(".jpg") ||
          lower.endsWith(".jpeg") ||
          lower.endsWith(".png") ||
          lower.endsWith(".gif")
        ) {
          viewerContent.innerHTML = `
            <img src="${fileUrl}" alt="${tipoLabel}" style="max-width:100%;max-height:400px;object-fit:contain;" />
          `;
        } else {
          viewerContent.innerHTML = `
            <p>File: <a href="${fileUrl}" target="_blank">${doc.file_path}</a></p>
          `;
        }
      }
    } catch (err) {
      console.error("Errore selezione documento:", err);
      viewerContent.innerHTML =
        "<p>Errore nel caricamento del documento selezionato.</p>";
    }
  }

  // 💾 Salvataggio dati paziente
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");

  if (editBtn && saveBtn) {
    editBtn.onclick = () => {
      setReadOnlyMode(false);
      saveBtn.disabled = false;
    };

    saveBtn.onclick = async () => {
      const payload = {
        nome: document.getElementById("nome").value.trim(),
        cognome: document.getElementById("cognome").value.trim(),
        data_nascita: document.getElementById("data_nascita").value,
        sesso: document.getElementById("sesso").value,
        luogo_nascita: document.getElementById("luogo_nascita").value.trim(),
        codice_fiscale:
          document.getElementById("codice_fiscale").value.trim(),
        indirizzo: document.getElementById("indirizzo").value.trim(),
        comune_residenza:
          document.getElementById("comune_residenza").value.trim(),
        provincia_residenza:
          document.getElementById("provincia_residenza").value.trim(),
        telefono: document.getElementById("telefono").value.trim(),
        email: document.getElementById("email").value.trim(),
        note: document.getElementById("note").value.trim(),
      };

      try {
        const res = await fetch(
          `http://localhost:3000/api/patients/${patientId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || "Errore salvataggio paziente");

        alert("Dati paziente aggiornati");
        setReadOnlyMode(true);
        saveBtn.disabled = true;
        await loadPatient(patientId, headers);
        await loadLogs(patientId, headers);
      } catch (err) {
        console.error("Errore salvataggio paziente:", err);
        alert("Errore salvataggio paziente: " + err.message);
      }
    };
  }

  // 📤 Upload documenti / analisi
  const uploadDocBtn = document.getElementById("uploadDocBtn");
if (uploadDocBtn) {
  uploadDocBtn.onclick = async () => {
    const fileInput = document.getElementById("docFile");
    const tipoSelect = document.getElementById("docTipo");
    if (!fileInput.files[0]) {
      alert("Seleziona un file");
      return;
    }
    const tipo = tipoSelect.value;

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("tipo", tipo);

    try {
      const res = await fetch(
        `http://localhost:3000/api/patients/${patientId}/documents`,
        {
          method: "POST",
          headers: { Authorization: headers.Authorization },
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Errore upload documento");

      alert("Documento caricato");
      fileInput.value = "";
      await loadDocuments(patientId, headers);
      await loadLogs(patientId, headers);
    } catch (err) {
      console.error("Errore upload documento:", err);
      alert("Errore upload documento: " + err.message);
    }
  };
}

  // 🚀 Init
  await loadPatient(patientId, headers);
  await loadLogs(patientId, headers);
  await loadDocuments(patientId, headers);
});