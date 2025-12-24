
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 space-y-6 border-2 border-slate-200 dark:border-slate-700">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                <div className="relative p-4 bg-white rounded-2xl shadow-2xl">
                  <img src="/Cacique_logo.png" alt="Rede Cacique" className="w-48 h-auto" />
                </div>
              </div>
            </div>
            <p className="text-base text-slate-600 dark:text-slate-400 font-semibold">
              {isLogin ? '💼 Faça login para continuar' : '🚀 Crie sua conta'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">📧 E-mail</label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-14 border-2 border-slate-300 dark:border-slate-600 focus:border-red-500 dark:focus:border-red-400 shadow-sm rounded-2xl text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">🔒 Senha</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-14 pr-12 border-2 border-slate-300 dark:border-slate-600 focus:border-red-500 dark:focus:border-red-400 shadow-sm rounded-2xl text-base"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl" 
              disabled={loading}
            >
              {loading ? '⏳ Aguarde...' : (isLogin ? <><LogIn className="mr-2 h-5 w-5" /> ✅ Entrar</> : <><UserPlus className="mr-2 h-5 w-5" /> 🚀 Criar Conta</>)}
            </Button>
          </form>

          <div className="text-center pt-4 border-t-2 border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-2 transition-colors underline"
              >
                {isLogin ? '🚀 Crie uma agora' : '✅ Faça login'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
