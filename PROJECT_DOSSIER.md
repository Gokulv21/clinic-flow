# PROJECT DOSSIER: CLINIC FLOW (GV CLINIC)
### Version 2.0.0 | Official Technical Documentation

---

## 1. EXECUTIVE SUMMARY
**Clinic Flow** is a high-performance, tablet-optimized clinic management and digital prescription system designed for modern healthcare practices. The platform integrates patient registration, clinical vitals tracking, and a state-of-the-art digital handwriting engine for prescriptions, providing a seamless bridge between traditional medical charting and modern electronic health records (EHR).

Developed with a focus on "opulent aesthetics" and "technical precision," the system is tailored for Apple Pencil integration, ensuring that doctors can maintain their natural writing flow while benefiting from digital data storage and instant printing.

---

## 2. TECHNICAL ARCHITECTURE
### 2.1 Frontend Infrastructure
- **Framework**: React 18 with TypeScript for type-safe development.
- **Build System**: Vite 5+ with high-speed HMR (Hot Module Replacement).
- **Styling Engine**: Tailwind CSS for responsive layouts and Shadcn/UI for premium, accessible components.
- **State Management**: React Query (TanStack Query) for efficient server-state synchronization.
- **Routing**: React Router 6.30 for multi-role navigation and protected pathing.

### 2.2 Backend & Data Integrity
- **Platform**: Supabase (PostgreSQL)
- **Authentication**: JWT-based secure auth with role-based access control (RBAC).
- **Database Architecture**: 
    - `patients`: Master record repository.
    - `visits`: Token-based session tracking.
    - `prescriptions`: Encapsulated clinical decisions and digital assets.
    - `profiles`: User management for Doctors, Nurses, and Staff.
- **Storage**: Supabase Storage for high-fidelity preservation of digital handwriting assets.

---

## 3. CORE SYSTEMS & INNOVATIONS
### 3.1 Advanced Handwriting Engine
The system features a custom-built canvas engine optimized for **Apple Pencil**:
- **Rendering**: Uses `requestAnimationFrame` for 120Hz-ready drawing.
- **Precision**: Integrated `perfect-freehand` library for pressure-sensitive, artist-level stroke smoothing.
- **Gesture Control**: Separate processing for stylus input and multi-touch gestures (pinch-to-zoom/pan) using `@use-gesture/react`.

### 3.2 Opulent Prescription Template
Designed for professional impact and printer efficiency:
- **Dynamic Theming**: CSS-in-JS filters that dynamically adapt the clinic logo to match the primary slate-blue brand palette.
- **Print Optimization**: Minimal usage of solid color blocks to ensure eco-friendly, fast printing without compromising the premium aesthetic.
- **A4 Synchronization**: Strict layout consistency ensuring digital previews match physical 210mm x 297mm paper outputs.

---

## 4. SECURITY & DATA PRIVACY
### 4.1 Row Level Security (RLS)
The database enforces strict RLS policies, ensuring that:
- Doctors can only see patients within their legitimate practice scope.
- Medical data is isolated from administrative access where appropriate.
- Audit logs are maintained for every visit and clinical entry.

### 4.2 Environmental Isolation
Configurations are managed via environment-specific variables, separating development, staging, and production environments to prevent data leakage.

---

## 5. RECENT PATCH NOTES & RELEASES
### V2.0.0 (Current) - "Branding & Performance Update"
- **Canvas Overhaul**: Switched to pointer-events API for superior stylus response.
- **Branding Integration**: Full deployment of "GV Clinic" assets, including custom icons and themed headers.
- **History System**: Added "Prescription Recall" enabling doctors to re-print prescriptions from previous visits.
- **Unit Standardization**: Enforced strict clinical units (mmHg, kg, SpO2 %) across all data points.

### V1.5.0 - "Queue & Vitals Refinement"
- Implemented real-time token tracking for patient queues.
- Automated vital signs input with unit validation.

---

## 6. CLINICAL WORKFLOW
1. **Patient Entry (Nurse)**: Rapid registration and vitals entry (BP, Pulse, Weight, Temp).
2. **Consultation (Doctor)**: Review of history, symptom entry, and digital prescription drawing.
3. **Queue Management**: Shared real-time view of patient status (Waiting, Active, Completed).
4. **Fulfillment (Front Desk)**: Instant printing from the print queue for the patient.

---

## 7. MAINTENANCE & CONTACT
- **Lead Developer**: Gokul V
- **Platform URL**: [https://gokulv21.github.io/clinic-flow/](https://gokulv21.github.io/clinic-flow/)
- **Contact**: +91 9488017536

---
*This document serves as an official technical record of the Clinic Flow system architecture and implementation.*
