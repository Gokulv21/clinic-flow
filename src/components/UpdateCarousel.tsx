import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, LayoutDashboard, Smartphone, Stethoscope, ShieldCheck, Rocket, LogOut, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const slides = [
  {
    title: "Welcome to PreScripto v2.1",
    description: "We've rebuilt the core architecture to bring you a faster, more secure, and perfectly responsive clinic experience.",
    icon: <Rocket className="w-12 h-12 text-blue-500" />,
    color: "from-blue-500/20 to-cyan-500/20",
    features: ["Faster Reloads", "Bulletproof Security", "Clean New Look"]
  },
  {
    title: "Smarter Dashboard",
    description: "Keep track of your clinic's pulse with real-time stats and the new 'Recently Completed' list.",
    icon: <LayoutDashboard className="w-12 h-12 text-emerald-500" />,
    color: "from-emerald-500/20 to-teal-500/20",
    features: ["Real-time Patient Counts", "Activity Feed", "Live Analytics"]
  },
  {
    title: "Perfectly Responsive",
    description: "Work seamlessly across all your devices. Optimized for iPads, Tablets, and Mobile phones.",
    icon: <Smartphone className="w-12 h-12 text-purple-500" />,
    color: "from-purple-500/20 to-indigo-500/20",
    features: ["iPad Tablet Mode", "Mobile iOS-style Dock", "Ultrawide Support"]
  },
  {
    title: "Enhanced Consultation",
    description: "The doctor's workspace is now wider and clearer, with an improved token sidebar and large action buttons.",
    icon: <Stethoscope className="w-12 h-12 text-blue-600" />,
    color: "from-blue-600/20 to-blue-400/20",
    features: ["Wider Token Sidebar", "Large 'Save' Buttons", "Clearer RX Previews"]
  }
];

export default function UpdateCarousel() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { signOut } = useAuth();

  useEffect(() => {
    const hasSeenUpdate = localStorage.getItem('prescripto_v2.1_update_seen');
    if (!hasSeenUpdate) {
      // Delay opening slightly for a smoother entry
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('prescripto_v2.1_update_seen', 'true');
    setIsOpen(false);
  };

  const next = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      handleClose();
    }
  };

  const prev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(s => s - 1);
    }
  };

  if (!isOpen) return null;

  const slide = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
        onClick={handleClose}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-card border border-white/20 rounded-[2.5rem] shadow-2xl overflow-hidden glass-thick"
      >
        {/* PROGRESS BANNER - HUGE WELCOME */}
        <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 p-6 pt-10 text-center border-b border-white/10 relative overflow-hidden">
           <motion.div
             initial={{ scale: 0.8, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             transition={{ delay: 0.2 }}
             className="relative z-10"
           >
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 mb-2">Platform Update</h3>
             <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-br from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
               WELCOME TO PRESCRIPTO
             </h1>
           </motion.div>
           {/* Abstract shapes in banner */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2" />
           <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 blur-[30px] rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        {/* Progress Dots */}
        <div className="absolute top-48 left-0 right-0 h-1 flex justify-center gap-1.5 z-10">
          {slides.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-1 rounded-full w-8 transition-all duration-500",
                i === currentSlide ? "bg-blue-600 scale-x-110 shadow-[0_0_10px_rgba(37,99,235,0.5)]" : (i < currentSlide ? "bg-blue-600/40" : "bg-white/10")
              )} 
            />
          ))}
        </div>

        <div className="p-8 md:p-10 pt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-6">
                <div className={cn("w-20 h-20 rounded-[1.5rem] flex items-center justify-center bg-gradient-to-br shadow-inner shrink-0", slide.color)}>
                  {slide.icon}
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black tracking-tight text-foreground">{slide.title}</h2>
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">{slide.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {slide.features.map((f, i) => (
                  <motion.div 
                    key={f}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-bold text-foreground/80 lowercase first-letter:uppercase">{f}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-col gap-3 mt-10">
              <div className="flex items-center justify-between ">
                <Button
                  variant="ghost"
                  onClick={prev}
                  disabled={currentSlide === 0}
                  className="rounded-2xl h-11 px-5 font-bold gap-2 active:scale-95 transition-all disabled:opacity-0 text-muted-foreground"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Button>

                <div className="flex gap-2">
                   {currentSlide < slides.length - 1 ? (
                     <Button
                      onClick={next}
                      className="rounded-2xl h-11 px-8 font-bold gap-2 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                   ) : (
                    <Button
                      onClick={handleClose}
                      className="rounded-2xl h-11 px-8 font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all text-white"
                    >
                      Explore Now <ArrowRight className="w-4 h-4" />
                    </Button>
                   )}
                </div>
              </div>

              <div className="h-px bg-white/5 w-full my-1" />

              {/* ACTION BUTTONS: STAY VS EXIT */}
              <div className="flex gap-3">
                 <Button
                   variant="ghost"
                   onClick={handleClose}
                   className="flex-1 rounded-xl h-11 font-black uppercase tracking-widest text-[10px] bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
                 >
                   Stay in App
                 </Button>
                 <Button
                   variant="ghost"
                   onClick={() => signOut()}
                   className="flex-1 rounded-xl h-11 font-black uppercase tracking-widest text-[10px] text-red-500 hover:bg-red-500/10 active:scale-95 transition-all gap-2"
                 >
                   <LogOut className="w-3 h-3" /> Close & Exit
                 </Button>
              </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none" />
      </motion.div>
    </div>
  );
}
