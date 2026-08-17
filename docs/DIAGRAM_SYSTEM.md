# SYSTEM ARCHITECTURE & DIAGRAMS
## Aplikasi: Sistem Informasi Manajemen Antrean Hybrid (3 Loket Kasir)

---

> **Petunjuk AI Agent / Developer:**  
> File ini berisi seluruh model diagram perancangan sistem berbasis **Mermaid.js** dan **PlantUML**. Seluruh diagram telah diselaraskan dengan spesifikasi 3 tabel final (`loket`, `antrian`, `admin`), zero-password session lock untuk kasir, dan mekanisme real-time AJAX/Fetch API tanpa refresh.

---

## 1. DIAGRAM KONTEKS (CONTEXT DIAGRAM)

### Mermaid Format
```mermaid
graph TD
    Pelanggan((Pelanggan))
    Petugas((Petugas Loket))
    Admin((Admin))
    Sistem["Sistem Informasi Antrean Hybrid<br/>(PHP Native + MySQL)"]

    Pelanggan -->|1. Request Tiket Cetak / QR| Sistem
    Sistem -->|2. Cetak Tiket Fisik / Link QR Mobile| Pelanggan

    Petugas -->|3. Select Loket & Input Nama| Sistem
    Petugas -->|4. Instruksi Panggil, Selesaikan, & Lewati| Sistem
    Sistem -->|5. Data Antrean Aktif & List Terlewat| Petugas

    Admin -->|6. Kredensial Login & Filter Laporan| Sistem
    Sistem -->|7. Dashboard Live Monitoring & PDF Laporan| Admin
```

### PlantUML Format
```plantuml
@startuml
skinparam componentStyle rectangle

actor "Pelanggan" as pelanggan
actor "Petugas Loket" as petugas
actor "Admin" as admin

rectangle "Sistem Informasi Antrean Hybrid
(PHP Native + MySQL)" as sistem

pelanggan -> sistem : 1. Permintaan Tiket (Cetak / QR)
sistem -> pelanggan : 2. Cetak Tiket Fisik / Link QR Status Mobile

petugas -> sistem : 3. Input Nama & Pilih Loket (Session Init)
4. Instruksi Panggil, Selesaikan, & Lewati
sistem -> petugas : 5. Data Antrean Aktif & List Terlewat

admin -> sistem : 6. Kredensial Login & Request Filter Laporan
sistem -> admin : 7. Dashboard Live Monitoring & File Export PDF Eksekutif
@enduml
```

---

## 2. DFD LEVEL 0 (OVERVIEW PROCESS)

### Mermaid Format
```mermaid
graph TD
    Pelanggan((Pelanggan))
    Petugas((Petugas Loket))
    Admin((Admin))
    DB[("D1: Database Antrean<br/>(loket, antrian, admin)")]

    P1["1.0<br/>Penyedia Tiket Antrean"]
    P2["2.0<br/>Operasional Pemanggilan Loket"]
    P3["3.0<br/>Analitik & Pelaporan Exec"]

    %% Process 1
    Pelanggan -->|Input Pilihan Cetak / QR| P1
    P1 -->|INSERT Data Antrean<br/>status='menunggu'| DB
    P1 -->|Output Tiket Fisik / QR Token| Pelanggan

    %% Process 2
    Petugas -->|Select Loket & Nama<br/>Panggil / Selesaikan / Lewati| P2
    P2 -->|UPDATE Status, id_loket,<br/>nama_petugas, timestamp| DB
    DB -->|Read Queue Status FIFO| P2
    P2 -->|Response JSON & Update UI| Petugas

    %% Process 3
    Admin -->|Request Laporan Range Tanggal| P3
    P3 -->|SELECT & Kalkulasi TIMESTAMPDIFF| DB
    DB -->|Data Performa & Aggregation| P3
    P3 -->|Export PDF Eksekutif Terpadu| Admin
```

