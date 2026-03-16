import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PageBannerProps {
  title: string;
  description: string;
  imageSrc: string;
  className?: string;
  children?: React.ReactNode;
}

export default function PageBanner({ 
  title, 
  description, 
  imageSrc, 
  className,
  children 
}: PageBannerProps) {
  return (
    <div className={cn("relative w-full overflow-hidden bg-white mb-8 group", className)}>
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-transparent z-10" />
      
      <motion.div 
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute right-0 top-0 h-full w-full md:w-3/4 z-0"
      >
        <img 
          src={imageSrc} 
          alt={title} 
          className="w-full h-full object-cover object-right-top md:object-center grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
        />
      </motion.div>

      <div className="relative z-20 px-6 py-12 md:px-12 md:py-16 max-w-7xl mx-auto flex flex-col justify-center min-h-[220px] md:min-h-[280px]">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3 drop-shadow-sm">
            {title}
          </h1>
          <p className="text-slate-500 text-sm md:text-lg max-w-xl font-medium leading-relaxed">
            {description}
          </p>
        </motion.div>
        
        {children && (
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-6"
          >
            {children}
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-slate-200 via-slate-100 to-transparent z-30" />
    </div>
  );
}
