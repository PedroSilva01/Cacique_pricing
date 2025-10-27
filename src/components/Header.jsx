
import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Fuel, Zap, LogOut, BarChart2, LineChart, Calculator, DollarSign, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const Header = () => {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navLinkClass = ({ isActive }) =>
    cn(
      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      isActive
        ? "bg-secondary text-primary"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    );

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
      className="bg-card/80 backdrop-blur-lg border-b sticky top-0 z-50"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Fuel className="w-8 h-8 text-primary" />
              <Zap className="w-4 h-4 text-yellow-400 absolute -top-1 -right-1" />
            </div>
            <div>
              <h2 className="text-xl font-bold gradient-text">Fuel Analyzer</h2>
              <p className="text-xs text-muted-foreground">Rede Cacique</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-2">
            <NavLink to="/dashboard" className={navLinkClass}>
              <BarChart2 className="w-4 h-4" />
              Dashboard
            </NavLink>
            <NavLink to="/price-entry" className={navLinkClass}>
              <DollarSign className="w-4 h-4" />
              Lançar Preços
            </NavLink>
            <NavLink to="/simulator" className={navLinkClass}>
              <Calculator className="w-4 h-4" />
              Simulador
            </NavLink>
            <NavLink to="/analysis" className={navLinkClass}>
              <LineChart className="w-4 h-4" />
              Análise Histórica
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              <SlidersHorizontal className="w-4 h-4" />
              Configurações
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <Button onClick={toggleTheme} size="icon" variant="ghost">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button onClick={signOut} size="sm" variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