### PlantUML Format
```plantuml
@startuml
skinparam componentStyle rectangle

actor "Pelanggan" as pelanggan
actor "Petugas Loket" as petugas
actor "Admin" as admin

database "D1: Database Antrean
(loket, antrian, admin)" as DB

rectangle "1.0
Penyedia Tiket Antrean" as P1
rectangle "2.0
Operasional Pemanggilan Loket" as P2
rectangle "3.0
Analitik & Pelaporan Exec" as P3

' Process 1.0
pelanggan -> P1 : Input Pilihan (Cetak / QR)
P1 -> DB : INSERT Data Antrean
(status='menunggu', waktu_ambil=NOW())
P1 -> pelanggan : Tiket Fisik / Output Link QR

' Process 2.0
petugas -> P2 : Select Loket & Nama
Panggil / Selesaikan / Lewati
P2 -> DB : UPDATE Status Antrean, id_loket,
nama_petugas, waktu_panggil/selesai
DB -> P2 : Read Queue Status FIFO
P2 -> petugas : Response JSON & Update UI

' Process 3.0
admin -> P3 : Request Laporan (Range Tanggal)
P3 -> DB : SELECT & Kalkulasi TIMESTAMPDIFF
DB -> P3 : Data Performa & Aggregation
P3 -> admin : Export PDF Eksekutif Terpadu
@enduml
```

---

## 3. DFD LEVEL 1

### 3.1 DFD Level 1 (Proses 1.0 Ambil Nomor Antrean)

```mermaid
graph TD
    Pelanggan((Pelanggan))
    DB[("D1: Database Antrean<br/>(Tabel antrian)")]

    P11["1.1<br/>Inisialisasi & Pilih Metode"]
    P12["1.2<br/>Generate Nomor & Token Atomic"]
    P13["1.3<br/>Output Cetak Tiket Fisik"]
    P14["1.4<br/>Output Link QR & Tiket Digital"]

    Pelanggan -->|Input Pilihan Cetak / QR| P11
    P11 -->|Data Request Antrean| P12

    P12 -->|SELECT MAX FOR UPDATE &<br/>INSERT status='menunggu'| DB
    DB -->|Return ID, Nomor, & Token| P12

    P12 -->|Data Nomor Antrean| P13
    P13 -->|Printout Tiket Termal| Pelanggan

    P12 -->|Data Token & Link Mobile| P14
    P14 -->|Tampilan QR Code di Kios| Pelanggan
```

### 3.2 DFD Level 1 (Proses 2.0 Operasional Pemanggilan)

```mermaid
graph TD
    Petugas((Petugas Loket))
    DB[("D1: Database Antrean<br/>(loket, antrian)")]

    P21["2.1<br/>Setup Session & Lock Guard"]
    P22["2.2<br/>Fetch Queue FIFO (FOR UPDATE)"]
    P23["2.3<br/>Update Status Dipanggil"]
    P24["2.4<br/>Finalisasi Status (Selesai/Terlewat)"]
    P25["2.5<br/>Panggil Kembali (Recall / Terlewat)"]

    Petugas -->|Select No Loket & Nama| P21
    P21 -->|Check & Set session_token & last_seen| DB
    DB -->|Session Approved| P21

    Petugas -->|Klik 'Panggil Berikutnya'| P22
    P22 -->|Query status='menunggu' ORDER BY id ASC| DB
    DB -->|Return Row Antrean Terkecil| P22

    P22 -->|Trigger Update| P23
    P23 -->|UPDATE status='dipanggil', waktu_panggil=NOW()| DB

    Petugas -->|Klik 'Selesai' / 'Lewati'| P24
    P24 -->|UPDATE status='selesai'/'terlewat', waktu_selesai=NOW()| DB

    Petugas -->|Klik 'Panggil Ulang' / 'Panggil Terlewat'| P25
    P25 -->|UPDATE Status Antrean Terlewat| DB
```

### 3.3 DFD Level 1 (Proses 3.0 Monitoring & Pelaporan Exec)

