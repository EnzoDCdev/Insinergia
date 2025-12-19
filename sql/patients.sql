CREATE TABLE patients (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    codice_univoco VARCHAR(20) NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    data_nascita DATE NULL,
    sesso ENUM('M','F') NULL,
    luogo_nascita VARCHAR(150) NULL,
    codice_fiscale VARCHAR(16) NULL,
    indirizzo VARCHAR(255) NULL,
    provincia_residenza CHAR(2) NULL,
    comune_residenza VARCHAR(150) NULL,
    telefono VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_patients_codice_univoco (codice_univoco),
    KEY idx_patients_medico (medico_id)
    -- se hai una tabella users/medici, puoi aggiungere anche:
    -- , CONSTRAINT fk_patients_medico FOREIGN KEY (medico_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
