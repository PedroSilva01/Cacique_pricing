import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { getErrorMessage, showErrorToast } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { RefreshCw, AlertTriangle, FileUp, Download, Copy, Sparkles, Droplet, TrendingUp, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useDashboardData } from '@/hooks/useDashboardData';
import ReportModal from '@/components/ReportModal';
import ManualPriceModal from '@/components/ManualPriceModal';
import { generatePdf } from '@/lib/pdfGenerator';
import { Helmet } from 'react-helmet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import ChartsSection from '@/components/ChartsSection';
import OilPriceChart from '@/components/OilPriceChart';
import AverageFuelPricesChart from '@/components/AverageFuelPricesChart';
import BestCostAnalysis from '@/components/BestCostAnalysis';
import ComprehensivePriceMatrix from '@/components/ComprehensivePriceMatrix';

const Dashboard = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const userId = user?.id;

    const [error, setError] = useState(null);
    const [selectedBase, setSelectedBase] = useState(null);
    const [selectedVehicleType, setSelectedVehicleType] = useState('');
    const [selectedFuel, setSelectedFuel] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedDestination, setSelectedDestination] = useState(null);
    const [showFilters, setShowFilters] = useState(true);
    const [suppliersPerBase, setSuppliersPerBase] = useState('1');
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [oilPrice, setOilPrice] = useState(null);
    const [oilPriceLoading, setOilPriceLoading] = useState(true);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    const {
        loading,
        settings,
        dailyPrices,
        suppliers,
        baseCities,
        cities,
        postos,
        groups,
        freightRoutes,
        refetch: refetchDashboardData,
    } = useDashboardData(userId, {
        onError: (err) => {
            console.error('Error fetching dashboard data:', err);
            setError(`Falha ao buscar dados: ${getErrorMessage(err)}`);
            showErrorToast(toast, {
                title: 'Erro de Conexão',
                error: err,
                descriptionPrefix: 'Não foi possível carregar os dados',
            });
        },
    });
    
    const allUniqueSupplierBases = useMemo(() => {
      const bases = new Set();
      suppliers.forEach(s => {
        (s.available_products || []).forEach(p => bases.add(p));
      });
      return Array.from(bases);
    }, [suppliers]);


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

                const parseToNumber = (value) => {
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : null;
                };

                const formatChangePercent = (currentValue, previousValue) => {
                    const current = parseToNumber(currentValue);
                    const previous = parseToNumber(previousValue);

                    if (current === null || previous === null || previous === 0) {
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

                const previousWti = previousEntry?.wti_price != null ? parseToNumber(previousEntry.wti_price) : null;
                const previousBrent = previousEntry?.brent_price != null ? parseToNumber(previousEntry.brent_price) : null;

                const wtiCurrent = parseToNumber(data.data.WTI?.price);
                const brentCurrent = parseToNumber(data.data.BRENT?.price);

                const wtiPriceForPersistence = wtiCurrent ?? previousWti ?? null;
                const brentPriceForPersistence = brentCurrent ?? previousBrent ?? null;

                const wtiChange = previousWti != null && wtiPriceForPersistence != null
                    ? formatChangePercent(wtiPriceForPersistence, previousWti)
                    : '+0.00%';
                const brentChange = previousBrent != null && brentPriceForPersistence != null
                    ? formatChangePercent(brentPriceForPersistence, previousBrent)
                    : '+0.00%';

                const { error: upsertError } = await supabase.from('oil_prices').upsert({
                    date: today,
                    wti_price: wtiPriceForPersistence,
                    brent_price: brentPriceForPersistence,
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
                    wti: wtiPriceForPersistence,
                    brent: brentPriceForPersistence,
                });

                const adjustedOilData = {
                    ...(data.data || {}),
                    WTI: data.data.WTI ? { ...data.data.WTI, price: wtiPriceForPersistence, change: wtiChange } : undefined,
                    BRENT: data.data.BRENT ? { ...data.data.BRENT, price: brentPriceForPersistence, change: brentChange } : undefined,
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

    useEffect(() => {
        if (!userId) return;
        if (loading) return;
        if (filtersInitialized) return;

        const userSettings = settings || {};
        const allBaseCities = baseCities || [];
        const allPostos = postos || [];
        const vehicleTypeKeys = Object.keys(userSettings.vehicleTypes || {});

        // Inicializar apenas veículo
        setSelectedVehicleType(prev => {
            if (prev && vehicleTypeKeys.includes(prev)) {
                return prev;
            }
            return vehicleTypeKeys[0] || prev || '';
        });

        // Inicializar apenas base (se não houver valor prévio)
        if (allBaseCities.length > 0) {
            setSelectedBase(prev => prev || allBaseCities[0]);
        }

        // NÃO inicializar grupo, posto ou combustível automaticamente

        try {
            if (typeof window !== 'undefined') {
                const storageKey = `dashboard_filters_${userId}`;
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                    const saved = JSON.parse(raw);

                    // Restaurar apenas base e veículo do localStorage
                    if (saved.selectedVehicleType && vehicleTypeKeys.includes(saved.selectedVehicleType)) {
                        setSelectedVehicleType(saved.selectedVehicleType);
                    }

                    if (saved.selectedBaseId != null) {
                        const baseId = Number(saved.selectedBaseId);
                        const persistedBase = allBaseCities.find(b => b.id === baseId);
                        if (persistedBase) {
                            setSelectedBase(persistedBase);
                        }
                    }

                    // NÃO restaurar grupo, posto ou combustível - deixar vazio para o usuário escolher

                    if (typeof saved.showFilters === 'boolean') {
                        setShowFilters(saved.showFilters);
                    }

                    if (typeof saved.suppliersPerBase === 'string') {
                        setSuppliersPerBase(saved.suppliersPerBase);
                    }
                }
            }
        } catch (e) {
            console.error('Erro ao restaurar filtros do dashboard:', e);
        } finally {
            setFiltersInitialized(true);
        }
    }, [userId, loading, filtersInitialized, settings, baseCities, postos, groups]);

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

    // Filtrar grupos pela base selecionada
    const filteredGroups = useMemo(() => {
        if (!selectedBase?.id) return groups;
        
        return groups.filter(g => {
            // Verificar se o grupo carrega na base selecionada
            return g.base_city_ids?.includes(selectedBase.id);
        });
    }, [groups, selectedBase]);

    // Filtrar postos pelo grupo selecionado
    const filteredPostos = useMemo(() => {
        if (!selectedGroup) return [];
        
        return postos.filter(p => p.group_ids?.includes(selectedGroup));
    }, [postos, selectedGroup]);

    // Filtrar combustíveis pelo posto selecionado
    const filteredFuels = useMemo(() => {
        if (!selectedDestination) return [];
        
        // Se o posto tem fuel_types configurado, usar isso
        if (selectedDestination.fuel_types && Array.isArray(selectedDestination.fuel_types)) {
            return selectedDestination.fuel_types;
        }
        
        // Caso contrário, retornar todos os combustíveis
        const allFuelTypes = Object.keys(settings.fuelTypes || {});
        return allFuelTypes;
    }, [selectedDestination, settings.fuelTypes]);

    const opportunityMetrics = useMemo(() => {
        if (!comparisonData || comparisonData.length < 2) return null;

        const best = comparisonData[0];
        const worst = comparisonData[comparisonData.length - 1];

        const avgFinalPriceRaw = comparisonData.reduce((sum, item) => sum + (item.finalPrice || 0), 0) / comparisonData.length;
        const avgFinalPrice = Number.isFinite(avgFinalPriceRaw) ? avgFinalPriceRaw : null;

        const rawDiff = (worst.finalPrice ?? 0) - (best.finalPrice ?? 0);
        const perLiterSavingsMax = Number.isFinite(rawDiff) && rawDiff > 0 ? rawDiff : 0;

        const vehicleVolume = selectedVehicleType && settings?.vehicleTypes?.[selectedVehicleType]?.volume;
        const tripSavingsRaw = vehicleVolume && Number.isFinite(vehicleVolume)
            ? perLiterSavingsMax * vehicleVolume
            : null;
        const perTripSavings = Number.isFinite(tripSavingsRaw) && tripSavingsRaw > 0 ? tripSavingsRaw : null;

        return {
            best,
            worst,
            avgFinalPrice,
            perLiterSavingsMax,
            perTripSavings,
        };
    }, [comparisonData, settings, selectedVehicleType]);

    const dataGapMetrics = useMemo(() => {
        if (!selectedFuel) return null;

        const baseId = selectedBase?.id || null;
        const fuelKey = selectedFuel;

        const suppliersWithProduct = suppliers.filter((s) =>
            Array.isArray(s.available_products) && s.available_products.includes(fuelKey),
        );

        const supplierIdsWithProduct = new Set(suppliersWithProduct.map((s) => s.id));

        const supplierIdsWithPrice = new Set();
        (dailyPrices || []).forEach((record) => {
            if (!supplierIdsWithProduct.has(record.supplier_id)) return;
            if (baseId && record.base_city_id !== baseId) return;
            if (!record.prices) return;
            const price = record.prices[fuelKey];
            if (price === null || price === undefined) return;
            supplierIdsWithPrice.add(record.supplier_id);
        });

        const suppliersMissingPrice = suppliersWithProduct.filter(
            (s) => !supplierIdsWithPrice.has(s.id),
        );

        let missingFreightForCurrent = false;

        if (selectedDestination && baseId) {
            const destCityId = selectedDestination.city_id;
            const hasRoute = freightRoutes.some(
                (route) =>
                    route.origin_city_id === baseId &&
                    route.destination_city_id === destCityId,
            );
            missingFreightForCurrent = !hasRoute;
        }

        const sampleMissingNames = suppliersMissingPrice.slice(0, 3).map((s) => s.name);

        return {
            suppliersWithProductCount: suppliersWithProduct.length,
            suppliersMissingPriceCount: suppliersMissingPrice.length,
            sampleMissingNames,
            missingFreightForCurrent,
        };
    }, [selectedFuel, selectedBase, selectedDestination, suppliers, dailyPrices, freightRoutes]);

    // Os filtros em cascata acontecem através dos useMemo (filteredGroups, filteredPostos, filteredFuels)
    // Não precisamos de useEffects automáticos que resetam valores

    useEffect(() => {
        if (!userId) return;
        try {
            if (typeof window === 'undefined') return;
            const storageKey = `dashboard_filters_${userId}`;
            const payload = {
                selectedBaseId: selectedBase?.id || null,
                selectedVehicleType: selectedVehicleType || '',
                selectedFuel: selectedFuel || '',
                selectedGroup,
                selectedDestinationId: selectedDestination?.id || null,
                showFilters,
                suppliersPerBase,
            };
            localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch (e) {
            console.error('Erro ao salvar filtros do dashboard:', e);
        }
    }, [userId, selectedBase, selectedVehicleType, selectedFuel, selectedGroup, selectedDestination, showFilters, suppliersPerBase]);

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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
            <Helmet><title>Dashboard - Rede Cacique</title><meta name="description" content="Dashboard para análise de preços de combustíveis." /></Helmet>
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                        <div className="relative p-4 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-2xl shadow-2xl">
                            <Sparkles className="w-10 h-10 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">Dashboard de Análise Diária</h1>
                        <p className="text-muted-foreground">Comparativo de custos em tempo real para tomada de decisão</p>
                    </div>
                </div>
                <div className="bg-card px-6 py-3 rounded-lg border shadow-sm">
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

            <div className="max-w-7xl mx-auto space-y-6">
            {/* Filtros Colapsáveis */}
            <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardHeader 
                    className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Filter className="w-5 h-5 text-blue-600" />
                            Filtros da Análise
                        </CardTitle>
                        {showFilters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </CardHeader>
                
                {showFilters && (
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            {/* 1. Base (Fornecedor) - Cidades Base */}
                            <Select
                                value={selectedBase?.id || ''}
                                onValueChange={(value) => {
                                    if (!value) {
                                        setSelectedBase(null);
                                        return;
                                    }
                                    const newBase = baseCities.find(c => c.id === value);
                                    setSelectedBase(newBase || null);
                                }}
                            >
                                <SelectTrigger className="w-full border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl text-slate-900 dark:text-slate-100">
                                    <SelectValue placeholder="Selecione a Base..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {(baseCities || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {/* 2. Data */}
                            <DatePicker
                                value={selectedDate}
                                onChange={setSelectedDate}
                                className="h-12"
                            />
                            {/* 3. Grupo */}
                            <Select
                                value={selectedGroup || ''}
                                onValueChange={value => {
                                    if (!value || value === '__empty__') {
                                        setSelectedGroup(null);
                                        return;
                                    }
                                    setSelectedGroup(value);
                                }}
                            >
                                <SelectTrigger className="w-full border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl text-slate-900 dark:text-slate-100">
                                    <SelectValue placeholder="Selecione o Grupo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredGroups.length > 0 ? (
                                        filteredGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)
                                    ) : (
                                        <SelectItem value="__empty__" disabled>Nenhum grupo disponível</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {/* 4. Posto (Destino) */}
                            <Select 
                                value={selectedDestination?.id || ''} 
                                onValueChange={id => {
                                    if (!id || id === '__empty__') {
                                        setSelectedDestination(null);
                                        return;
                                    }
                                    const newPosto = filteredPostos.find(p => p.id === id);
                                    setSelectedDestination(newPosto || null);
                                }}
                            >
                                <SelectTrigger className="w-full border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl text-slate-900 dark:text-slate-100">
                                    <SelectValue placeholder="Selecione o Posto..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredPostos.length > 0 ? (
                                        filteredPostos.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                                    ) : (
                                        <SelectItem value="__empty__" disabled>Nenhum posto disponível</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {/* 5. Combustível */}
                            <Select value={selectedFuel || ''} onValueChange={setSelectedFuel}>
                                <SelectTrigger className="w-full border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl text-slate-900 dark:text-slate-100">
                                    <SelectValue placeholder="Selecione o Combustível..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredFuels.map(fuelKey => (
                                        <SelectItem key={fuelKey} value={fuelKey}>
                                            {settings.fuelTypes[fuelKey]?.name || fuelKey}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {/* 6. Veículo (sempre todas as opções disponíveis) */}
                            <Select value={selectedVehicleType || ''} onValueChange={setSelectedVehicleType}>
                                <SelectTrigger className="w-full border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl text-slate-900 dark:text-slate-100">
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
                        </div>
                    </CardContent>
                )}
            </Card>

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
                    selectedDate={selectedDate}
                />
            </motion.div>

            {(opportunityMetrics || dataGapMetrics) && (
                <div className="grid gap-4 md:grid-cols-2">
                    {opportunityMetrics && (
                        <Card className="border border-primary/30 bg-card/80">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Oportunidade de economia
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p>
                                    Melhor opção atual:{' '}
                                    <span className="font-semibold">{opportunityMetrics.best.name}</span>{' '}
                                    ({opportunityMetrics.best.baseName}) —{' '}
                                    <span className="font-mono">
                                        {opportunityMetrics.best.finalPrice.toLocaleString('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                            minimumFractionDigits: 4,
                                        })}
                                        /L
                                    </span>
                                </p>
                                {opportunityMetrics.avgFinalPrice != null && (
                                    <p className="text-xs text-muted-foreground">
                                        Preço médio entre opções:{' '}
                                        <span className="font-mono">
                                            {opportunityMetrics.avgFinalPrice.toLocaleString('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                                minimumFractionDigits: 4,
                                            })}
                                            /L
                                        </span>
                                    </p>
                                )}
                                {opportunityMetrics.perLiterSavingsMax > 0 ? (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                        Economia potencial máxima entre opções:{' '}
                                        <span className="font-mono">
                                            {opportunityMetrics.perLiterSavingsMax.toLocaleString('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                                minimumFractionDigits: 4,
                                            })}
                                            /L
                                        </span>
                                        {opportunityMetrics.perTripSavings && (
                                            <>
                                                {' '}
                                                ({'~'}
                                                {opportunityMetrics.perTripSavings.toLocaleString('pt-BR', {
                                                    style: 'currency',
                                                    currency: 'BRL',
                                                    minimumFractionDigits: 2,
                                                })}{' '}
                                                por viagem do veículo selecionado)
                                            </>
                                        )}
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        As opções atuais estão bem próximas entre si. Ajuste filtros para buscar novas
                                        oportunidades.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="border border-muted/40 bg-card/80">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Lacunas de dados
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            {dataGapMetrics ? (
                                <>
                                    <p>
                                        Fornecedores com produto selecionado:{' '}
                                        <span className="font-semibold">
                                            {dataGapMetrics.suppliersWithProductCount}
                                        </span>
                                    </p>
                                    <p>
                                        Sem preço cadastrado para este combustível
                                        {selectedBase?.name ? ` na base ${selectedBase.name}` : ''}:{' '}
                                        <span className="font-semibold">
                                            {dataGapMetrics.suppliersMissingPriceCount}
                                        </span>
                                    </p>
                                    {dataGapMetrics.sampleMissingNames.length > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            Ex.: {dataGapMetrics.sampleMissingNames.join(', ')}
                                            {dataGapMetrics.suppliersMissingPriceCount >
                                                dataGapMetrics.sampleMissingNames.length &&
                                                ' ...'}
                                        </p>
                                    )}
                                    {selectedDestination && selectedBase?.id && (
                                        <p className="text-xs mt-1">
                                            Rota de frete Base{' '}
                                            <span className="font-semibold">{selectedBase.name}</span>
                                            {' → '}
                                            <span className="font-semibold">{selectedDestination.name}</span>:{' '}
                                            {dataGapMetrics.missingFreightForCurrent ? (
                                                <span className="text-amber-600 dark:text-amber-400">
                                                    não cadastrada
                                                </span>
                                            ) : (
                                                <span className="text-emerald-600 dark:text-emerald-400">
                                                    cadastrada
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Selecione um combustível para visualizar possíveis lacunas de preços e fretes.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

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
                                showErrorToast(toast, { title: 'Erro ao salvar preço', error });
                            } else { 
                                toast({ title: "Preço salvo com sucesso!" }); 
                                refetchDashboardData(); 
                            }
                        }} 
                    />
                )}
            </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default Dashboard;