```mermaid
graph TD
    Admin((Admin))
    DB[("D1: Database Antrean<br/>(antrian, loket, admin)")]

    P31["3.1<br/>Filter & Query Data Transaksi"]
    P32["3.2<br/>Kalkulasi Performa (TIMESTAMPDIFF)"]
    P33["3.3<br/>Visualisasi Dashboard & Export PDF"]

    Admin -->|Input Filter Periode Tanggal| P31
    P31 -->|SELECT status & timestamps| DB
    DB -->|Raw Data Antrean Terpilih| P31

    P31 -->|Kirim Data Transaksi| P32
    P32 -->|Hitung Rerata Waktu Tunggu,<br/>Waktu Pelayanan, & Jam Sibuk| P32

    P32 -->|Data Terkalkulasi & Metrik Aggregation| P33
    P33 -->|Widget Dashboard Live &<br/>Single Export PDF Eksekutif| Admin
```

---

## 4. USE CASE DIAGRAM

### Mermaid Format
```mermaid
graph LR
    subgraph Sistem Antrean Hybrid
        UC1(Ambil Tiket Cetak)
        UC2(Ambil Tiket QR / Digital)
        UC3(Lihat Status Antrean Mobile)
        UC4(Inisialisasi Shift & Pilih Loket)
        UC5(Panggil Antrean FIFO)
        UC6(Selesaikan Antrean)
        UC7(Lewati Antrean)
        UC8(Panggil Ulang / Recall)
        UC9(Panggil Kembali Antrean Terlewat)
        UC10(Login System Admin)
        UC11(Monitoring Real-time)
        UC12(Export Laporan Eksekutif PDF)
    end

    Pelanggan((Pelanggan)) --> UC1
    Pelanggan --> UC2
    Pelanggan --> UC3

    Kasir((Petugas Loket)) --> UC4
    Kasir --> UC5
    Kasir --> UC6
    Kasir --> UC7
    Kasir --> UC8
    Kasir --> UC9

    Admin((Admin)) --> UC10
    Admin --> UC11
    Admin --> UC12
```

### PlantUML Format
```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle

actor "Pelanggan" as pelanggan
actor "Petugas Loket" as kasir
actor "Admin" as admin

rectangle "Sistem Antrean Hybrid" {
    usecase "Ambil Tiket Cetak" as UC1
    usecase "Ambil Tiket QR / Digital" as UC2
    usecase "Lihat Status Antrean Mobile" as UC3
    
    usecase "Inisialisasi Shift & Pilih Loket" as UC4
    usecase "Panggil Antrean FIFO" as UC5
    usecase "Selesaikan Antrean" as UC6
    usecase "Lewati Antrean" as UC7
    usecase "Panggil Ulang (Recall)" as UC8
    usecase "Panggil Kembali Antrean Terlewat" as UC9
    
    usecase "Login System Admin" as UC10
    usecase "Monitoring Real-time" as UC11
    usecase "Export Laporan Eksekutif PDF" as UC12
}

pelanggan --> UC1
pelanggan --> UC2
pelanggan --> UC3

kasir --> UC4
kasir --> UC5
kasir --> UC6
kasir --> UC7
kasir --> UC8
kasir --> UC9

admin --> UC10
admin --> UC11
admin --> UC12
@enduml
```

---

## 5. SEQUENCE DIAGRAMS (REAL-TIME COMMUNICATION)

### 5.1 Pengambilan Tiket & Live Polling Mobile

```mermaid
sequenceDiagram
    autonumber
    actor P as Pelanggan
    participant K as Kios Antrean (Browser)
    participant API as kiosk_action.php
    participant DB as Database MySQL
    participant M as Smartphone Pelanggan
    participant API_T as ticket_feed.php

    P->>K: Pilih Metode "Scan QR Code"
    K->>API: POST /kiosk_action.php (metode=qr)
    activate API
    API->>DB: SELECT MAX(nomor_antrian) FOR UPDATE
    DB-->>API: Nomor Terakhir
    API->>DB: INSERT INTO antrian (nomor, metode, token, status='menunggu', waktu_ambil=NOW())
    DB-->>API: Insert Success (ID & Token)
    API-->>K: JSON {success: true, number: "A-5", token: "xyz123"}
    deactivate API
    K-->>P: Tampilkan QR Code (link: ticket.php?token=xyz123)

    P->>M: Scan QR Code & Buka Halaman Ticket
    loop Live Polling (Setiap 3 Detik)
        M->>API_T: GET /ticket_feed.php?token=xyz123
        activate API_T
        API_T->>DB: SELECT status, id_loket FROM antrian WHERE access_token='xyz123'
        DB-->>API_T: Data Status & Loket
        API_T-->>M: JSON {status: "menunggu", sisa_antrean: 2}
        deactivate API_T
        M-->>P: Update Tampilan Layar HP (Live)
    end
```

