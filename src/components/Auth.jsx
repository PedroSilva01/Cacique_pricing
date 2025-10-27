
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Fuel, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password);

    if (!error && !isLogin) {
      toast({
        title: "✅ Inscrição bem-sucedida!",
        description: "Verifique seu e-mail para confirmar sua conta.",
      });
      setIsLogin(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <Fuel className="mx-auto h-12 w-12 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800 mt-2">Fuel Price Analyzer</h1>
            <p className="text-gray-500">
              {isLogin ? 'Faça login para continuar' : 'Crie sua conta'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
              {loading ? 'Aguarde...' : (isLogin ? <><LogIn className="mr-2 h-5 w-5" /> Entrar</> : <><UserPlus className="mr-2 h-5 w-5" /> Criar Conta</>)}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-blue-600 hover:text-blue-500 ml-1"
            >
              {isLogin ? 'Crie uma agora' : 'Faça login'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
