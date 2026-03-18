import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Info, HelpCircle, LogIn, ClipboardPlus, Stethoscope, Printer, BarChart3, UserCog } from "lucide-react";

export default function Help() {
  const faqSections = [
    {
      title: "Login & Access",
      icon: <LogIn className="w-5 h-5 text-blue-500" />,
      questions: [
        {
          q: "How do I login to the system?",
          a: "You can login using your registered email and password at the login page. Each user (Doctor, Nurse, or Staff) must have an account created by the administrator."
        },
        {
          q: "What is the official login link?",
          a: "The official URL for Clinic Flow is: https://gokulv21.github.io/clinic-flow/"
        },
        {
          q: "I forgot my password, what should I do?",
          a: "Please contact your system administrator to reset your password or use the 'Forgot Password' link on the login page if enabled."
        }
      ]
    },
    {
      title: "Patient Entry (For Nurses)",
      icon: <ClipboardPlus className="w-5 h-5 text-emerald-500" />,
      questions: [
        {
          q: "How do I register a new patient?",
          a: "Go to the 'Patient Entry' tab, click 'New Patient', and fill in the details like Name, Age, and Contact Number."
        },
        {
          q: "How do I enter vitals for a visit?",
          a: "After selecting a patient in 'Patient Entry', you can enter Weight, BP (in mmHg), Pulse, SpO2, and Temperature. These will be automatically saved to the patient's token for the doctor to see."
        }
      ]
    },
    {
      title: "Consultation (For Doctors)",
      icon: <Stethoscope className="w-5 h-5 text-indigo-500" />,
      questions: [
        {
          q: "How do I start a consultation?",
          a: "Click on the 'Consultation' tab. You will see a queue of patients waiting. Tap on a patient's name to open their consultation window."
        },
        {
          q: "How do I use the digital drawing pad?",
          a: "Inside the consultation window, click 'Open Template (iPad/Pen)'. You can then write or draw using your stylus (optimized for Apple Pencil). Use the toolbar to change colors or eraser size."
        },
        {
          q: "Can I view previous prescriptions?",
          a: "Yes. In the 'Patients' tab, select a patient and look at their 'Visit History'. You can click the 'Prescription' button on any past visit to re-print or review it."
        }
      ]
    },
    {
      title: "Printing & Prescriptions",
      icon: <Printer className="w-5 h-5 text-amber-500" />,
      questions: [
        {
          q: "How do I print a prescription?",
          a: "Once the doctor saves a prescription, it appears in the 'Print Queue'. Staff can go there and click 'Print' to generate the official A4 output."
        },
        {
          q: "Is the prescription printer-friendly?",
          a: "Yes. The design is optimized for minimal ink usage while maintaining an opulent, professional look suitable for clinical practice."
        }
      ]
    },
    {
      title: "Management & Analytics",
      icon: <BarChart3 className="w-5 h-5 text-rose-500" />,
      questions: [
        {
          q: "Where can I see clinic statistics?",
          a: "The 'Analytics' tab provides charts on daily patient flow, common diagnoses, and workload patterns."
        },
        {
          q: "How do I manage clinic users?",
          a: "Administrators can use the 'User Mgmt' tab to invite new staff members and assign roles (Doctor, Nurse, Printer)."
        }
      ]
    }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-heading font-black tracking-tight text-slate-800 flex items-center justify-center gap-3">
          <HelpCircle className="w-8 h-8 text-primary" />
          Help
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          A high-performance digital healthcare platform optimized for GV Clinic.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/10 shadow-sm col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Quick Help
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            <p>
              Welcome to the Help Center. Clinic Flow is designed to be intuitive, but if you have questions, please check the categories on the right.
            </p>
            <div className="p-3 bg-white rounded-lg border border-primary/10">
              <p className="font-bold text-xs text-primary uppercase mb-1">Clinic Support</p>
              <p className="text-slate-700 font-medium">+91 9488017536</p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground italic" style={{ textAlign: 'center' }}>
                GV Clinic Official
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-4">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqSections.map((section, idx) => (
              <AccordionItem
                key={idx}
                value={`section-${idx}`}
                className="border rounded-xl bg-white shadow-sm overflow-hidden px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">
                      {section.icon}
                    </div>
                    <span className="font-bold text-slate-700 text-lg tracking-tight">
                      {section.title}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-6 space-y-4 border-t pt-4">
                  {section.questions.map((item, qIdx) => (
                    <div key={qIdx} className="space-y-1">
                      <p className="font-extrabold text-slate-800 text-sm flex items-start gap-2">
                        <span className="text-primary mt-0.5">Q:</span>
                        {item.q}
                      </p>
                      <p className="text-slate-600 text-[13px] leading-relaxed pl-6">
                        {item.a}
                      </p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