### 5.2 Pemanggilan Antrean FIFO & Lock Check

```mermaid
sequenceDiagram
    autonumber
    actor C as Petugas Kasir
    participant Dash as Dashboard Kasir (counter.php)
    participant API as counter_action.php
    participant DB as Database MySQL

    C->>Dash: Klik Tombol "Panggil Berikutnya"
    Dash->>API: POST /counter_action.php (action=call_next)
    activate API
    API->>DB: SELECT id_antrian FROM antrian WHERE status='dipanggil' AND id_loket=1
    alt Masih Ada Antrean Aktif Belum Selesai
        DB-->>API: Row Found
        API-->>Dash: JSON {error: "Selesaikan antrean saat ini terlebih dahulu"}
    else Loket Bebas
        DB-->>API: Row Null
        API->>DB: SELECT * FROM antrian WHERE status='menunggu' ORDER BY id_antrian ASC LIMIT 1 FOR UPDATE
        DB-->>API: Data Antrean Terkecil (misal ID 12, No A-5)
        API->>DB: UPDATE antrian SET status='dipanggil', id_loket=1, nama_petugas='Ahmad', waktu_panggil=NOW() WHERE id_antrian=12
        DB-->>API: Update OK
        API-->>Dash: JSON {success: true, number: "A-5"}
        deactivate API
        Dash-->>C: Tampilkan Nomor A-5 di Panel Utama
    end
```

### 5.3 Layar Display Ruang Tunggu & Audio Trigger

```mermaid
sequenceDiagram
    autonumber
    participant Display as Layar Display (display.php)
    participant API as display_feed.php (API)
    participant DB as Database MySQL
    participant Audio as Audio Engine / Web Speech

    note over Display: Layar Fullscreen di TV Ruang Tunggu

    loop Real-time Polling (Setiap 2 Detik)
        Display->>API: GET /api/display_feed.php
        activate API
        API->>DB: SELECT id_loket, nomor_antrian, status FROM antrian WHERE status='dipanggil'
        activate DB
        DB-->>API: Data Antrean Aktif di 3 Loket
        deactivate DB
        API-->>Display: JSON {loket_1: "A-5", loket_2: "A-3", loket_3: "A-4", last_called: "loket_1"}
        deactivate API

        alt Ada Perubahan Nomor / Panggilan Baru
            Display->>Display: Effect Highlight Card Loket Berkedip
            Display->>Audio: Play Bell Sound (bell.mp3)
            Display->>Audio: Trigger Text-to-Speech ("Nomor Antrean A-5 ke Loket 1")
        else Tidak Ada Perubahan
            Display->>Display: Render Tampilan Normal
        end
    end
```

---

## 6. SYSTEM FLOWCHART

