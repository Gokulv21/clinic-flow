export interface Medicine {
  type: string;
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  notes?: string;
  count?: string;
}

export interface VisitDraft {
  diagnosis: string;
  clinicalNotes: string;
  medicines: Medicine[];
  advice: string;
  prescriptionImage: any;
  prescriptionPaths: any[];
  isWritingMode: boolean;
  lastInputWay: 'typing' | 'writing';
  timestamp: number;
  diagnoses?: string[];
}

export interface ConsultationState {
  diagnosis: string;
  diagnoses: string[];
  clinicalNotes: string;
  medicines: Medicine[];
  advice: string;
  prescriptionImage: any;
  prescriptionPaths: any[];
  isWritingMode: boolean;
  lastInputWay: 'typing' | 'writing';
}
