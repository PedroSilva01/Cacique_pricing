import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { WeekPicker } from '@/components/ui/week-picker';
import { Download, TrendingUp, TrendingDown, DollarSign, Truck, Filter, BarChart3, AlertTriangle, FileText } from 'lucide-react';
import Pagination from '@/components/ui/pagination';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

export default function FinancialDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  // Função para formatar moeda
  const formatCurrency = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Função para calcular data de pagamento
  const calculatePaymentDate = (invoiceDate, paymentDays) => {
    if (!invoiceDate) return null;
    const invoice = new Date(invoiceDate + 'T00:00:00');
    const days = parseInt(paymentDays) || 0;
    invoice.setDate(invoice.getDate() + days);
    return invoice;
  };

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [postos, setPostos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState({});
  const [priceDeviationAlerts, setPriceDeviationAlerts] = useState([]);
  
  // Estados para controle de limites diários
  const [weeklyLimits, setWeeklyLimits] = useState({});
  const [selectedWeek, setSelectedWeek] = useState(() => {
    // Usar horário local brasileiro (UTC-3)
    const now = new Date();
    const currentDay = now.getDay(); // 0=domingo, 1=segunda, 2=terça...
    
    // Calcular quantos dias voltar para chegar à segunda-feira
    let daysToSubtract;
    if (currentDay === 0) { // Domingo
      daysToSubtract = 6; // Voltar 6 dias para pegar segunda anterior
    } else { // Segunda a sábado
      daysToSubtract = currentDay - 1; // Voltar para segunda desta semana
    }
    
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
    
    // Debug removido - cálculo da semana funcionando corretamente
    
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const day = String(monday.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [editingLimits, setEditingLimits] = useState({});
  
  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(30);

  const [startDate, setStartDate] = useState(() => {
    // Primeiro dia do mês atual em horário local brasileiro
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    // Data atual em horário local brasileiro
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [selectedBrand, setSelectedBrand] = useState('all');

  const financialRatesByBrand = {
    ipiranga: 0.00492,
    vibra: 0.00351,
    shell: 0.00615,
    bandeira_branca: 0.00535
  };

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  // Carregar alertas de desvio de preço
  useEffect(() => {
    if (!userId || !startDate || !endDate) return;
    
    const loadPriceDeviationAlerts = async () => {
      try {
        const alerts = [];
        
        // Para cada dia no período - usar horário local brasileiro
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        const currentDate = new Date(start);
        
        // Buscar todos os pedidos do usuário para filtrar por data de pagamento
        const { data: allOrdersData, error: allOrdersError } = await supabase
          .from('purchase_orders')
          .select(`
            id,
            station_id,
            fuel_type,
            unit_price,
            volume,
            total_cost,
            order_date,
            invoice_date,
            payment_term_days,
            postos(id, name, group_ids),
            groups(id, name, reference_posto_id)
          `)
          .eq('user_id', userId);

        if (allOrdersError) throw allOrdersError;

        // Filtrar pedidos cujos pagamentos caem no período selecionado
        const relevantOrders = (allOrdersData || []).filter(order => {
          if (!order.invoice_date || order.payment_term_days === null) return false;
          
          const paymentDate = calculatePaymentDate(order.invoice_date, order.payment_term_days);
          if (!paymentDate) return false;
          
          const paymentDateStr = paymentDate.toISOString().split('T')[0];
          // Comparar com data completa incluindo horário
          return paymentDate >= start && paymentDate <= end;
        });

        // Processar pedidos agrupados por data de pagamento
        const ordersByPaymentDate = {};
        relevantOrders.forEach(order => {
          const paymentDate = calculatePaymentDate(order.invoice_date, order.payment_term_days);
          const paymentDateStr = paymentDate.toISOString().split('T')[0];
          
          if (!ordersByPaymentDate[paymentDateStr]) {
            ordersByPaymentDate[paymentDateStr] = [];
          }
          ordersByPaymentDate[paymentDateStr].push(order);
        });

        // Processar cada data de pagamento
        for (const [paymentDateStr, ordersData] of Object.entries(ordersByPaymentDate)) {
          if (!ordersData || ordersData.length === 0) {
            continue;
          }
          
          // Buscar preços do posto de referência para cada grupo
          for (const order of ordersData) {
            if (!order.postos?.group_ids || order.postos.group_ids.length === 0) continue;
            
            // CORRIGIDO: Posto pode ter múltiplos grupos - buscar o primeiro com reference_posto_id
            let group = null;
            for (const groupId of order.postos.group_ids) {
              const foundGroup = groups.find(g => g.id === groupId);
              if (foundGroup?.reference_posto_id) {
                group = foundGroup;
                break;
              }
            }
            
            if (!group || !group.reference_posto_id) continue;
            
            // Buscar preço do posto de referência para o mesmo combustível
            const { data: refPriceData, error: refPriceError } = await supabase
              .from('daily_prices')
              .select('prices')
              .eq('date', dateStr)
              .contains('group_ids', [groupId])
              .single();
            
            if (refPriceError || !refPriceData?.prices) continue;
            
            const referencePrice = refPriceData.prices[order.fuel_type];
            if (!referencePrice) continue;
            
            // Calcular desvio
            const priceDifference = order.unit_price - referencePrice;
            const deviationPercentage = (priceDifference / referencePrice) * 100;
            
            // CORRIGIDO: Considerar alerta se desvio absoluto > R$ 0,02 por litro (positivo OU negativo)
            if (Math.abs(priceDifference) > 0.02) {
              alerts.push({
                id: order.id,
                postoName: order.postos.name,
                groupName: group.name,
                fuelType: order.fuel_type,
                fuelTypeName: settings.fuelTypes?.[order.fuel_type]?.name || order.fuel_type,
                unitPrice: order.unit_price,
                referencePrice: referencePrice,
                priceDifference: priceDifference,
                deviationPercentage: deviationPercentage,
                volume: order.volume,
                totalCost: order.total_cost,
                orderDate: order.order_date
              });
            }
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        setPriceDeviationAlerts(alerts);
      } catch (err) {
        console.log('Erro ao carregar alertas de desvio de preço:', err);
      }
    };
    
    loadPriceDeviationAlerts();
  }, [userId, startDate, endDate, groups, settings.fuelTypes]);
  
  // Carregar limites diários da semana selecionada
  useEffect(() => {
    if (!userId || !selectedWeek) return;
    
    const loadWeeklyLimits = async () => {
      try {
        const { data, error } = await supabase
          .from('daily_payment_limits')
          .select('*')
          .eq('user_id', userId)
          .eq('week_date', selectedWeek)
          .order('day_of_week');
        
        if (error) throw error;
        
        const limits = {};
        (data || []).forEach(limit => {
          limits[limit.day_of_week] = limit.daily_limit;
        });
        
        setWeeklyLimits(limits);
        setEditingLimits(limits);
      } catch (err) {
        console.error('Erro ao carregar limites diários:', err);
      }
    };
    
    loadWeeklyLimits();
  }, [userId, selectedWeek]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, postosRes, groupsRes, suppliersRes, settingsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').eq('user_id', userId),
        supabase.from('postos').select('*').eq('user_id', userId),
        supabase.from('groups').select('*').eq('user_id', userId),
        supabase.from('suppliers').select('*').eq('user_id', userId),
        supabase.from('user_settings').select('*').eq('user_id', userId).single()
      ]);

      setOrders(ordersRes.data || []);
      setPostos(postosRes.data || []);
      setGroups(groupsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setSettings(settingsRes.data?.settings || {});
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast({ title: '❌ Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  
  // Função para salvar limites diários
  const saveWeeklyLimits = async () => {
    if (!userId || !selectedWeek) return;
    
    try {
      setLoading(true);
      
      // Preparar dados para upsert
      const limitsData = Object.entries(editingLimits).map(([dayOfWeek, dailyLimit]) => ({
        user_id: userId,
        week_date: selectedWeek,
        day_of_week: parseInt(dayOfWeek),
        daily_limit: parseFloat(dailyLimit) || 0
      }));
      
      const { error } = await supabase
        .from('daily_payment_limits')
        .upsert(limitsData, {
          onConflict: 'user_id,week_date,day_of_week'
        });
      
      if (error) throw error;
      
      setWeeklyLimits(editingLimits);
      setShowLimitsModal(false);
      toast({ title: '✅ Limites salvos com sucesso!' });
    } catch (err) {
      console.error('Erro ao salvar limites:', err);
      toast({ title: '❌ Erro ao salvar limites', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  
  // Filtrar pedidos para uso em múltiplos lugares (usando data de pagamento)
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Calcular data de pagamento para o filtro
      const isCashPurchase = order.is_cash_purchase || (order.payment_term_days === 0);
      let paymentDate;
      
      if (isCashPurchase) {
        // Pagamento à vista: usar data do faturamento
        paymentDate = new Date(order.invoice_date + 'T00:00:00');
      } else {
        // Pagamento a prazo: calcular data de vencimento
        if (!order.invoice_date || order.payment_term_days === null) return false;
        paymentDate = calculatePaymentDate(order.invoice_date, order.payment_term_days);
        if (!paymentDate) return false;
        
        // Ajustar para próxima segunda se cair em fim de semana
        const dayOfWeek = paymentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          const daysToAdd = dayOfWeek === 0 ? 1 : 2;
          paymentDate.setDate(paymentDate.getDate() + daysToAdd);
        }
      }
      
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      
      if (paymentDate < start || paymentDate > end) return false;

      if (selectedBrand !== 'all') {
        const posto = postos.find(p => p.id === order.station_id);
        if (!posto || posto.bandeira !== selectedBrand) return false;
      }
      
      return true;
    });
  }, [orders, startDate, endDate, selectedBrand, postos]);
  
  // Calcular total a pagar por dia da semana (apenas para a semana selecionada)
  const dailyPayments = useMemo(() => {
    const payments = {
      0: 0, // domingo
      1: 0, // segunda
      2: 0, // terça
      3: 0, // quarta
      4: 0, // quinta
      5: 0, // sexta
      6: 0  // sábado
    };
    
    if (!selectedWeek) return payments;
    
    // Calcular início e fim da semana selecionada - usar horário local
    const weekStart = new Date(selectedWeek + 'T00:00:00');
    const weekEnd = new Date(selectedWeek + 'T00:00:00');
    weekEnd.setDate(weekStart.getDate() + 6);
    
    
    // Filtrar apenas pedidos cujos pagamentos caem na semana selecionada
    orders.forEach(order => {
      if (!order.invoice_date) return;
      
      const totalCost = (order.total_cost || 0) / 1000; // total_cost está multiplicado por 1000 no banco
      const isCashPurchase = order.is_cash_purchase || (order.payment_term_days === 0);
      
      let finalPaymentDate;
      let effectiveDayOfWeek;
      
      if (isCashPurchase) {
        // Pagamento à vista: usar data do faturamento diretamente
        finalPaymentDate = new Date(order.invoice_date + 'T00:00:00');
        effectiveDayOfWeek = finalPaymentDate.getDay();
      } else {
        // Pagamento a prazo: calcular data de vencimento
        if (order.payment_term_days === null) return;
        
        const paymentDate = calculatePaymentDate(order.invoice_date, order.payment_term_days);
        if (!paymentDate) return;
        
        const dayOfWeek = paymentDate.getDay();
        finalPaymentDate = new Date(paymentDate);
        effectiveDayOfWeek = dayOfWeek;
        
        // Se o pagamento cai no sábado (6) ou domingo (0), mover para a próxima segunda-feira
        if (effectiveDayOfWeek === 0 || effectiveDayOfWeek === 6) {
          const daysToAdd = effectiveDayOfWeek === 0 ? 1 : 2; // domingo +1, sábado +2
          finalPaymentDate.setDate(finalPaymentDate.getDate() + daysToAdd);
          effectiveDayOfWeek = 1; // Segunda-feira
        }
      }
      
      // Verificar se o pagamento final cai na semana selecionada
      // Normalizar datas para comparar apenas dia/mês/ano (sem horário)
      const paymentDateOnly = new Date(finalPaymentDate.getFullYear(), finalPaymentDate.getMonth(), finalPaymentDate.getDate());
      const weekStartOnly = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
      const weekEndOnly = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
      
      if (paymentDateOnly < weekStartOnly || paymentDateOnly > weekEndOnly) {
        return; // Pula este pagamento pois não está na semana selecionada
      }
      
      payments[effectiveDayOfWeek] += totalCost;
    });
    
    // Debug removido - pagamentos calculados com sucesso
    
    return payments;
  }, [orders, selectedWeek]);
  
  // Paginação dos pedidos filtrados
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, currentPage, itemsPerPage]);
  
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  
  const summary = useMemo(() => {
    let totalVolume = 0;
    let totalValue = 0;
    let totalFinancialCost = 0;
    let ordersByBrand = {};
    let ordersByFuel = {};
    let cashVolume = 0;
    let cashValue = 0;
    let creditVolume = 0;
    let creditValue = 0;

    filteredOrders.forEach(order => {
      const volume = order.volume || 0;
      const unitPrice = order.unit_price || 0;
      const days = order.payment_term_days || 0;
      const isCash = order.is_cash_purchase || days === 0;
      
      const posto = postos.find(p => p.id === order.station_id);
      const rate = posto ? (financialRatesByBrand[posto.bandeira] || 0.00535) : 0.00535;
      
      const orderValue = unitPrice * volume;
      const financialCost = rate * days * volume;

      totalVolume += volume;
      totalValue += orderValue;
      totalFinancialCost += financialCost;

      // Separar à vista vs prazo
      if (isCash) {
        cashVolume += volume;
        cashValue += orderValue;
      } else {
        creditVolume += volume;
        creditValue += orderValue;
      }

      const brand = posto?.bandeira || 'desconhecido';
      ordersByBrand[brand] = (ordersByBrand[brand] || 0) + orderValue;

      const fuel = order.fuel_type || 'desconhecido';
      ordersByFuel[fuel] = (ordersByFuel[fuel] || 0) + volume;
    });

    return {
      totalOrders: filteredOrders.length,
      totalVolume,
      totalValue,
      totalFinancialCost,
      averagePrice: totalVolume > 0 ? totalValue / totalVolume : 0,
      ordersByBrand,
      ordersByFuel,
      cashOrders: filteredOrders.filter(o => o.is_cash_purchase || (o.payment_term_days || 0) === 0).length,
      creditOrders: filteredOrders.filter(o => !o.is_cash_purchase && (o.payment_term_days || 0) > 0).length,
      cashVolume,
      cashValue,
      creditVolume,
      creditValue
    };
  }, [filteredOrders, postos]);
  
  // Reset página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, selectedBrand]);
  
  
  // Dias da semana para exibição (apenas dias úteis para limites)
  const weekDays = [
    { key: 1, name: 'Segunda-feira', short: 'Seg', hasLimit: true },
    { key: 2, name: 'Terça-feira', short: 'Ter', hasLimit: true },
    { key: 3, name: 'Quarta-feira', short: 'Qua', hasLimit: true },
    { key: 4, name: 'Quinta-feira', short: 'Qui', hasLimit: true },
    { key: 5, name: 'Sexta-feira', short: 'Sex', hasLimit: true },
    { key: 6, name: 'Sábado', short: 'Sáb', hasLimit: false }, // Sem limite - pagamentos vão para segunda
    { key: 0, name: 'Domingo', short: 'Dom', hasLimit: false }  // Sem limite - pagamentos vão para segunda
  ];

  const exportToCSV = () => {
    const headers = ['Data', 'Posto', 'Combustível', 'Volume (L)', 'Preço/L', 'Valor Total', 'Prazo', 'Custo Financeiro', 'Fornecedor'];
    const rows = filteredOrders.map(order => {
      const posto = postos.find(p => p.id === order.station_id);
      const supplier = suppliers.find(s => s.id === order.supplier_id);
      const rate = posto ? (financialRatesByBrand[posto.bandeira] || 0.00535) : 0.00535;
      const financialCost = rate * (order.payment_term_days || 0) * (order.volume || 0);
      
      return [
        order.order_date,
        posto?.name || 'N/D',
        settings.fuelTypes?.[order.fuel_type]?.name || order.fuel_type || 'N/D',
        order.volume || 0,
        (order.unit_price || 0).toFixed(4),
        ((order.unit_price || 0) * (order.volume || 0)).toFixed(2),
        order.payment_term_days || 0,
        financialCost.toFixed(2),
        supplier?.name || 'N/D'
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_financeiro_${startDate}_${endDate}.csv`;
    link.click();
    toast({ title: '✅ Relatório exportado!', description: 'Arquivo CSV baixado com sucesso.' });
  };

  const exportToPDF = () => {
    // Criar conteúdo HTML para impressão
    const htmlContent = `
      <html>
        <head>
          <title>Relatório Financeiro</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .text-right { text-align: right; }
            .summary { margin-top: 20px; padding: 10px; background-color: #f9f9f9; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Dashboard Financeiro - Relatório</h1>
          <p><strong>Período:</strong> ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
          
          <table>
            <thead>
              <tr>
                <th>Data Faturamento</th>
                <th>Data Pagamento</th>
                <th>Posto</th>
                <th>Combustível</th>
                <th>Volume (L)</th>
                <th>Preço/L</th>
                <th>Valor Total</th>
                <th>Prazo</th>
                <th>Custo Fin.</th>
              </tr>
            </thead>
            <tbody>
              ${filteredOrders.map(order => {
                const posto = postos.find(p => p.id === order.station_id);
                const rate = posto ? (financialRatesByBrand[posto.bandeira] || 0.00535) : 0.00535;
                const financialCost = rate * (order.payment_term_days || 0) * (order.volume || 0);
                const totalValue = (order.total_cost || 0) / 1000 || ((order.unit_price || 0) * (order.volume || 0));
                
                // Calcular data de pagamento para o PDF
                const isCashPurchase = order.is_cash_purchase || (order.payment_term_days === 0);
                let paymentDate;
                
                if (isCashPurchase) {
                  paymentDate = new Date(order.invoice_date + 'T00:00:00');
                } else {
                  if (order.invoice_date && order.payment_term_days !== null) {
                    paymentDate = calculatePaymentDate(order.invoice_date, order.payment_term_days);
                    if (paymentDate) {
                      const dayOfWeek = paymentDate.getDay();
                      if (dayOfWeek === 0 || dayOfWeek === 6) {
                        const daysToAdd = dayOfWeek === 0 ? 1 : 2;
                        paymentDate.setDate(paymentDate.getDate() + daysToAdd);
                      }
                    }
                  }
                }
                
                return `
                  <tr>
                    <td>${new Date(order.invoice_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>${paymentDate ? paymentDate.toLocaleDateString('pt-BR') : 'N/D'}</td>
                    <td>${posto?.name || 'N/D'}</td>
                    <td>${settings.fuelTypes?.[order.fuel_type]?.name || order.fuel_type}</td>
                    <td class="text-right">${(order.volume || 0).toLocaleString('pt-BR')}</td>
                    <td class="text-right">R$ ${(order.unit_price || 0).toFixed(4)}</td>
                    <td class="text-right">R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="text-right">${order.payment_term_days || 0}d</td>
                    <td class="text-right">R$ ${financialCost.toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <h3>Resumo do Período</h3>
            <p><strong>Total de pedidos:</strong> ${filteredOrders.length}</p>
            <p><strong>Volume total:</strong> ${filteredOrders.reduce((sum, order) => sum + (order.volume || 0), 0).toLocaleString('pt-BR')} L</p>
            <p><strong>Valor total:</strong> R$ ${filteredOrders.reduce((sum, order) => sum + ((order.total_cost || 0) / 1000), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </body>
      </html>
    `;
    
    // Abrir nova janela e imprimir
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    
    toast({ title: '✅ PDF gerado!', description: 'Relatório aberto para impressão/salvar como PDF.' });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div className="relative p-4 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-2xl shadow-2xl">
              <BarChart3 className="w-10 h-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">Dashboard Financeiro</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">Análise completa de custos e despesas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
          <Button onClick={exportToPDF} variant="outline" className="gap-2">
            <FileText className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
      {/* Filters */}
      <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="w-5 h-5 text-green-600" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Data Inicial</Label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Data Final</Label>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Bandeira</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-green-500 dark:focus:border-green-400 shadow-sm h-12 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="ipiranga">Ipiranga</SelectItem>
                  <SelectItem value="vibra">Vibra</SelectItem>
                  <SelectItem value="shell">Shell</SelectItem>
                  <SelectItem value="bandeira_branca">Bandeira Branca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-sm rounded-2xl hover:shadow-xl transition-all border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{summary.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">pedidos no período</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 backdrop-blur-sm rounded-2xl hover:shadow-xl transition-all border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Volume Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{summary.totalVolume.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground mt-1">litros</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-sm rounded-2xl hover:shadow-xl transition-all border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              R$ {summary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Média: R$ {summary.averagePrice.toFixed(4)}/L
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              R$ {summary.totalFinancialCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((summary.totalFinancialCost / summary.totalValue) * 100).toFixed(2)}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Desvio de Preço */}
      {priceDeviationAlerts.length > 0 && (
        <Card className="border border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Alertas de Desvio de Preço no Período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-semibold text-red-700 dark:text-red-300">
              {priceDeviationAlerts.length} pedido(s) com preço acima da referência (+R$ 0,02/L)
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {priceDeviationAlerts.slice(0, 10).map((alert) => (
                <div key={alert.id} className="p-2 bg-white dark:bg-red-950/40 rounded border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-red-800 dark:text-red-200">
                        {alert.postoName} - {alert.fuelTypeName}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {alert.groupName} • {new Date(alert.orderDate + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-red-700 dark:text-red-300">
                        +{alert.deviationPercentage.toFixed(1)}%
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        R$ {alert.unitPrice.toFixed(4)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {priceDeviationAlerts.length > 10 && (
              <p className="text-xs text-red-600 dark:text-red-400">
                ...e mais {priceDeviationAlerts.length - 10} pedido(s)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comparativo À Vista vs Prazo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Comparativo: À Vista vs Prazo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* À Vista */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <h3 className="font-semibold text-lg">À Vista</h3>
              </div>
              <div className="space-y-2 pl-5">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pedidos:</span>
                  <span className="font-mono font-bold text-green-600">{summary.cashOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Volume:</span>
                  <span className="font-mono font-bold text-green-600">{summary.cashVolume.toLocaleString('pt-BR')} L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor:</span>
                  <span className="font-mono font-bold text-green-600">
                    R$ {summary.cashValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">% do Total:</span>
                  <span className="font-mono font-bold text-green-600">
                    {summary.totalValue > 0 ? ((summary.cashValue / summary.totalValue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* A Prazo */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <h3 className="font-semibold text-lg">A Prazo</h3>
              </div>
              <div className="space-y-2 pl-5">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pedidos:</span>
                  <span className="font-mono font-bold text-orange-600">{summary.creditOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Volume:</span>
                  <span className="font-mono font-bold text-orange-600">{summary.creditVolume.toLocaleString('pt-BR')} L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor:</span>
                  <span className="font-mono font-bold text-orange-600">
                    R$ {summary.creditValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">% do Total:</span>
                  <span className="font-mono font-bold text-orange-600">
                    {summary.totalValue > 0 ? ((summary.creditValue / summary.totalValue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Controle de Limites Diários */}
      <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <CardTitle className="text-xl">Limites Diários de Pagamento</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold text-green-700 dark:text-green-300">Semana:</Label>
              <WeekPicker
                value={selectedWeek}
                onChange={(date) => {
                  if (date) {
                    // Usar horário local brasileiro para evitar problemas de timezone
                    const [year, month, day] = date.split('-').map(Number);
                    const selectedDate = new Date(year, month - 1, day);
                    const dayOfWeek = selectedDate.getDay();
                    
                    if (dayOfWeek !== 1) {
                      // Se não for segunda-feira, encontrar a próxima segunda-feira
                      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
                      const monday = new Date(selectedDate);
                      monday.setDate(selectedDate.getDate() + daysUntilMonday);
                      
                      const sunday = new Date(monday);
                      sunday.setDate(monday.getDate() + 6);
                      
                      const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
                      setSelectedWeek(mondayStr);
                      
                      toast({ 
                        title: '📅 Semana selecionada', 
                        description: `${monday.toLocaleDateString('pt-BR')} a ${sunday.toLocaleDateString('pt-BR')}` 
                      });
                    } else {
                      // Se já for segunda-feira, usar diretamente
                      setSelectedWeek(date);
                      
                      const sunday = new Date(selectedDate);
                      sunday.setDate(selectedDate.getDate() + 6);
                      
                      toast({ 
                        title: '📅 Semana selecionada', 
                        description: `${selectedDate.toLocaleDateString('pt-BR')} a ${sunday.toLocaleDateString('pt-BR')}` 
                      });
                    }
                  } else {
                    setSelectedWeek('');
                  }
                }}
                className="w-48 h-8 border-2 border-green-300 dark:border-green-600 focus:border-green-500 dark:focus:border-green-400 text-sm"
                placeholder="Selecione uma segunda-feira"
              />
              <Button
                onClick={() => setShowLimitsModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 h-8 text-sm"
              >
                ⚙️ Configurar
              </Button>
            </div>
          </div>
          <CardDescription>
            Controle os limites de pagamento para cada dia da semana e acompanhe os valores a pagar
            {selectedWeek && (
              <div className="mt-2">
                <span className="text-xs text-green-600 dark:text-green-400">
                  📅 Mostrando dados da semana: {new Date(selectedWeek + 'T00:00:00').toLocaleDateString('pt-BR')} a {
                    (() => {
                      const sunday = new Date(selectedWeek + 'T00:00:00');
                      sunday.setDate(sunday.getDate() + 6);
                      return sunday.toLocaleDateString('pt-BR');
                    })()
                  }
                </span>
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {weekDays.map(day => {
              const limit = weeklyLimits[day.key] || 0;
              const payment = dailyPayments[day.key] || 0;
              const percentage = limit > 0 ? (payment / limit) * 100 : 0;
              const isOverLimit = payment > limit;
              
              return (
                <div key={day.key} className={`p-3 rounded-xl border-2 transition-all min-w-0 ${
                  !day.hasLimit
                    ? 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600 opacity-60'
                    : isOverLimit 
                      ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700' 
                      : payment > 0 
                        ? 'bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700'
                        : 'bg-gray-50 border-gray-300 dark:bg-gray-900/20 dark:border-gray-700'
                }`}>
                  <div className="text-center mb-3">
                    <div className="font-bold text-base mb-1">{day.short}</div>
                    <div className="text-xs text-muted-foreground">
                      {day.name}
                      {!day.hasLimit && <span className="block text-orange-600 font-semibold text-xs">(Sem limite)</span>}
                    </div>
                  </div>
                  
                  <div className="space-y-2 min-w-0">
                    {day.hasLimit && (
                      <>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground block">Limite:</span>
                          <span className="font-mono text-xs font-bold block truncate" title={`R$ ${formatCurrency(limit)}`}>
                            R$ {formatCurrency(limit)}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground block">Pagamentos:</span>
                          <span className={`font-mono text-xs font-bold block truncate ${
                            isOverLimit ? 'text-red-600' : payment > 0 ? 'text-yellow-600' : 'text-gray-600'
                          }`} title={`R$ ${formatCurrency(payment)}`}>
                            R$ {formatCurrency(payment)}
                          </span>
                        </div>
                        
                        {limit > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                isOverLimit ? 'bg-red-500' : payment > 0 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        )}
                        
                        {isOverLimit && (
                          <div className="text-xs text-red-600 font-semibold text-center mt-1">
                            ⚠️ Excedido!
                          </div>
                        )}
                      </>
                    )}
                    
                    {!day.hasLimit && (
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Pagamentos:</div>
                        <div className="font-mono text-sm font-bold text-orange-600">
                          R$ {formatCurrency(payment)}
                        </div>
                        <div className="text-xs text-orange-600 mt-1">
                          → Segunda-feira
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-1">Resumo da Semana</h4>
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  {new Date(selectedWeek).toLocaleDateString('pt-BR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-600 dark:text-blue-400">Total do Limite (dias úteis):</div>
                <div className="font-mono text-xl font-bold text-blue-800 dark:text-blue-200">
                  R$ {formatCurrency(
                    Object.entries(weeklyLimits)
                      .filter(([key]) => weekDays.find(d => d.key === parseInt(key))?.hasLimit)
                      .reduce((sum, [, limit]) => sum + (parseFloat(limit) || 0), 0)
                  )}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400 mt-2">Total a Pagar:</div>
                <div className="font-mono text-xl font-bold text-orange-600 dark:text-orange-400">
                  R$ {formatCurrency(Object.values(dailyPayments).reduce((sum, payment) => sum + payment, 0))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Modal de Configuração de Limites */}
      {showLimitsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  ⚙️ Configurar Limites Diários
                </h3>
                <Button
                  variant="ghost"
                  onClick={() => setShowLimitsModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Defina os limites de pagamento para cada dia da semana selecionada.
              </p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekDays.filter(day => day.hasLimit).map(day => (
                  <div key={day.key} className="space-y-2">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300">
                      {day.name}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-sm">R$</span>
                      <Input
                        type="text"
                        step="0.01"
                        min="0"
                        value={editingLimits[day.key] ? formatCurrency(editingLimits[day.key]) : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          const numValue = parseFloat(value) / 100;
                          setEditingLimits({
                            ...editingLimits,
                            [day.key]: numValue.toString()
                          });
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          const numValue = parseFloat(value) / 100 || 0;
                          setEditingLimits({
                            ...editingLimits,
                            [day.key]: numValue.toFixed(2)
                          });
                        }}
                        className="pl-12 border-2 border-green-300 dark:border-green-600 focus:border-green-500 dark:focus:border-green-400 h-12 rounded-2xl font-mono"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  variant="outline"
                  onClick={() => setShowLimitsModal(false)}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950/20"
                >
                  ❌ Cancelar
                </Button>
                <Button
                  onClick={saveWeeklyLimits}
                  disabled={loading}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 font-bold rounded-2xl"
                >
                  {loading ? '💾 Salvando...' : '✅ Salvar Limites'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Bandeira</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(summary.ordersByBrand).map(([brand, value]) => {
                const percentage = (value / summary.totalValue) * 100;
                return (
                  <div key={brand} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize font-medium">{brand.replace('_', ' ')}</span>
                      <span className="font-bold">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% do total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volume por Combustível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(summary.ordersByFuel).map(([fuel, volume]) => {
                const percentage = (volume / summary.totalVolume) * 100;
                return (
                  <div key={fuel} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{settings.fuelTypes?.[fuel]?.name || fuel}</span>
                      <span className="font-bold">{volume.toLocaleString('pt-BR')} L</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% do total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento dos Pedidos</CardTitle>
          <CardDescription>
            {filteredOrders.length} pedidos encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Data Faturamento</th>
                  <th className="text-left p-2">Data Pagamento</th>
                  <th className="text-left p-2">Posto</th>
                  <th className="text-left p-2">Combustível</th>
                  <th className="text-right p-2">Volume (L)</th>
                  <th className="text-right p-2">Preço/L</th>
                  <th className="text-right p-2">Valor Total</th>
                  <th className="text-right p-2">Prazo</th>
                  <th className="text-right p-2">Custo Fin.</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map(order => {
                  const posto = postos.find(p => p.id === order.station_id);
                  const rate = posto ? (financialRatesByBrand[posto.bandeira] || 0.00535) : 0.00535;
                  const financialCost = rate * (order.payment_term_days || 0) * (order.volume || 0);
                  const totalValue = (order.total_cost || 0) / 1000 || ((order.unit_price || 0) * (order.volume || 0));
                  
                  // Calcular data de pagamento para exibir
                  const isCashPurchase = order.is_cash_purchase || (order.payment_term_days === 0);
                  let paymentDate;
                  
                  if (isCashPurchase) {
                    paymentDate = new Date(order.invoice_date + 'T00:00:00');
                  } else {
                    if (order.invoice_date && order.payment_term_days !== null) {
                      paymentDate = calculatePaymentDate(order.invoice_date, order.payment_term_days);
                      if (paymentDate) {
                        const dayOfWeek = paymentDate.getDay();
                        if (dayOfWeek === 0 || dayOfWeek === 6) {
                          const daysToAdd = dayOfWeek === 0 ? 1 : 2;
                          paymentDate.setDate(paymentDate.getDate() + daysToAdd);
                        }
                      }
                    }
                  }

                  return (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">{new Date(order.invoice_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="p-2">{paymentDate ? paymentDate.toLocaleDateString('pt-BR') : 'N/D'}</td>
                      <td className="p-2">{posto?.name || 'N/D'}</td>
                      <td className="p-2">{settings.fuelTypes?.[order.fuel_type]?.name || order.fuel_type}</td>
                      <td className="p-2 text-right font-mono">{(order.volume || 0).toLocaleString('pt-BR')}</td>
                      <td className="p-2 text-right font-mono">R$ {(order.unit_price || 0).toFixed(4)}</td>
                      <td className="p-2 text-right font-mono font-bold">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right">{order.payment_term_days || 0}d</td>
                      <td className="p-2 text-right font-mono text-orange-600">R$ {financialCost.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Paginação */}
          {filteredOrders.length > itemsPerPage && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredOrders.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </motion.div>
  );
}
