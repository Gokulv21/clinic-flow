import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Activity, ShieldAlert, Wrench } from "lucide-react";
import PageBanner from "@/components/PageBanner";
import userMgmtBanner from "@/assets/user_mgmt_banner.png";

export default function SaaSManagement() {
  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-500 pb-12">
      <PageBanner
        title="SaaS Management"
        description="Manage your clinic's subscription tier, billing, API usage, and administrative audit trails."
        imageSrc={userMgmtBanner}
      >
        <div className="w-24 h-24 flex items-center justify-center bg-white/20 rounded-2xl backdrop-blur-sm -ml-4 border border-white/30 text-white shadow-xl">
           <Wrench className="w-10 h-10" />
        </div>
      </PageBanner>

      <div className="px-4 md:px-8 mt-8">
         <Tabs defaultValue="subscription" className="w-full">
            <TabsList className="bg-card w-full flex border-b border-border p-1 rounded-2xl shadow-sm mb-6 h-auto">
               <TabsTrigger value="subscription" className="flex-1 py-3 text-xs md:text-sm font-bold gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 rounded-xl">
                 <CreditCard className="w-4 h-4" /> Subscription
               </TabsTrigger>
               <TabsTrigger value="usage" className="flex-1 py-3 text-xs md:text-sm font-bold gap-2 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600 rounded-xl">
                 <Activity className="w-4 h-4" /> Usage Limits
               </TabsTrigger>
               <TabsTrigger value="audit" className="flex-1 py-3 text-xs md:text-sm font-bold gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 rounded-xl">
                 <ShieldAlert className="w-4 h-4" /> Audit Logs
               </TabsTrigger>
            </TabsList>

            <TabsContent value="subscription" className="space-y-6">
                <DevelopmentPlaceholder title="Billing & Stripe Integration" />
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
                <DevelopmentPlaceholder title="API & Data Usage Analytics" />
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
                <DevelopmentPlaceholder title="System Audit Trails" />
            </TabsContent>
         </Tabs>
      </div>
    </div>
  );
}

function DevelopmentPlaceholder({ title }: { title: string }) {
    return (
        <Card className="border-2 border-dashed border-muted shadow-none bg-muted/20 rounded-3xl">
            <CardHeader className="text-center pt-16">
               <div className="mx-auto w-16 h-16 bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  <Wrench className="w-8 h-8" />
               </div>
               <CardTitle className="text-2xl font-black">{title}</CardTitle>
               <CardDescription className="max-w-md mx-auto mt-2 font-medium">
                  We are actively building this feature. Future integration will allow you to control and scale your SaaS clinic operations seamlessly.
               </CardDescription>
            </CardHeader>
            <CardContent className="pb-16 flex justify-center">
                 <div className="bg-amber-400 text-amber-900 font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded-full flex items-center gap-2 shadow-sm">
                     <span className="w-2 h-2 rounded-full bg-amber-900 animate-pulse" />
                     Under Development
                 </div>
            </CardContent>
        </Card>
    );
}
