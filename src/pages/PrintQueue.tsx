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
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import { printPrescription as renderAndPrintPrescription } from '@/lib/printPrescription';

export default function PrintQueue() {
  const queryClient = useQueryClient();

  // 1. Fetch Today's Prescriptions via React Query
  const { data: prescriptions = [], isLoading, refetch: refetchPrescriptions } = useQuery({
    queryKey: ['prescriptionsToday'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, patients(*), visits(*)')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 10000,
  });

  useEffect(() => {
    let debounceTimer: any;
    const channel = supabase
      .channel('prescriptions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['prescriptionsToday'] });
        }, 2000);
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
      toast.success('Marked as printed');
      queryClient.invalidateQueries({ queryKey: ['prescriptionsToday'] });
    }
  };

  const printPrescription = (rx: any) => {
    setPrintData(rx);
  };

  const unprinted = prescriptions.filter(p => !p.is_printed);
  const printed = prescriptions.filter(p => p.is_printed);

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
              />
            );
          })()}
        </div>
      )}

      <div className="px-4 md:px-8 space-y-8">
        <div className="print:hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-heading font-bold">Print Queue Status</h1>
              <p className="text-muted-foreground">{unprinted.length} prescriptions waiting to be processed</p>
            </div>
          </div>
        </div>

      <Tabs defaultValue="unprinted" className="print:hidden">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="unprinted" className="gap-2">
              <Clock className="w-4 h-4" />Unprinted ({unprinted.length})
            </TabsTrigger>
            <TabsTrigger value="printed" className="gap-2">
              <CheckCircle className="w-4 h-4" />Printed ({printed.length})
            </TabsTrigger>
          </TabsList>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchPrescriptions()}
            disabled={isLoading}
            className="gap-2 h-9"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
          </Button>
        </div>

        <TabsContent value="unprinted" className="space-y-3">
          {unprinted.map(rx => (
            <Card key={rx.id} className="animate-fade-in">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{(rx.patients?.title ? rx.patients.title + ' ' : '') + rx.patients?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Token #{rx.visits?.token_number} · {new Date(rx.created_at).toLocaleTimeString()}
                    {rx.diagnosis ? ` · ${rx.diagnosis}` : ''}
                  </p>
                </div>
                <Button onClick={() => printPrescription(rx)} className="gap-2">
                  <Printer className="w-4 h-4" />Print
                </Button>
              </CardContent>
            </Card>
          ))}
          {unprinted.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>All prescriptions have been printed</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="printed" className="space-y-3">
          {printed.map(rx => (
            <Card key={rx.id} className="opacity-70">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{(rx.patients?.title ? rx.patients.title + ' ' : '') + rx.patients?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Token #{rx.visits?.token_number} · {new Date(rx.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="secondary" className="gap-1"><CheckCircle className="w-3 h-3" />Printed</Badge>
                  <Button onClick={() => printPrescription(rx)} variant="outline" size="sm" className="gap-1">
                    <Printer className="w-3 h-3" /> Re-Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}