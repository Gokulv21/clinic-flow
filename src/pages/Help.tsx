import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Info, HelpCircle, LogIn, ClipboardPlus, Stethoscope, Printer, 
  BarChart3, UserCog, Zap, Sparkles, ShieldCheck, Smartphone, 
  Database, RefreshCw, PenTool, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Help() {
  const features = [
    {
      title: "Digital Prescription Pad",
      desc: "Write prescriptions naturally using iPad & Apple Pencil. Zero-latency digital ink for a premium feel.",
      icon: <PenTool className="w-6 h-6 text-blue-500" />,
      color: "bg-blue-50 dark:bg-blue-950/30"
    },
    {
      title: "Advanced Analytics",
      desc: "Real-time insights into patient volume, common diagnoses, and clinic growth trends.",
      icon: <BarChart3 className="w-6 h-6 text-indigo-500" />,
      color: "bg-indigo-50 dark:bg-indigo-950/30"
    },
    {
      title: "Installs as App (PWA)",
      desc: "Works offline and installs on your phone or desktop for instant access without a browser bar.",
      icon: <Smartphone className="w-6 h-6 text-emerald-500" />,
      color: "bg-emerald-50 dark:bg-emerald-950/30"
    },
    {
      title: "Real-time Sync",
      desc: "Patient vitals entered by staff appear instantly on the doctor's screen without refreshing.",
      icon: <RefreshCw className="w-6 h-6 text-amber-500" />,
      color: "bg-amber-50 dark:bg-amber-950/30"
    },
    {
      title: "Opulent PDF Prints",
      desc: "Generate professional, beautifully designed prescriptions optimized for A4 printers.",
      icon: <Printer className="w-6 h-6 text-rose-500" />,
      color: "bg-rose-50 dark:bg-rose-950/30"
    },
    {
      title: "Clinical Privacy",
      desc: "State-of-the-art security patterns ensuring patient data is handled with maximum care.",
      icon: <ShieldCheck className="w-6 h-6 text-slate-700 dark:text-slate-300" />,
      color: "bg-slate-50 dark:bg-slate-800/50"
    }
  ];

  const faqSections = [
    {
      title: "Login & Access",
      icon: <LogIn className="w-5 h-5 text-blue-500" />,
      questions: [
        {
          q: "How do I login to the system?",
          a: "You can login using your registered email and password at the login page. Each user (Doctor or Staff) must have an account created by the administrator."
        },
        {
          q: "What is the official login link?",
          a: "The official URL for Prescripto is: https://gokulv21.github.io/prescripto/"
        },
        {
          q: "I forgot my password, what should I do?",
          a: "Please contact your system administrator to reset your password or use the 'Forgot Password' link on the login page if enabled."
        }
      ]
    },
    {
      title: "Patient Entry (For Staff)",
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
          a: "Administrators can use the 'User Mgmt' tab to invite new staff members and assign roles (Doctor, Staff)."
        }
      ]
    }
  ];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-16 animate-in fade-in duration-700 pb-20">
      
      {/* Hero Section */}
      <div className="text-center space-y-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-blue-500/10 blur-[80px] -z-10 rounded-full" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800 mb-2">
           <Zap className="w-3 h-3" /> System Guide & Features
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-800 dark:text-slate-100 leading-tight">
          Modernizing <span className="text-blue-600">PreScripto</span>
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-medium">
          A high-performance digital healthcare platform optimized for premium patient care and efficient management.
        </p>
      </div>
      
      {/* Salient Features Section */}
      <div className="space-y-8">
        <div className="flex items-center gap-3">
           <Sparkles className="w-6 h-6 text-amber-500" />
           <h2 className="text-2xl font-black tracking-tight dark:text-slate-100">Salient Features</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Card key={i} className="border-none shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 bg-white dark:bg-slate-900 overflow-hidden group">
               <CardContent className="p-8 space-y-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 ${f.color}`}>
                     {f.icon}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                      {f.desc}
                    </p>
                  </div>
               </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="grid lg:grid-cols-3 gap-12 pt-8 border-t border-slate-100 dark:border-slate-800">
        <div className="space-y-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl w-fit shadow-lg shadow-blue-200 dark:shadow-none">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h2 className="text-3xl font-black tracking-tight dark:text-slate-100">Common Questions</h2>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Everything you need to know about operating the Prescripto platform. Can't find an answer? Contact support below.
          </p>
          
          <div className="pt-6 space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Official Support</p>
              <p className="text-xl font-black text-slate-800 dark:text-slate-100">+91 9488017536</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">Available 24/7 for emergency assist</p>
            </div>
            <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-slate-200 dark:border-slate-800">
               Visit Knowledge Base
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqSections.map((section, idx) => (
              <AccordionItem
                key={idx}
                value={`section-${idx}`}
                className="border-none rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden px-6"
              >
                <AccordionTrigger className="hover:no-underline py-5 group">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                      {section.icon}
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-lg tracking-tight">
                      {section.title}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-8 space-y-6 border-t border-slate-50 dark:border-slate-800 pt-6">
                  {section.questions.map((item, qIdx) => (
                    <div key={qIdx} className="space-y-2">
                      <p className="font-black text-slate-800 dark:text-slate-100 text-sm flex items-start gap-2">
                        <span className="text-blue-600">Q:</span>
                        {item.q}
                      </p>
                      <p className="text-muted-foreground text-[13px] leading-relaxed pl-6 font-medium">
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

      {/* Footer Branding */}
      <div className="text-center pt-10">
         <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.5em]">
           Prescripto Healthcare — Opulent Digital Solutions
         </p>
      </div>

    </div>
  );
}
