import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Stethoscope, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);

    if (error) {
      toast.error('Invalid credentials');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-500">
      <Card className="w-full max-w-md border-primary/20 shadow-2xl glassmorphism overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
        <CardHeader className="text-center space-y-6 pt-10">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-foreground/20 flex items-center justify-center shadow-inner relative group">
            <div className="absolute inset-0 rounded-2xl bg-primary blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
            <Stethoscope className="w-10 h-10 text-primary-foreground relative z-10" />
          </div>
          <div>
            <CardTitle className="text-3xl font-heading font-bold tracking-tight">Prescripto</CardTitle>
            <CardDescription className="text-base font-medium text-muted-foreground/80">
              Hospital Management System
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-10 px-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Username</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your username"
                className="h-12 border-primary/10 focus-visible:ring-primary/30 transition-shadow"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 border-primary/10 focus-visible:ring-primary/30 transition-shadow"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-13 text-lg font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Sign In
            </Button>

            <p className="text-center text-xs text-muted-foreground pt-2">
              Contact administrator if you forgot your credentials
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

