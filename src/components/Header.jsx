
import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, BarChart2, LineChart, DollarSign, SlidersHorizontal, Sun, Moon, Route, Edit3, Building, ShoppingCart, BarChart3, ChevronDown, Menu, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header = () => {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }) =>
    cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold whitespace-nowrap",
      isActive
        ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg scale-105"
        : "text-slate-600 dark:text-slate-300 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-50 dark:hover:from-red-900/20 dark:hover:to-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:scale-102"
    );

  const dropdownButtonClass = (paths) => {
    const isActive = paths.some(path => location.pathname === path);
    return cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold whitespace-nowrap cursor-pointer",
      isActive
        ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg"
        : "text-slate-600 dark:text-slate-300 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-50 dark:hover:from-red-900/20 dark:hover:to-red-900/20 hover:text-red-600 dark:hover:text-red-400"
    );
  };

  const NavItems = () => (
    <>
      <NavLink to="/dashboard" className={navLinkClass}>
        <BarChart2 className="w-4 h-4" />
        Dashboard
      </NavLink>

      {/* Dropdown Preços */}
      <DropdownMenu>
        <DropdownMenuTrigger className={dropdownButtonClass(['/price-entry', '/price-edit', '/group-prices'])}>
          <DollarSign className="w-4 h-4" />
          Preços
          <ChevronDown className="w-3 h-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => navigate('/price-entry')} className="cursor-pointer">
            <DollarSign className="w-4 h-4 mr-2" />
            Lançar Preços
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/price-edit')} className="cursor-pointer">
            <Edit3 className="w-4 h-4 mr-2" />
            Editar Preços
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/group-prices')} className="cursor-pointer">
            <Building className="w-4 h-4 mr-2" />
            Preços por Grupo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NavLink to="/purchase-orders" className={navLinkClass}>
        <ShoppingCart className="w-4 h-4" />
        Pedidos
      </NavLink>

      {/* Dropdown Análises */}
      <DropdownMenu>
        <DropdownMenuTrigger className={dropdownButtonClass(['/analysis', '/financial-dashboard', '/volume-analytics'])}>
          <BarChart3 className="w-4 h-4" />
          Análises
          <ChevronDown className="w-3 h-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => navigate('/analysis')} className="cursor-pointer">
            <LineChart className="w-4 h-4 mr-2" />
            Análise Histórica
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/financial-dashboard')} className="cursor-pointer">
            <TrendingUp className="w-4 h-4 mr-2" />
            Dashboard Financeiro
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/volume-analytics')} className="cursor-pointer">
            <BarChart3 className="w-4 h-4 mr-2" />
            Análise de Volume
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NavLink to="/settings" className={navLinkClass}>
        <SlidersHorizontal className="w-4 h-4" />
        Configurações
      </NavLink>

      <NavLink to="/freight-detail" className={navLinkClass}>
        <Route className="w-4 h-4" />
        Frete
      </NavLink>
    </>
  );

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b-2 border-slate-200 dark:border-slate-700 shadow-xl sticky top-0 z-50"
    >
      <div className="w-full px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-red-600 rounded-xl blur-md opacity-40 animate-pulse"></div>
              <div className="relative p-1.5 sm:p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl">
                <img src="/Cacique_logo.png" alt="Rede Cacique" className="h-8 sm:h-10 w-auto" />
              </div>
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Sistema de Gestão de Preços</p>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            <NavItems />
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button 
              onClick={toggleTheme} 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-50 dark:hover:from-red-900/20 dark:hover:to-red-900/20 transition-all"
            >
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-red-600" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-red-400" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            
            {/* Mobile Menu Button */}
            <Button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              size="icon" 
              variant="ghost"
              className="lg:hidden h-9 w-9 sm:h-10 sm:w-10 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-50 dark:hover:from-red-900/20 dark:hover:to-red-900/20 transition-all"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            
            <Button 
              onClick={signOut} 
              size="sm" 
              className="hidden sm:flex border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold shadow-md hover:shadow-lg transition-all rounded-xl bg-transparent"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
            <Button 
              onClick={signOut} 
              size="icon" 
              className="sm:hidden h-9 w-9 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl bg-transparent"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden"
            >
              <nav className="py-4 border-t-2 border-slate-200 dark:border-slate-700 mt-4">
                <div className="grid grid-cols-2 gap-2">
                  <NavItems />
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
};

export default Header;