### Mermaid Format
```mermaid
flowchart TD
    Start([Mulai]) --> Setup[Petugas Memilih Nomor Loket 1-3 & Input Nama]
    
    Setup --> CheckLock{Apakah Loket Sedang<br/>Aktif Dipakai?}
    CheckLock -- Ya --> AlertLock[Tampilkan Alert 'Loket Sedang Digunakan'] --> EndSetup([Stop])
    CheckLock -- Tidak --> SaveSession[Simpan Session PHP & Set Lock Timestamp]

    SaveSession --> Kiosk[Pelanggan Memilih Metode Antrean]
    
    Kiosk --> Method{Metode Tiket?}
    Method -- Scan QR --> GenToken[Generate Access Token Unik]
    GenToken --> SaveDB1[Simpan Data ke DB: status='menunggu']
    SaveDB1 --> ShowQR[Tampilkan QR Code ke Smartphone]
    
    Method -- Cetak Fisik --> SaveDB2[Simpan Data ke DB: status='menunggu']
    SaveDB2 --> PrintTicket[Cetak Tiket Fisik via Thermal Printer]

    ShowQR --> CallStep[Petugas Klik 'Panggil Berikutnya']
    PrintTicket --> CallStep

    CallStep --> CheckQueue{Ada Antrean Status<br/>'menunggu'?}
    CheckQueue -- Tidak --> EmptyAlert[Notifikasi 'Antrean Kosong']
    CheckQueue -- Ya --> GetFIFO[Sistem Ambil Nomor Terkecil FIFO]
    
    GetFIFO --> CallActive[Update status='dipanggil' & waktu_panggil=NOW()]
    CallActive --> SoundBell[Display Utama Memutar Bel & Highlight Loket]
    
    SoundBell --> Attendance{Pelanggan Hadir<br/>di Loket?}
    Attendance -- Ya --> Process[Proses Pelayanan Kasir]
    Process --> Finish[Petugas Klik 'Selesai']
    Finish --> SaveFinish[Update status='selesai' & waktu_selesai=NOW()]
    
    Attendance -- Tidak --> Skip[Petugas Klik 'Lewati']
    Skip --> SaveSkip[Update status='terlewat' & waktu_selesai=NOW()]

    SaveFinish --> AdminReport[Admin Login Dashboard & Filter Tanggal]
    SaveSkip --> AdminReport

    AdminReport --> CalcMetrics[Sistem Hitung TIMESTAMPDIFF Waktu Tunggu/Layanan]
    CalcMetrics --> ExportPDF[Export 1 File PDF Laporan Eksekutif] --> End([Selesai])
```

---

## 7. ERD / CLASS DIAGRAM (SKEMA 3 TABEL FINAL)

### Mermaid Format
```mermaid
classDiagram
    class Loket {
        +tinyint id_loket PK
        +tinyint nomor_loket
        +string nama_loket
        +enum status_aktif
        +string session_token
        +timestamp last_seen
    }

    class Antrian {
        +bigint id_antrian PK
        +int nomor_antrian
        +string kode_antrian
        +enum metode_tiket
        +string access_token
        +enum status
        +tinyint id_loket FK
        +string nama_petugas
        +datetime waktu_ambil
        +datetime waktu_panggil
        +datetime waktu_selesai
        +timestamp created_at
    }

    class Admin {
        +int id_admin PK
        +string username
        +string password_hash
        +string nama_lengkap
        +timestamp created_at
    }

    Loket "0..1" -- "0..*" Antrian : melayani
```

### PlantUML Format
```plantuml
@startuml
entity "loket" as loket {
    * id_loket : TINYINT UNSIGNED <<PK>>
    --
    * nomor_loket : TINYINT UNSIGNED
    * nama_loket : VARCHAR(50)
    * status_aktif : ENUM('aktif', 'nonaktif')
    session_token : VARCHAR(64)
    last_seen : TIMESTAMP
}

entity "antrian" as antrian {
    * id_antrian : BIGINT UNSIGNED <<PK>>
    --
    * nomor_antrian : INT UNSIGNED
    * kode_antrian : VARCHAR(10)
    * metode_tiket : ENUM('cetak', 'qr')
    access_token : VARCHAR(64)
    * status : ENUM('menunggu', 'dipanggil', 'selesai', 'terlewat', 'batal')
    id_loket : TINYINT UNSIGNED <<FK>>
    nama_petugas : VARCHAR(100)
    * waktu_ambil : DATETIME
    waktu_panggil : DATETIME
    waktu_selesai : DATETIME
    created_at : TIMESTAMP
}

entity "admin" as admin {
    * id_admin : INT UNSIGNED <<PK>>
    --
    * username : VARCHAR(50)
    * password_hash : VARCHAR(255)
    * nama_lengkap : VARCHAR(100)
    created_at : TIMESTAMP
}

loket ||--o{ antrian : "melayani"
@enduml
```
