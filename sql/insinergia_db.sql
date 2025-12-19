CREATE DATABASE insinergia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE insinergia_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    ruolo ENUM('admin', 'medico') NOT NULL DEFAULT 'medico',
    attivo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codice_univoco VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    codice_fiscale VARCHAR(16),
    data_nascita DATE,
    sesso ENUM('M', 'F'),
    luogo_nascita VARCHAR(100),
    email VARCHAR(100),
    telefono VARCHAR(20),
    indirizzo VARCHAR(255),
    comune_residenza VARCHAR(100),
    provincia_residenza VARCHAR(50),
    medico_id INT,
    stato ENUM('attivo', 'in_sospeso', 'completato') DEFAULT 'in_sospeso',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medico_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_email (email)
);

CREATE TABLE patient_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    tipo ENUM('doc_id_front', 'doc_id_back', 'cf_front', 'cf_back') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE lab_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    data_esame DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_barcode (barcode)
);