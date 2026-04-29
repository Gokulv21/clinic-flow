# PRESCRIPTO - THE ULTIMATE CLINIC EVOLUTION
### Complete Product & Technical Documentation 
**Version 2.5.0 | April 2026**

---

## 1. PROJECT OVERVIEW
**Prescripto** is a next-generation, cloud-native Healthcare SaaS (Software as a Service) platform designed to eliminate the friction between traditional paper-based medical practices and the digital future. It is specifically optimized for tablet-first workflows, allowing doctors to retain the tactile freedom of handwriting while gaining the analytical power of modern data science.

### Mission Statement
To empower healthcare providers with "invisible technology"—tools that feel natural, look opulent, and perform with surgical precision.

---

## 2. CORE FEATURES & MODULES

### 2.1 Intelligent Analytics (The Data Brain)
The system leverages clinical data to provide actionable insights.
- **Patient Flow Dynamics**: Real-time traffic analysis with 10,000+ record processing capacity to ensure 100% accuracy in volume tracking.
- **AI Intelligence Check**: A simulation-driven insight engine that identifies peak load hours and core diagnosis trends.
- **Diagnosis Mix & Filtering**: Interactive visualization of clinical reasons for visits with custom checkbox filtering for multi-diagnosis comparison.
- **Pharmacotherapy Insights**: Analysis of most frequently prescribed medications and protocols.
- **Clinical Seasonality**: 6-month trend analysis to predict upcoming disease outbreaks or seasonal patient surges.

### 2.2 Advanced Handwriting Engine (The Digital Pen)
A state-of-the-art canvas implementation designed for Apple Pencil and high-refresh tablets.
- **Variable Pressure Sensitivity**: Integrated `perfect-freehand` for natural, pressure-responsive strokes.
- **120Hz-Ready Rendering**: Optimized with `requestAnimationFrame` for zero-latency writing.
- **Gesture Decoupling**: Intelligent separation between stylus input and multi-touch gestures (zoom/pan), preventing accidental palm-rejection issues.
- **A4 Synchronization**: Digital canvas strictly maps to standard A4 dimensions for perfect print output.

### 2.3 Smart Consultation Workflow
- **Standardized Diagnosis**: Automated UPPERCASE conversion and case-insensitive deduplication to maintain a clean clinical database.
- **Medicine Protocols**: One-click application of template-based prescriptions for common conditions (e.g., Fever, URTI).
- **Clinical Vitals Management**: Comprehensive tracking of Weight, BP, Pulse, SpO2, Temp, and CBG with unit validation.
- **Visit History Recall**: Instant access to previous clinical notes and prescriptions with "One-Tap Copy" to current visit.

### 2.4 Patient Journey & Logistics
- **Nurse Entry Terminal**: High-speed registration and vitals capture.
- **Token System**: Real-time queue management with status indicators (Waiting, Active, Completed).
- **Print Queue Fulfillment**: A dedicated station for front-desk staff to print prescriptions instantly.
- **Public Rx Sharing**: HIPAA-compliant (via RLS) patient links shared via **WhatsApp Integration** for digital recovery.

### 2.5 Teleconsultation Suite
- **Integrated Video/Audio Calls**: Low-latency communication between Doctors and Staff/Patients.
- **Real-time Availability**: Online status tracking for multi-clinic environments.

---

## 3. TECHNICAL STACK & ARCHITECTURE

### 3.1 Frontend (The Glass & Steel)
- **React 18 + TypeScript**: The core application logic layer.
- **Vite 5**: High-speed build and development pipeline.
- **Tailwind CSS**: Utility-first styling for the "Opulent Slate" design system.
- **Framer Motion**: Micro-animations for a premium, alive user experience.
- **Shadcn/UI & Lucide**: Modern, accessible component library and iconography.
- **Recharts**: High-performance charting engine for all analytics.

### 3.2 Backend (The Fort Knox)
- **Supabase (PostgreSQL)**: The relational database engine.
- **PostgREST**: Automatic RESTful API generation.
- **Row Level Security (RLS)**: The primary security barrier ensuring multi-tenant isolation.
- **Storage Buckets**: Encrypted storage for high-fidelity handwriting assets.

### 3.3 Techniques & Innovations
- **Multi-Tenant Hub**: A unique `clinic_id` scoping strategy that allows a single user to manage or work across multiple clinics without data leak.
- **Optimistic State Updates**: Using TanStack Query to ensure the UI feels instantaneous even on slower clinic networks.
- **Real-time Subscriptions**: Postgres Changes used for live Token and Queue updates.

---

## 4. USAGE & WORKFLOW GUIDE

### Step 1: The Front Desk (Nurse/Staff)
Access the **Nurse Entry** page to register the patient and enter vitals. A Token Number is automatically assigned.

### Step 2: The Consultation (Doctor)
The Doctor sees the patient in the **Patient Queue**. Upon selection, the clinical history is loaded. The Doctor uses the **Handwriting Canvas** or **Medicine Grid** to prescribe.

### Step 3: Fulfillment (Staff)
The prescription appears in the **Print Queue**. Staff prints the A4 letterhead or sends the **WhatsApp Link** to the patient.

### Step 4: Analysis (Owner)
The Clinic Owner monitors performance in the **Analytics** dashboard to optimize staff count and inventory.

---

## 5. ROLES & PERMISSIONS (RBAC)
- **Owner**: Full access, financial analytics, clinic branding setup, and staff hiring.
- **Doctor**: Clinical entry, history viewing, and teleconsultation.
- **Staff/Nurse**: Registration, vitals entry, and print queue management.

---

## 6. COMPLIANCE & LEGAL NOTES
Prescripto is built with architectural principles that support HIPAA/GDPR alignment:
- **Data Isolation**: No clinic can access data from another clinic.
- **Audit Trails**: Every visit record created/modified has a traceable `created_at` and `doctor_id` stamp.
- **Sanitized Inputs**: All clinical text is passed through a sanitation layer to prevent cross-site scripting (XSS).

---

## 7. MAINTENANCE & OWNERSHIP
- **Developer**: Gokul V
- **Portfolio**: Gokulv21
- **Tech Lead Role**: Data Analytics & Full Stack Engineering

---
*Created for official record and AI-Assisted optimization (GPT/Gemini).*
