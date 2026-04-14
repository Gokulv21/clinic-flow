import { Card, CardContent } from '@/components/ui/card';
import { Rocket, Sparkles, Wrench, Hammer } from 'lucide-react';
import PageBanner from '@/components/PageBanner';
import userMgmtBanner from '@/assets/user_mgmt_banner.png';
import Lottie from "lottie-react";
import communicationAnimation from "@/assets/animations/analytics.json";
import { motion } from 'framer-motion';

export default function Calls() {
  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-500 pb-12">
      <PageBanner
        title="Consult Staff"
        description="Connect instantly with doctors and clinic staff for real-time consultation."
        imageSrc={userMgmtBanner}
      >
        <div className="w-24 h-24 md:w-32 md:h-32 -ml-4">
          <Lottie animationData={communicationAnimation} loop={true} />
        </div>
      </PageBanner>

      <div className="px-4 md:px-8 mt-12 flex justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-none shadow-xl bg-card overflow-hidden rounded-[2rem] border-2 border-blue-500/20">
            <CardContent className="p-12 text-center flex flex-col items-center">
              <div className="relative mb-8">
                  <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center relative z-10">
                    <Rocket className="w-12 h-12 text-blue-500 animate-pulse" />
                  </div>
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
                    className="absolute -inset-4 border-2 border-dashed border-blue-500/30 rounded-full z-0"
                  />
                  <div className="absolute top-0 right-0 -mr-2 -mt-2 bg-amber-400 text-amber-900 text-[10px] font-black uppercase px-2 py-1 rounded-full shadow-lg transform rotate-12 flex items-center gap-1 z-20">
                     <Sparkles className="w-3 h-3" /> Coming Soon
                  </div>
              </div>
              
              <h2 className="text-3xl font-black text-foreground mb-4 tracking-tight">Telemedicine 2.0 is Brewing!</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto mb-8">
                We are completely revamping the staff consultation and patient calling experience. The new module will feature crystal-clear video streaming, unmetered calls, and integrated screen sharing. Development is currently underway!
              </p>

              <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Wrench className="w-4 h-4 text-blue-500" /> Engineering</span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1.5"><Hammer className="w-4 h-4 text-amber-500" /> Crafting</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
