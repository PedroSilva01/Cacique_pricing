import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { RefreshCw, AlertTriangle, FileUp, Download, Copy, Sparkles, Droplet, TrendingUp, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { defaultSettings } from '@/lib/mockData';
import ReportModal from '@/components/ReportModal';
import ManualPriceModal from '@/components/ManualPriceModal';
import { generatePdf } from '@/lib/pdfGenerator';
import { Helmet } from 'react-helmet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ChartsSection from '@/components/ChartsSection';
import OilPriceChart from '@/components/OilPriceChart';
import AverageFuelPricesChart from '@/components/AverageFuelPricesChart';
import BestCostAnalysis from '@/components/BestCostAnalysis';
import ComprehensivePriceMatrix from '@/components/ComprehensivePriceMatrix';

const Dashboard = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [settings, setSettings] = useState(defaultSettings);
    const [dailyPrices, setDailyPrices] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [selectedBase, setSelectedBase] = useState(null);
    const [baseCities, setBaseCities] = useState([]);
    const [cities, setCities] = useState([]);
    const [postos, setPostos] = useState([]);
    const [groups, setGroups] = useState([]);
    const [freightRoutes, setFreightRoutes] = useState([]);
    const [oilPrice, setOilPrice] = useState(null);
    const [oilPriceLoading, setOilPriceLoading] = useState(true);

    const [selectedVehicleType, setSelectedVehicleType] = useState('');
    const [selectedFuel, setSelectedFuel] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('Todos');
    const [selectedDestination, setSelectedDestination] = useState(null);
    const [showFilters, setShowFilters] = useState(true);
    const [suppliersPerBase, setSuppliersPerBase] = useState('1');
    
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    
    const allUniqueSupplierBases = useMemo(() => {
      const bases = new Set();
      suppliers.forEach(s => {
        (s.available_products || []).forEach(p => bases.add(p));
      });
      return Array.from(bases);
    }, [suppliers]);


    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);

        try {
            const [settingsRes, pricesRes, suppliersRes, baseCitiesRes, citiesRes, postosRes, routesRes, groupsRes] = await Promise.all([
                supabase.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
                supabase.from('daily_prices').select('*').eq('user_id', user.id).order('date', { ascending: false }),
                supabase.from('suppliers').select('*').eq('user_id', user.id),
                supabase.from('base_cities').select('*').eq('user_id', user.id).order('name'),
                supabase.from('cities').select('*').eq('user_id', user.id).order('name'),
                supabase.from('postos').select('*, city:cities(id, name)').eq('user_id', user.id),
                supabase.from('freight_routes').select('*, origin:base_cities!origin_city_id(id, name), destination:cities!destination_city_id(id, name)').eq('user_id', user.id),
                supabase.from('groups').select('*').eq('user_id', user.id),
            ]);

            if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;
            if (pricesRes.error) throw pricesRes.error;
            if (suppliersRes.error) throw suppliersRes.error;
            if (baseCitiesRes.error) throw baseCitiesRes.error;
            if (citiesRes.error) throw citiesRes.error;
            if (postosRes.error) throw postosRes.error;
            if (routesRes.error) throw routesRes.error;
            if (groupsRes.error) throw groupsRes.error;
            
            const userSettings = settingsRes.data?.settings || defaultSettings;
            setSettings(userSettings);
            setDailyPrices(pricesRes.data || []);
            setSuppliers(suppliersRes.data || []);
            const allBaseCities = baseCitiesRes.data || [];
            setBaseCities(allBaseCities);
            const allCities = citiesRes.data || [];
            setCities(allCities);
            const allPostos = postosRes.data || [];
            setPostos(allPostos);
            setFreightRoutes(routesRes.data || []);
            setGroups(groupsRes.data || []);

            // Usar functional updates para evitar loops infinitos
            if (Object.keys(userSettings.fuelTypes).length > 0) {
              setSelectedFuel(prev => prev || Object.keys(userSettings.fuelTypes)[0]);
            }
            const vehicleKeys = Object.keys(userSettings.vehicleTypes || {});
            setSelectedVehicleType(prev => {
              if (prev && vehicleKeys.includes(prev)) {
                return prev;
              }
              return vehicleKeys[0] || prev || '';
            });
            if (allPostos.length > 0) {
              setSelectedDestination(prev => {
                if (prev) return prev;
                return allPostos.find(p => p.id === userSettings.defaultDestinationPostoId) || allPostos[0];
              });
            }
            // selecionar base padrão (primeira cidade base)
            if (allBaseCities.length > 0) {
              setSelectedBase(prev => prev || allBaseCities[0]);
            }

        } catch (err) {
            console.error('Error fetching data:', err);
            setError(`Falha ao buscar dados: ${err.message}`);
            toast({ title: 'Erro de Conexão', description: `Não foi possível carregar os dados. ${err.message}`, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [user, toast]);
    
    const updateOilPricesInBackground = useCallback(async () => {
        try {
            console.log('⚙️ Invocando edge function fetch-oil-prices...');
            const { data, error } = await supabase.functions.invoke('fetch-oil-prices');
            if (error) throw error;

            if (data?.data && (data.data.WTI || data.data.BRENT)) {
                console.log('📡 Retorno bruto da API (edge function):', data.data);

                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const today = `${year}-${month}-${day}`;

                const formatChangePercent = (current, previous) => {
                    if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) {
                        return '+0.00%';
                    }
                    const diff = ((current - previous) / previous) * 100;
                    const sign = diff >= 0 ? '+' : '';
                    return `${sign}${diff.toFixed(2)}%`;
                };

                const { data: previousRows, error: previousError } = await supabase
                    .from('oil_prices')
                    .select('wti_price, brent_price')
                    .lt('date', today)
                    .order('date', { ascending: false })
                    .limit(1);

                if (previousError && previousError.code !== 'PGRST116') {
                    throw previousError;
                }

                const previousEntry = previousRows?.[0] || null;
                const wtiCurrent = data.data.WTI?.price ?? null;
                const brentCurrent = data.data.BRENT?.price ?? null;
                const wtiChange = previousEntry?.wti_price != null
                    ? formatChangePercent(wtiCurrent, previousEntry.wti_price)
                    : '+0.00%';
                const brentChange = previousEntry?.brent_price != null
                    ? formatChangePercent(brentCurrent, previousEntry.brent_price)
                    : '+0.00%';

                const { error: upsertError } = await supabase.from('oil_prices').upsert({
                    date: today,
                    wti_price: data.data.WTI?.price || null,
                    brent_price: data.data.BRENT?.price || null,
                    wti_change: wtiChange,
                    brent_change: brentChange,
                    timestamp: new Date().toISOString()
                }, {
                    onConflict: 'date'
                });

                if (upsertError) {
                    console.error('Erro ao salvar no banco:', upsertError);
                    throw upsertError;
                }

                console.log('💾 Preço de petróleo persistido no banco:', {
                    date: today,
                    wti: data.data.WTI?.price ?? null,
                    brent: data.data.BRENT?.price ?? null
                });

                const adjustedOilData = {
                    ...(data.data || {}),
                    WTI: data.data.WTI ? { ...data.data.WTI, change: wtiChange } : undefined,
                    BRENT: data.data.BRENT ? { ...data.data.BRENT, change: brentChange } : undefined,
                };

                setOilPrice(adjustedOilData);
                console.log('✅ Preço salvo no banco após chamar a API:', data.data);
                console.log(`✅ Preços de petróleo atualizados e salvos no banco (${today})`);
            }
        } catch (err) {
            console.error('Erro ao atualizar preços em background:', err);
        }
    }, []);

    const fetchOilPrice = useCallback(async () => {
        setOilPriceLoading(true);
        try {
            const { data: dbPrices, error: dbError } = await supabase
                .from('oil_prices')
                .select('date, wti_price, brent_price, wti_change, brent_change, timestamp')
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (dbError && dbError.code !== 'PGRST116') throw dbError;

            if (dbPrices && dbPrices.wti_price) {
                const oilData = {
                    WTI: {
                        price: dbPrices.wti_price,
                        change: dbPrices.wti_change || '+0.00%',
                        currency: 'USD',
                        unit: 'barrel',
                        timestamp: dbPrices.timestamp || dbPrices.date
                    }
                };

                if (dbPrices.brent_price) {
                    oilData.BRENT = {
                        price: dbPrices.brent_price,
                        change: dbPrices.brent_change || '+0.00%',
                        currency: 'USD',
                        unit: 'barrel',
                        timestamp: dbPrices.timestamp || dbPrices.date
                    };
                }

                console.log('🗄️ Preço de petróleo carregado do banco:', oilData);
                setOilPrice(oilData);

                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const isToday = dbPrices.date === todayStr;

                if (!isToday) {
                    console.log('Dados de petróleo desatualizados (data:', dbPrices.date, '!= hoje:', todayStr, '), atualizando...');
                    await updateOilPricesInBackground();
                } else {
                    const lastUpdate = new Date(dbPrices.timestamp || dbPrices.date);
                    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceUpdate >= 1 || !dbPrices.brent_price) {
                        console.log('Atualizando preços de petróleo (última atualização há', hoursSinceUpdate.toFixed(1), 'horas)');
                        await updateOilPricesInBackground();
                    }
                }
            } else {
                console.log('Nenhum dado no banco, buscando da API...');
                await updateOilPricesInBackground();
            }

        } catch (err) {
            console.error('Failed to fetch oil price:', err.message);
            setOilPrice({
                WTI: {
                    price: 61.47,
                    change: '+0.00%',
                    currency: 'USD',
                    unit: 'barrel',
                    timestamp: new Date().toISOString()
                },
                BRENT: {
                    price: 63.93,
                    change: '+0.00%',
                    currency: 'USD',
                    unit: 'barrel',
                    timestamp: new Date().toISOString()
                }
            });
        } finally {
            setOilPriceLoading(false);
        }
    }, [updateOilPricesInBackground]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user?.id, fetchData]);
    
    useEffect(() => {
        // Buscar preços no carregamento
        fetchOilPrice();
        
        // Verificar a cada 15 minutos se precisa atualizar (economia de API calls)
        const intervalId = setInterval(() => {
            console.log(`[${new Date().toLocaleTimeString()}] Verificando se preços de petróleo precisam ser atualizados...`);
            fetchOilPrice();
        }, 15 * 60 * 1000); // 15 minutos
        
        // Cleanup
        return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const comparisonData = useMemo(() => {
        if (!selectedFuel || !selectedDestination || !suppliers.length) return [];

        const destinationCityId = selectedDestination.city_id;
        const postoBandeira = selectedDestination.bandeira || 'bandeira_branca';
        const vehicleTypesMap = settings?.vehicleTypes || {};

        const resolveFreightForRoute = (route) => {
            if (!route?.costs) {
                return { cost: 0, vehicleKey: selectedVehicleType || null };
            }

            const entries = Object.entries(route.costs)
                .map(([key, value]) => {
                    const numericValue = typeof value === 'number' ? value : parseFloat(value);
                    if (!Number.isFinite(numericValue) || numericValue < 0) {
                        return null;
                    }
                    return [key, numericValue];
                })
                .filter(Boolean);

            if (entries.length === 0) {
                return { cost: 0, vehicleKey: selectedVehicleType || null };
            }

            const preferredEntry = selectedVehicleType
                ? entries.find(([key]) => key === selectedVehicleType)
                : undefined;

            const chosenEntry = preferredEntry || entries.reduce((best, current) => (
                current[1] < best[1] ? current : best
            ));

            return { cost: chosenEntry[1], vehicleKey: chosenEntry[0] };
        };

        // Pegar bases do grupo selecionado
        const groupBaseCityIds = selectedGroup && selectedGroup !== 'Todos'
            ? (groups.find(g => g.id === selectedGroup)?.base_city_ids || [])
            : null;

        const results = suppliers
            .filter(s => s.available_products?.includes(selectedFuel))
            .filter(s => {
                const supplierBandeira = s.bandeira || 'bandeira_branca';
                if (postoBandeira === 'bandeira_branca') return true;
                return supplierBandeira === postoBandeira;
            })
            .filter(s => {
                if (!groupBaseCityIds || groupBaseCityIds.length === 0) return true;
                return (s.city_ids || []).some(cityId => groupBaseCityIds.includes(cityId));
            })
            .map(supplier => {
                const priceData = selectedBase?.id
                    ? dailyPrices.find(p => p.supplier_id === supplier.id && p.base_city_id === selectedBase.id)
                    : dailyPrices.find(p => p.supplier_id === supplier.id);

                const currentPrice = priceData?.prices?.[selectedFuel];
                if (currentPrice === undefined || currentPrice === null) return null;

                let bestFreight = Infinity;
                let baseUsed = null;
                let freightVehicleUsed = selectedVehicleType || null;

                if (selectedBase?.id) {
                    const route = freightRoutes.find(r =>
                        r.origin_city_id === selectedBase.id &&
                        r.destination_city_id === destinationCityId
                    );

                    if (route) {
                        const { cost, vehicleKey } = resolveFreightForRoute(route);
                        bestFreight = cost;
                        freightVehicleUsed = vehicleKey;
                    } else {
                        bestFreight = 0;
                    }
                    baseUsed = selectedBase.name;
                } else {
                    const basesToCheck = groupBaseCityIds && groupBaseCityIds.length > 0
                        ? (supplier.city_ids || []).filter(cityId => groupBaseCityIds.includes(cityId))
                        : (supplier.city_ids || []);

                    basesToCheck.forEach(originCityId => {
                        const route = freightRoutes.find(r =>
                            r.origin_city_id === originCityId &&
                            r.destination_city_id === destinationCityId
                        );
                        if (!route) return;

                        const { cost, vehicleKey } = resolveFreightForRoute(route);
                        if (cost < bestFreight) {
                            bestFreight = cost;
                            freightVehicleUsed = vehicleKey;
                            const baseCity = baseCities.find(b => b.id === originCityId);
                            baseUsed = baseCity?.name;
                        }
                    });
                }

                if (bestFreight === Infinity) {
                    bestFreight = 0;
                }

                const freightVehicleName = freightVehicleUsed
                    ? (vehicleTypesMap[freightVehicleUsed]?.name || freightVehicleUsed)
                    : null;

                return {
                    id: supplier.id,
                    name: supplier.name,
                    currentPrice,
                    freight: bestFreight,
                    freightVehicle: freightVehicleUsed,
                    freightVehicleName,
                    finalPrice: currentPrice + bestFreight,
                    baseName: baseUsed || 'Sem base'
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.finalPrice - b.finalPrice);

        return results;
    }, [selectedFuel, selectedDestination, suppliers, selectedGroup, selectedBase, dailyPrices, freightRoutes, baseCities, groups, selectedVehicleType, settings]);

    const selectedVehicleLabel = useMemo(() => {
        if (selectedVehicleType) {
            return settings?.vehicleTypes?.[selectedVehicleType]?.name || selectedVehicleType;
        }
        return 'N/D';
    }, [selectedVehicleType, settings]);

    // Calcular quais combustíveis têm preço na base + grupo selecionados
    const availableFuels = useMemo(() => {
        // Sem base OU sem grupo = mostrar todos
        if (!selectedBase?.id || !selectedGroup || selectedGroup === 'Todos') {
            return Object.keys(settings.fuelTypes || {});
        }
        
        // Buscar preços dessa base + grupo específico
        const relevantPrices = dailyPrices.filter(p => 
            p.base_city_id === selectedBase.id &&
            p.group_ids?.includes(selectedGroup)
        );
        
        // Extrair quais combustíveis têm preço
        const fuelsWithPrice = new Set();
        relevantPrices.forEach(priceRecord => {
            if (priceRecord.prices) {
                Object.keys(priceRecord.prices).forEach(fuelKey => {
                    if (priceRecord.prices[fuelKey] !== null && priceRecord.prices[fuelKey] !== undefined) {
                        fuelsWithPrice.add(fuelKey);
                    }
                });
            }
        });
        
        return Array.from(fuelsWithPrice);
    }, [selectedBase, selectedGroup, dailyPrices, settings.fuelTypes]);

    const filteredPostos = useMemo(() => {
        if (selectedGroup === 'Todos') return postos;
        return postos.filter(p => p.group_ids?.includes(selectedGroup));
    }, [postos, selectedGroup]);

    useEffect(() => {
        if(filteredPostos.length > 0 && !filteredPostos.find(p => p.id === selectedDestination?.id)) {
            setSelectedDestination(filteredPostos[0]);
        } else if (filteredPostos.length === 0) {
            setSelectedDestination(null);
        }
    }, [filteredPostos, selectedDestination]);

    const handleCopyToClipboard = () => {
        if (comparisonData.length === 0) return;

        const formatCurrency = (value) => value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 4
        });

        const maxSuppliers = Number.isNaN(parseInt(suppliersPerBase, 10))
            ? comparisonData.length
            : Math.max(1, parseInt(suppliersPerBase, 10));

        const headerLines = [
            `Relatório Rápido - ${new Date().toLocaleDateString('pt-BR')}`,
            `Combustível: ${settings.fuelTypes[selectedFuel]?.name || selectedFuel} | Destino: ${selectedDestination?.name || 'Não informado'} | Veículo: ${selectedVehicleLabel}`,
            `Base selecionada: ${selectedBase?.name || 'Automática por fornecedor'}`
        ];

        const subset = comparisonData.slice(0, maxSuppliers);

        const best = subset[0];
        if (best) {
            headerLines.push(`Melhor Custo: ${best.name} @ ${formatCurrency(best.finalPrice)}/L (Base: ${best.baseName} | Frete (${best.freightVehicleName || 'N/D'}): ${formatCurrency(best.freight)}/L)`);
        }

        const listLines = subset.map((d, i) => {
            const freightLabel = d.freightVehicleName || 'N/D';
            return `${i + 1}. ${d.name} — Base: ${d.baseName} — Frete (${freightLabel}): ${formatCurrency(d.freight)}/L — Total: ${formatCurrency(d.finalPrice)}/L`;
        });

        const text = [...headerLines, '', ...listLines].join('\n');
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: 'Copiado para a área de transferência!' });
        });
    };
    
    const handleGeneratePdf = () => {
        if (comparisonData.length === 0) return;
        generatePdf({
            date: new Date().toLocaleDateString('pt-BR'),
            sheetName: 'Dashboard',
            selectedFuel: settings.fuelTypes[selectedFuel]?.name,
            comparisonData,
            defaultDestination: selectedDestination.name
        });
    };

    if (loading) return <div className="flex justify-center items-center h-full"><RefreshCw className="w-12 h-12 text-primary animate-spin" /></div>;
    if (error) return <div className="flex flex-col justify-center items-center h-full text-destructive"><AlertTriangle className="w-12 h-12 mb-4" /><p>{error}</p></div>;

    const OilPriceCard = () => {
        if (oilPriceLoading) {
            return (
                <div className="flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                </div>
            );
        }
        
        if (!oilPrice || (!oilPrice.WTI && !oilPrice.BRENT)) {
            return (
                <Button onClick={fetchOilPrice} variant="ghost" size="sm" className="h-auto py-1">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    <span className="text-xs">Buscar</span>
                </Button>
            );
        }
        
        const getChangeClass = (change) => {
            if (!change) return 'text-muted-foreground';
            return change.startsWith('+') ? 'text-green-500' : 'text-red-500';
        };
        
        return (
            <div className="flex items-center gap-6">
                {oilPrice.WTI && oilPrice.WTI.price && (
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-muted-foreground">WTI</span>
                        <span className="text-lg font-mono font-bold text-foreground">${oilPrice.WTI.price.toFixed(2)}</span>
                        {oilPrice.WTI.change && (
                            <span className={`text-xs font-semibold ${getChangeClass(oilPrice.WTI.change)}`}>
                                {oilPrice.WTI.change}
                            </span>
                        )}
                    </div>
                )}
                {oilPrice.BRENT && oilPrice.BRENT.price && (
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-muted-foreground">BRENT</span>
                        <span className="text-lg font-mono font-bold text-foreground">${oilPrice.BRENT.price.toFixed(2)}</span>
                        {oilPrice.BRENT.change && (
                            <span className={`text-xs font-semibold ${getChangeClass(oilPrice.BRENT.change)}`}>
                                {oilPrice.BRENT.change}
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Helmet><title>Dashboard - Fuel Price Analyzer</title><meta name="description" content="Dashboard para análise de preços de combustíveis." /></Helmet>
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div><h1 className="text-3xl font-bold text-foreground">Dashboard de Análise Diária</h1><p className="text-muted-foreground">Comparativo de custos em tempo real para tomada de decisão.</p></div>
                <div className="bg-card px-6 py-3 rounded-lg border shadow-sm w-full lg:w-auto lg:min-w-[460px]">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-primary"/>
                        <span className="text-xs font-medium text-muted-foreground">Petróleo</span>
                        <div className="ml-auto flex items-center gap-4">
                            <OilPriceCard />
                            {oilPrice?.WTI?.timestamp && (
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                Atualizado às {new Date(oilPrice.WTI.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden">
                <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <div className="flex items-center gap-3">
                        <Filter className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold">Filtros da Análise</h3>
                    </div>
                    <Button variant="ghost" size="sm">
                        {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                </div>
                
                {showFilters && (
                    <div className="p-6 pt-2 border-t">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Base (Fornecedor) - Cidades Base */}
                            <Select value={selectedBase?.id || ''} onValueChange={id => setSelectedBase(baseCities.find(c => c.id === id))}>
                                <SelectTrigger className="w-full sm:w-[200px] bg-background"><SelectValue placeholder="Selecione a Base..." /></SelectTrigger>
                                <SelectContent>{(baseCities || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={selectedVehicleType} onValueChange={setSelectedVehicleType}>
                                <SelectTrigger className="w-full sm:w-[200px] bg-background">
                                    <SelectValue placeholder="Selecione o Veículo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(settings.vehicleTypes || {}).map(([key, info]) => (
                                        <SelectItem key={key} value={key}>
                                            {info.name || key}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedFuel} onValueChange={setSelectedFuel}>
                                <SelectTrigger className="w-full sm:w-[200px] bg-background">
                                    <SelectValue placeholder="Selecione o Combustível..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.keys(settings.fuelTypes).map(fuelKey => {
                                        const isAvailable = availableFuels.includes(fuelKey);
                                        const hasBase = selectedBase?.id;
                                        
                                        return (
                                            <SelectItem 
                                                key={fuelKey} 
                                                value={fuelKey}
                                                disabled={hasBase && !isAvailable}
                                                className={hasBase && !isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                                            >
                                                {settings.fuelTypes[fuelKey].name}
                                                {hasBase && !isAvailable && ' (Indisponível)'}
                                                {hasBase && isAvailable && ' ✓'}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                <SelectTrigger className="w-full sm:w-[200px] bg-background"><SelectValue placeholder="Selecione o Grupo..." /></SelectTrigger>
                                <SelectContent><SelectItem value="Todos">Todos os Grupos</SelectItem>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                            </Select>
                            {/* Destino - Postos (Destinos) */}
                            <Select 
                                value={selectedDestination?.id || ''} 
                                onValueChange={id => {
                                    const newPosto = postos.find(p => p.id === id);
                                    setSelectedDestination(newPosto);
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[200px] bg-background"><SelectValue placeholder="Selecione o Destino..." /></SelectTrigger>
                                <SelectContent>{filteredPostos.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>

            {/* Análise de Melhores Custos - Largura Total */}
            <motion.div 
                key={`analysis-${selectedDestination?.id}-${selectedFuel}`}
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
                className="bg-card border rounded-lg p-6"
            >
                <BestCostAnalysis
                    selectedGroup={selectedGroup}
                    selectedFuel={selectedFuel}
                    selectedDestination={selectedDestination}
                    baseCities={baseCities}
                    groups={groups}
                    postos={postos}
                    dailyPrices={dailyPrices}
                    suppliers={suppliers}
                    freightRoutes={freightRoutes}
                    settings={settings}
                    selectedVehicleType={selectedVehicleType}
                    suppliersPerBaseSetting={suppliersPerBase}
                    onSuppliersPerBaseChange={setSuppliersPerBase}
                />
            </motion.div>

            {/* Ações Rápidas - Movido para baixo */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
                className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-6 rounded-lg"
            >
                <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="w-6 h-6 text-primary" />
                    <h3 className="text-xl font-bold text-foreground">Ações Rápidas</h3>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                   <Button onClick={() => setIsReportModalOpen(true)} disabled={comparisonData.length === 0}>
                       <FileUp className="w-4 h-4 mr-2" />Relatório Detalhado
                   </Button>
                   <Button variant="secondary" onClick={handleCopyToClipboard} disabled={comparisonData.length === 0}>
                       <Copy className="w-4 h-4 mr-2" />Copiar Resumo
                   </Button>
                   <Button variant="outline" onClick={handleGeneratePdf} disabled={comparisonData.length === 0}>
                       <Download className="w-4 h-4 mr-2" />Baixar PDF
                   </Button>
                </div>
            </motion.div>
            
            <ChartsSection 
                key={`charts-${selectedDestination?.id}-${selectedFuel}`}
                results={comparisonData} 
                suppliers={suppliers} 
                postos={postos} 
                groups={groups}
                selectedFuel={selectedFuel}
                fuelTypes={settings.fuelTypes}
                selectedBase={selectedBase}
            />

            {/* Matriz Completa de Preços - Colapsável */}
            <ComprehensivePriceMatrix
                key={`matrix-${selectedDestination?.id}-${selectedFuel}`}
                selectedGroup={selectedGroup}
                groups={groups}
                postos={postos}
                baseCities={baseCities}
                dailyPrices={dailyPrices}
                suppliers={suppliers}
                freightRoutes={freightRoutes}
                settings={settings}
            />
            
            <AverageFuelPricesChart />
            
            <OilPriceChart />

            <AnimatePresence>
                {isReportModalOpen && (
                    <ReportModal 
                        reportData={{
                            stations: comparisonData.map(d => ({
                                name: d.name,
                                currentPrice: d.currentPrice,
                                freight: d.freight,
                                finalPrice: d.finalPrice,
                                baseName: d.baseName
                            })),
                            fuel: settings.fuelTypes[selectedFuel]?.name || selectedFuel,
                            destination: selectedDestination?.name || 'Não especificado',
                            date: new Date().toLocaleDateString('pt-BR')
                        }}
                        onClose={() => setIsReportModalOpen(false)}
                        onExport={handleGeneratePdf}
                    />
                )}
                {isManualModalOpen && (
                    <ManualPriceModal 
                        isOpen={isManualModalOpen} 
                        onClose={() => setIsManualModalOpen(false)} 
                        suppliers={suppliers} 
                        settings={settings} 
                        postos={postos} 
                        groups={groups} 
                        baseCities={baseCities}
                        onSave={async (data) => { 
                            const { error } = await supabase.from('daily_prices').upsert(data, { onConflict: 'user_id, date, supplier_id, base_city_id' }); 
                            if (error) {
                                toast({ title: "Erro ao salvar preço", description: error.message, variant: "destructive" }); 
                            } else { 
                                toast({ title: "Preço salvo com sucesso!" }); 
                                fetchData(); 
                            }
                        }} 
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default Dashboard;
