import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageBanner from '@/components/PageBanner';
import printQueueBanner from '@/assets/print_queue_banner.png';
import { Printer, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import { printPrescription as renderAndPrintPrescription } from '@/lib/printPrescription';

export default function PrintQueue() {
  const queryClient = useQueryClient();

  // 1. Fetch Active Print Requests via React Query
  const { data: prescriptions = [], isLoading, refetch: refetchPrescriptions } = useQuery({
    queryKey: ['prescriptionsToPrint'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, patients(*), visits(*) ')
        .eq('is_printed', false) // FOCUS ONLY on unprinted for less server load
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true }); // Process oldest first
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 10000,
  });

  useEffect(() => {
    let debounceTimer: any;
    const channel = supabase
      .channel('prescriptions-realtime-v2')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'prescriptions',
        filter: 'is_printed=eq.false' // Listen ONLY for new unprinted items
      }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!document.hidden) {
            queryClient.invalidateQueries({ queryKey: ['prescriptionsToPrint'] });
          }
        }, 1500); 
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const [printData, setPrintData] = useState<any>(null);

  useEffect(() => {
    if (printData) {
      // Reduced delay for faster responsiveness
      const timer = setTimeout(() => {
        renderAndPrintPrescription();
        markPrinted(printData.id);
        setPrintData(null);
      }, 100); 
      return () => clearTimeout(timer);
    }
  }, [printData]);

  const markPrinted = async (id: string) => {
    const { error } = await supabase.from('prescriptions').update({ is_printed: true }).eq('id', id);
    if (error) toast.error('Failed to update');
    else {
      toast.success('Printed & Cleared');
      // Optimistically remove from list
      queryClient.setQueryData(['prescriptionsToPrint'], (old: any) => old?.filter((p: any) => p.id !== id));
    }
  };

  const printPrescription = (rx: any) => {
    setPrintData(rx);
  };


  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-12">
      <PageBanner
        title="Pharmacy Print Queue"
        description="Monitor and process prescription print requests in real-time for efficient patient service."
        imageSrc={printQueueBanner}
      />

      {/* Hidden print container */}
      {printData && (
        <div className="fixed inset-0 opacity-0 pointer-events-none z-[-1]">
          {(() => {
            const isWritingMode = printData.is_writing_mode ?? (!!printData.advice_image && (printData.advice_image.startsWith('data:image') || printData.advice_image.startsWith('[')));
            return (
              <PrescriptionTemplate
                patient={printData.patients}
                visit={printData.visits}
                diagnosis={printData.diagnosis}
                clinicalNotes={printData.clinical_notes}
                medicines={printData.medicines}
                advice={!isWritingMode ? printData.advice_image : null}
                handwrittenImage={printData.advice_image || null}
                isWritingMode={isWritingMode}
                isPrint={true}
                doctorId={printData.doctor_id}
                prescriptionCreatedAt={printData.created_at}
              />
            );
          })()}
        </div>
      )}

      <div className="px-4 md:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Prescriptions To Print</h1>
            <p className="text-muted-foreground">{prescriptions.length} items currently waiting</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchPrescriptions()}
            disabled={isLoading}
            className="gap-2 h-9 border-border hover:bg-muted btn-liquid-pop overflow-hidden"
            asChild
          >
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
            >
              <motion.div
                animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
                transition={isLoading ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: "spring", stiffness: 500, damping: 30 }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
              </motion.div>
              <span>Manual Refresh</span>
            </motion.button>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 max-w-4xl mx-auto">
          {prescriptions.map(rx => (
            <Card key={rx.id} className="animate-fade-in border-border bg-card hover:bg-muted/20 transition-colors shadow-sm">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-foreground">{(rx.patients?.title ? rx.patients.title + ' ' : '') + rx.patients?.name}</span>
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-none font-bold">TOKEN #{rx.visits?.token_number}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(rx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {rx.diagnosis && <span className="text-muted-foreground/60">· {rx.diagnosis}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                   <Button onClick={() => printPrescription(rx)} className="gap-2 px-6 shadow-md hover:shadow-lg transition-all" size="lg">
                    <Printer className="w-4 h-4" />Print Prescription
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {prescriptions.length === 0 && !isLoading && (
            <div className="text-center py-20 bg-card/50 rounded-3xl border-2 border-dashed border-border">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-foreground">All Caught Up!</h3>
              <p className="text-muted-foreground mt-1">There are no prescriptions waiting in the queue.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}