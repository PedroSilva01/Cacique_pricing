import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  RefreshCcw,
  MapPin,
  Truck,
  Gauge,
  TrendingUp,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  ChevronsUpDown,
  Check,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { showErrorToast } from '@/lib/utils';
import { computePearsonCorrelation } from '@/lib/analytics';
import { useDashboardData } from '@/hooks/useDashboardData';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatCurrency = (value) =>
  (value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 4,
  });

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center text-center px-6 py-12 border border-dashed rounded-xl bg-background/60">
    <Truck className="w-10 h-10 text-muted-foreground mb-4" />
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-md">{description}</p>
  </div>
);

const SummaryStat = ({ label, value, icon: Icon }) => (
  <Card className="bg-card/70 border-muted/40">
    <CardContent className="flex items-center gap-3 py-4">
      <div className="p-2 rounded-full bg-primary/10 text-primary">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const ExpensiveFreightTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="glass-effect rounded-lg p-3 border bg-background/90 shadow-md">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {data.worstVehicleName && (
        <p className="text-xs text-muted-foreground mb-1">
          Veículo mais caro: <span className="font-semibold">{data.worstVehicleName}</span>
        </p>
      )}
      {data.bestVehicleName && (
        <p className="text-xs text-muted-foreground mb-1">
          Veículo mais barato: <span className="font-semibold">{data.bestVehicleName}</span>
        </p>
      )}
      <p className="text-xs">
        R$/L/km (mais caro):{' '}
        <span className="font-mono">{formatCurrency(data.worstPerLiter)}</span>
      </p>
      {data.bestPerLiter != null && (
        <p className="text-xs">
          R$/L/km (mais barato):{' '}
          <span className="font-mono">{formatCurrency(data.bestPerLiter)}</span>
        </p>
      )}
    </div>
  );
};

const FreightRouteCard = ({ baseCityName, routes }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
  >
    <Card className="border border-primary/10 bg-gradient-to-br from-background to-primary/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {baseCityName}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {routes.length} rota{routes.length === 1 ? '' : 's'} disponível(is)
          </p>
        </div>
        <Badge variant="secondary">Base</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {routes.map((route) => (
            <motion.div
              key={route.id}
              layout
              className="rounded-xl border border-muted/40 bg-background/80 shadow-sm hover:shadow-md transition-shadow"
            >
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Destino</p>
                    <p className="text-base font-semibold text-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      {route.destinationName}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Frete ({route.vehicleLabel})</p>
                      <p className="text-lg font-semibold text-primary">{formatCurrency(route.costPerLiter)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Distância</p>
                      <p className="text-sm font-medium text-foreground">{route.distanceKm ?? '—'} km</p>
                    </div>
                    <div className="text-muted-foreground transition-transform group-open:rotate-180">
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <div className="border rounded-lg border-dashed p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-primary" />
                      <span>
                        Tarifa aplicada a <strong>{route.vehicleLabel}</strong> — {route.vehicleVolume?.toLocaleString('pt-BR')} L
                      </span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Observações
                      </p>
                      <p>{route.notes || 'Nenhuma observação fornecida.'}</p>
                    </div>
                  </div>
                </div>
              </details>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const FreightDetail = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const {
    loading,
    baseCities,
    cities,
    freightRoutes,
    settings,
    refetch: refetchDashboardData,
  } = useDashboardData(userId, {
    onError: (err) => {
      console.error('Erro ao carregar dados de frete', err);
      showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
    },
  });
  const [anttRows, setAnttRows] = useState([]);
  const [anttLoading, setAnttLoading] = useState(true);
  const [anttError, setAnttError] = useState(null);
  const [selectedDestinations, setSelectedDestinations] = useState([]);
  const [includeAllDestinations, setIncludeAllDestinations] = useState(true);
  const [selectedBaseIds, setSelectedBaseIds] = useState([]);
  const [includeAllBases, setIncludeAllBases] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [expensiveVehicleKey, setExpensiveVehicleKey] = useState('all');
  const [expensiveBaseId, setExpensiveBaseId] = useState('all');
  
  useEffect(() => {
    const vehicleKeys = Object.keys(settings?.vehicleTypes || {});
    if (vehicleKeys.length > 0) {
      setSelectedVehicle((prev) => prev || vehicleKeys[0]);
    }
  }, [settings]);

  // Carregar tabela de frete mínimo ANTT apenas para granel_líquido
  useEffect(() => {
    const fetchAntt = async () => {
      setAnttLoading(true);
      setAnttError(null);
      try {
        const { data, error } = await supabase
          .from('frete_minimo_antt')
          .select('*')
          .eq('cargo_type', 'granel_liquido');

        if (error) throw error;
        setAnttRows(data || []);
      } catch (err) {
        console.error('Erro ao carregar tabela ANTT:', err);
        setAnttError(err);
      } finally {
        setAnttLoading(false);
      }
    };

    fetchAntt();
  }, []);

  const vehicleOptions = useMemo(() => Object.entries(settings.vehicleTypes || {}), [settings.vehicleTypes]);

  const baseOptions = useMemo(
    () => baseCities.map((base) => ({ id: String(base.id), name: base.name })),
    [baseCities],
  );

  const destinationsOptions = useMemo(
    () => cities.map((city) => ({ id: String(city.id), name: city.name })),
    [cities],
  );

  const filteredDestinationOptions = useMemo(() => {
    const term = destinationSearch.trim().toLowerCase();
    if (!term) return destinationsOptions;
    return destinationsOptions.filter((option) => option.name.toLowerCase().includes(term));
  }, [destinationSearch, destinationsOptions]);

  const filteredRoutesByBase = useMemo(() => {
    if (!freightRoutes.length || !selectedVehicle) return [];

    const grouped = new Map();

    freightRoutes.forEach((route) => {
      if (!route.origin) return;
      const normalizedBaseId = String(route.origin_city_id);
      const normalizedDestinationId = String(route.destination_city_id);
      const shouldFilterDestinations = !includeAllDestinations;
      if (shouldFilterDestinations) {
        if (selectedDestinations.length === 0) return;
        if (!selectedDestinations.includes(normalizedDestinationId)) return;
      }

      const shouldFilterBases = !includeAllBases;
      if (shouldFilterBases) {
        if (selectedBaseIds.length === 0) return;
        if (!selectedBaseIds.includes(normalizedBaseId)) return;
      }

      const vehicleData = settings.vehicleTypes?.[selectedVehicle];
      const costPerLiter = route.costs?.[selectedVehicle] ?? null;

      if (costPerLiter === null || costPerLiter === undefined) return;

      const normalizedRoute = {
        id: route.id,
        destinationName: route.destination?.name ?? 'Destino desconhecido',
        distanceKm: route.distance_km ?? route.distance ?? null,
        costPerLiter,
        vehicleLabel: vehicleData?.name || selectedVehicle,
        vehicleVolume: vehicleData?.volume,
        notes: route.notes,
        // Metadados ANTT
        axisCount: route.axis_count ?? null,
        anttTableKind: route.antt_table_kind || null,
        averageToll: route.average_toll ?? null,
        hasMandatoryReturn: route.has_mandatory_return ?? false,
        cargoType: route.cargo_type || 'granel_liquido',
      };

      if (!grouped.has(route.origin_city_id)) {
        grouped.set(route.origin_city_id, {
          baseCityName: route.origin?.name || 'Base desconhecida',
          routes: [],
        });
      }

      grouped.get(route.origin_city_id).routes.push(normalizedRoute);
    });

    return Array.from(grouped.values()).filter((entry) => entry.routes.length > 0);
  }, [freightRoutes, selectedDestinations, includeAllDestinations, selectedVehicle, settings.vehicleTypes]);

  const preparedRows = useMemo(
    () =>
      filteredRoutesByBase.flatMap((entry) =>
        entry.routes.map((route) => ({
          baseCity: entry.baseCityName,
          destination: route.destinationName,
          vehicle: route.vehicleLabel,
          costPerLiter: route.costPerLiter,
          distanceKm: route.distanceKm,
          vehicleVolume: route.vehicleVolume,
          notes: route.notes || '',
          axisCount: route.axisCount,
          anttTableKind: route.anttTableKind,
          averageToll: route.averageToll,
          hasMandatoryReturn: route.hasMandatoryReturn,
          cargoType: route.cargoType,
        })),
      ),
    [filteredRoutesByBase],
  );

  const totalRoutes = preparedRows.length;

  // Função utilitária para encontrar o coeficiente ANTT adequado pela distância
  const findAnttRowFor = useCallback(
    (axisCount, tableKind, distanceKm) => {
      if (!axisCount || !tableKind || !Number.isFinite(distanceKm)) return null;
      return (
        anttRows.find(
          (row) =>
            row.axis_count === axisCount &&
            row.table_kind === tableKind &&
            distanceKm >= row.distance_min_km &&
            distanceKm <= row.distance_max_km,
        ) || null
      );
    },
    [anttRows],
  );

  // Calcular piso mínimo ANTT em R$/L para cada rota (quando possível)
  const rowsWithAntt = useMemo(() => {
    if (!preparedRows.length || !anttRows.length) {
      return preparedRows.map((row) => ({ ...row, anttFreightPerLiter: null, anttDiffPerLiter: null }));
    }

    return preparedRows.map((row) => {
      const distance = typeof row.distanceKm === 'number' ? row.distanceKm : null;
      const axisCount = row.axisCount || null;
      const tableKind = row.anttTableKind || null;
      const volume = row.vehicleVolume && row.vehicleVolume > 0 ? row.vehicleVolume : null;

      if (!distance || !axisCount || !tableKind || !volume) {
        return { ...row, anttFreightPerLiter: null, anttDiffPerLiter: null };
      }

      const coef = findAnttRowFor(axisCount, tableKind, distance);
      if (!coef) {
        return { ...row, anttFreightPerLiter: null, anttDiffPerLiter: null };
      }

      const { ccd, cc } = coef;

      // Piso mínimo base (R$/viagem) = DIST * CCD + CC
      let pisoViagem = distance * Number(ccd) + Number(cc);

      // Somar pedágios médios, se informados na rota
      if (row.averageToll != null) {
        pisoViagem += Number(row.averageToll);
      }

      // Retorno vazio obrigatório, seguindo exemplo da ANTT
      if (row.hasMandatoryReturn) {
        pisoViagem += 0.92 * distance * Number(ccd);
      }

      const anttFreightPerLiter = pisoViagem / volume;
      const anttDiffPerLiter = row.costPerLiter - anttFreightPerLiter;

      return { ...row, anttFreightPerLiter, anttDiffPerLiter };
    });
  }, [preparedRows, anttRows, findAnttRowFor]);

  const summaryStats = useMemo(() => {
    const allCosts = preparedRows.map((r) => r.costPerLiter);
    if (allCosts.length === 0) {
      return {
        count: 0,
        min: '—',
        max: '—',
        average: '—',
      };
    }

    const min = Math.min(...allCosts);
    const max = Math.max(...allCosts);
    const average = allCosts.reduce((acc, value) => acc + value, 0) / allCosts.length;

    return {
      count: totalRoutes,
      min: formatCurrency(min),
      max: formatCurrency(max),
      average: formatCurrency(average),
    };
  }, [preparedRows, totalRoutes]);

  const distanceCostMetrics = useMemo(() => {
    const points = preparedRows.filter(
      (row) =>
        typeof row.distanceKm === 'number' &&
        Number.isFinite(row.distanceKm) &&
        Number.isFinite(row.costPerLiter),
    );
    if (!points.length) return null;

    return computePearsonCorrelation(points, {
      xKey: 'distanceKm',
      yKey: 'costPerLiter',
      minPoints: 1,
    });
  }, [preparedRows]);

  const vehicleComparison = useMemo(() => {
    if (!freightRoutes.length || !settings?.vehicleTypes) return null;

    const vehicleKeys = Object.keys(settings.vehicleTypes || {});
    if (!vehicleKeys.length) return null;

    const activeBaseIds = includeAllBases
      ? baseCities.map((b) => String(b.id))
      : selectedBaseIds;
    const activeDestIds = includeAllDestinations
      ? cities.map((c) => String(c.id))
      : selectedDestinations;

    if (!activeBaseIds.length || !activeDestIds.length) return null;

    const sum = {};
    const count = {};
    vehicleKeys.forEach((key) => {
      sum[key] = 0;
      count[key] = 0;
    });

    const baseSet = new Set(activeBaseIds.map(String));
    const destSet = new Set(activeDestIds.map(String));

    freightRoutes.forEach((route) => {
      if (!route.origin) return;
      const baseId = String(route.origin_city_id);
      const destId = String(route.destination_city_id);
      if (!baseSet.has(baseId) || !destSet.has(destId)) return;

      vehicleKeys.forEach((key) => {
        const value = route.costs?.[key];
        const num =
          typeof value === 'number'
            ? value
            : value != null
            ? parseFloat(value)
            : NaN;
        if (!Number.isFinite(num) || num <= 0) return;
        sum[key] += num;
        count[key] += 1;
      });
    });

    const entries = vehicleKeys
      .filter((key) => count[key] > 0)
      .map((key) => ({
        key,
        name: settings.vehicleTypes[key]?.name || key,
        avgCost: sum[key] / count[key],
        routeCount: count[key],
      }))
      .sort((a, b) => a.avgCost - b.avgCost);

    if (!entries.length) return null;

    const best = entries[0];
    const worst = entries[entries.length - 1];
    const spread = worst.avgCost - best.avgCost;

    return { entries, best, worst, spread };
  }, [freightRoutes, settings, includeAllBases, selectedBaseIds, includeAllDestinations, selectedDestinations, baseCities, cities]);

  const missingRoutes = useMemo(() => {
    if (!baseCities.length || !cities.length) return [];

    const existing = new Set();
    freightRoutes.forEach((route) => {
      const baseId = String(route.origin_city_id);
      const destId = String(route.destination_city_id);
      existing.add(`${baseId}-${destId}`);
    });

    const activeBaseIds = includeAllBases
      ? baseCities.map((b) => String(b.id))
      : selectedBaseIds;
    const activeDestIds = includeAllDestinations
      ? cities.map((c) => String(c.id))
      : selectedDestinations;

    const result = [];
    activeBaseIds.forEach((baseId) => {
      activeDestIds.forEach((destId) => {
        const key = `${baseId}-${destId}`;
        if (existing.has(key)) return;
        const base = baseCities.find((b) => String(b.id) === baseId);
        const dest = cities.find((c) => String(c.id) === destId);
        if (!base || !dest) return;
        result.push({
          baseName: base.name,
          destinationName: dest.name,
        });
      });
    });

    return result.slice(0, 50);
  }, [baseCities, cities, freightRoutes, includeAllBases, selectedBaseIds, includeAllDestinations, selectedDestinations]);

  const expensiveDestinations = useMemo(() => {
    if (!freightRoutes.length || !settings?.vehicleTypes) return [];

    const vehicleKeys = Object.keys(settings.vehicleTypes || {});
    if (!vehicleKeys.length) return [];

    const vehicleKeysForChart =
      expensiveVehicleKey && expensiveVehicleKey !== 'all'
        ? vehicleKeys.filter((key) => key === expensiveVehicleKey)
        : vehicleKeys;
    if (!vehicleKeysForChart.length) return [];

    const activeBaseIds = includeAllBases ? baseCities.map((b) => String(b.id)) : selectedBaseIds;
    const activeDestIds = includeAllDestinations ? cities.map((c) => String(c.id)) : selectedDestinations;

    const baseIdsForChart =
      expensiveBaseId && expensiveBaseId !== 'all'
        ? activeBaseIds.map(String).filter((id) => id === String(expensiveBaseId))
        : activeBaseIds.map(String);

    if (!baseIdsForChart.length || !activeDestIds.length) return [];

    const baseSet = new Set(baseIdsForChart);
    const destSet = new Set(activeDestIds.map(String));

    const sum = {};
    const count = {};

    freightRoutes.forEach((route) => {
      if (!route.origin || !route.destination) return;
      const baseId = String(route.origin_city_id);
      const destId = String(route.destination_city_id);
      if (!baseSet.has(baseId) || !destSet.has(destId)) return;

      const distanceRaw = route.distance_km ?? route.distance ?? null;
      const distanceKm =
        typeof distanceRaw === 'number'
          ? distanceRaw
          : distanceRaw != null
          ? parseFloat(distanceRaw)
          : NaN;
      if (!Number.isFinite(distanceKm) || distanceKm <= 0) return;

      vehicleKeysForChart.forEach((key) => {
        const value = route.costs?.[key];
        const costPerLiter =
          typeof value === 'number'
            ? value
            : value != null
            ? parseFloat(value)
            : NaN;
        if (!Number.isFinite(costPerLiter) || costPerLiter <= 0) return;

        const normalizedIndex = costPerLiter / distanceKm; // R$/L/km

        if (!sum[destId]) {
          sum[destId] = {};
          count[destId] = {};
        }
        if (!sum[destId][key]) {
          sum[destId][key] = 0;
          count[destId][key] = 0;
        }
        sum[destId][key] += normalizedIndex;
        count[destId][key] += 1;
      });
    });

    const rows = Object.entries(sum)
      .map(([destId, vehicleSums]) => {
        const vehicleCounts = count[destId] || {};
        const city = cities.find((c) => String(c.id) === destId);
        if (!city) return null;

        let best = null;
        let worst = null;

        Object.keys(vehicleSums).forEach((key) => {
          const c = vehicleCounts[key];
          if (!c) return;
          const avgIndex = vehicleSums[key] / c;
          if (!Number.isFinite(avgIndex)) return;
          const vehicleName = settings.vehicleTypes?.[key]?.name || key;

          if (!best || avgIndex < best.value) {
            best = { key, value: avgIndex, name: vehicleName };
          }
          if (!worst || avgIndex > worst.value) {
            worst = { key, value: avgIndex, name: vehicleName };
          }
        });

        if (!worst) return null;

        return {
          destinationId: destId,
          destinationName: city.name,
          worstPerLiter: worst.value,
          bestPerLiter: best ? best.value : null,
          bestVehicleName: best ? best.name : null,
          worstVehicleName: worst.name,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.worstPerLiter - a.worstPerLiter);

    return rows;
  }, [
    freightRoutes,
    settings,
    includeAllBases,
    selectedBaseIds,
    includeAllDestinations,
    selectedDestinations,
    baseCities,
    cities,
    expensiveVehicleKey,
    expensiveBaseId,
  ]);

  const selectedDestinationsLabels = useMemo(() => {
    if (includeAllDestinations) return ['Todas as cidades'];
    if (selectedDestinations.length === 0) return ['Nenhuma cidade selecionada'];
    return selectedDestinations
      .map((id) => destinationsOptions.find((c) => c.id === id)?.name || 'Cidade desconhecida')
      .filter(Boolean);
  }, [includeAllDestinations, selectedDestinations, destinationsOptions]);

  const selectedBasesLabels = useMemo(() => {
    if (includeAllBases) return ['Todas as bases'];
    if (selectedBaseIds.length === 0) return ['Nenhuma base selecionada'];
    return selectedBaseIds
      .map((id) => baseOptions.find((b) => b.id === id)?.name || 'Base desconhecida')
      .filter(Boolean);
  }, [includeAllBases, selectedBaseIds, baseOptions]);

  const selectedVehicleLabel = useMemo(() => {
    if (!selectedVehicle) return '—';
    return settings.vehicleTypes?.[selectedVehicle]?.name || selectedVehicle;
  }, [selectedVehicle, settings.vehicleTypes]);

  const handleDestinationToggle = useCallback((cityId, checked) => {
    setSelectedDestinations((prev) => {
      if (checked) {
        if (prev.includes(cityId)) return prev;
        return [...prev, cityId];
      }
      return prev.filter((id) => id !== cityId);
    });
  }, []);

  const handleBaseToggle = useCallback((baseId, checked) => {
    setSelectedBaseIds((prev) => {
      if (checked) {
        if (prev.includes(baseId)) return prev;
        return [...prev, baseId];
      }
      return prev.filter((id) => id !== baseId);
    });
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!preparedRows.length) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    setExportingPdf(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text('Detalhamento de Frete', 14, 16);
      doc.setFontSize(10);
      doc.text(`Destino(s): ${selectedDestinationsLabels.join(', ')}`, 14, 24);
      doc.text(`Veículo: ${selectedVehicleLabel}`, 14, 30);
      doc.text(`Rotas exportadas: ${totalRoutes}`, 14, 36);

      autoTable(doc, {
        startY: 40,
        head: [[
          'Cidade Base',
          'Cidade Destino',
          'Tipo de Veículo',
          'Tarifa (R$/L)',
          'Distância (km)',
          'Volume (L)',
          'Observações',
        ]],
        body: preparedRows.map((row) => [
          row.baseCity,
          row.destination,
          row.vehicle,
          formatCurrency(row.costPerLiter),
          row.distanceKm ?? '—',
          row.vehicleVolume ? row.vehicleVolume.toLocaleString('pt-BR') : '—',
          row.notes,
        ]),
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'center' },
          5: { halign: 'right' },
        },
        headStyles: { fillColor: [24, 119, 242] },
      });

      doc.save(`detalhamento-frete-${Date.now()}.pdf`);
      toast({
        title: 'PDF gerado com sucesso!',
        description: `${totalRoutes} rotas exportadas.`,
      });
    } catch (err) {
      console.error('Erro ao gerar PDF', err);
      toast({
        title: 'Erro ao gerar PDF',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setExportingPdf(false);
    }
  }, [preparedRows, selectedDestinationsLabels, selectedVehicleLabel, toast, totalRoutes]);

  const handleExportExcel = useCallback(async () => {
    if (!preparedRows.length) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    setExportingExcel(true);

    try {
      const excelModule = await import('exceljs/dist/exceljs.min.js');
      const ExcelJS = excelModule?.Workbook ? excelModule : excelModule.default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Fuel Analyzer';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Detalhamento de Frete');
      sheet.columns = [
        { header: 'Cidade Base', key: 'baseCity', width: 25 },
        { header: 'Cidade Destino', key: 'destination', width: 25 },
        { header: 'Tipo de Veículo', key: 'vehicle', width: 20 },
        { header: 'Tarifa (R$/L)', key: 'costPerLiter', width: 18, style: { numFmt: 'R$ #,##0.0000' } },
        { header: 'Distância (km)', key: 'distanceKm', width: 16 },
        { header: 'Volume (L)', key: 'vehicleVolume', width: 16 },
        { header: 'Observações', key: 'notes', width: 40 },
      ];

      sheet.addRow([]);
      sheet.addRow([`Destino(s): ${selectedDestinationsLabels.join(', ')}`]);
      sheet.addRow([`Veículo: ${selectedVehicleLabel}`]);
      sheet.addRow([`Rotas exportadas: ${totalRoutes}`]);
      sheet.addRow([]);

      const headerRowNumber = sheet.actualRowCount + 1;
      sheet.addRow(sheet.columns.map((col) => col.header));
      const headerRow = sheet.getRow(headerRowNumber);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center' };

      preparedRows.forEach((row) => {
        sheet.addRow({
          ...row,
          costPerLiter: row.costPerLiter,
          distanceKm: row.distanceKm ?? undefined,
          vehicleVolume: row.vehicleVolume ?? undefined,
        });
      });

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber < headerRowNumber) {
          return;
        }
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `detalhamento-frete-${Date.now()}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Planilha gerada com sucesso!',
        description: `${totalRoutes} rotas exportadas.`,
      });
    } catch (err) {
      console.error('Erro ao gerar XLSX', err);
      toast({
        title: 'Erro ao gerar XLSX',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setExportingExcel(false);
    }
  }, [preparedRows, selectedDestinationsLabels, selectedVehicleLabel, toast, totalRoutes]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const hasRoutes = filteredRoutesByBase.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      <header className="flex items-center gap-4 mb-8">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
          <div className="relative p-4 bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 rounded-2xl shadow-2xl">
            <Truck className="w-10 h-10 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">Detalhamento de Frete</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
          Visualize as tarifas de frete por base de carregamento e cidade de destino. Ajuste os filtros para comparar custos por tipo de veículo sem utilizar uma planilha.
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-6">
      <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Truck className="w-5 h-5 text-orange-600" />
            Filtros e Configurações
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cidades de destino</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between bg-background md:w-[260px]"
                  >
                    <span className="truncate text-left">
                      {includeAllDestinations
                        ? 'Todas as cidades'
                        : selectedDestinations.length > 0
                          ? `${selectedDestinations.length} cidade(s) selecionada(s)`
                          : 'Selecione as cidades'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-4" align="start" sideOffset={6}>
                  <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      value={destinationSearch}
                      onChange={(event) => setDestinationSearch(event.target.value)}
                    />
                  </div>
                  <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
                    <label
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        includeAllDestinations ? 'bg-primary/10' : 'hover:bg-muted'
                      }`}
                    >
                      <Checkbox
                        checked={includeAllDestinations}
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            setIncludeAllDestinations(true);
                            setSelectedDestinations([]);
                          } else {
                            setIncludeAllDestinations(false);
                          }
                        }}
                      />
                      <span className="flex-1 text-left">Selecionar todas</span>
                    </label>
                    <div className="border-t border-muted/50 pt-2 space-y-1">
                      {filteredDestinationOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma cidade encontrada.</p>
                      ) : (
                        filteredDestinationOptions.map((city) => {
                          const isSelected = selectedDestinations.includes(city.id);
                          return (
                            <label
                              key={city.id}
                              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                              !includeAllDestinations && isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                            } ${includeAllDestinations ? 'opacity-60' : ''}`}
                            >
                              <Checkbox
                                checked={includeAllDestinations ? true : isSelected}
                                disabled={includeAllDestinations}
                                onCheckedChange={(checked) => {
                                  setIncludeAllDestinations(false);
                                  handleDestinationToggle(city.id, checked === true);
                                }}
                              />
                              <span className="flex-1 text-left">{city.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bases de origem</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between bg-background md:w-[220px]"
                  >
                    <span className="truncate text-left">
                      {includeAllBases
                        ? 'Todas as bases'
                        : selectedBaseIds.length > 0
                          ? `${selectedBaseIds.length} base(s) selecionada(s)`
                          : 'Selecione as bases'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-4" align="start" sideOffset={6}>
                  <div className="mt-1 max-h-60 overflow-y-auto space-y-1">
                    <label
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        includeAllBases ? 'bg-primary/10' : 'hover:bg-muted'
                      }`}
                    >
                      <Checkbox
                        checked={includeAllBases}
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            setIncludeAllBases(true);
                            setSelectedBaseIds([]);
                          } else {
                            setIncludeAllBases(false);
                          }
                        }}
                      />
                      <span className="flex-1 text-left">Selecionar todas</span>
                    </label>
                    <div className="border-t border-muted/50 pt-2 space-y-1">
                      {baseOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma base encontrada.</p>
                      ) : (
                        baseOptions.map((base) => {
                          const isSelected = selectedBaseIds.includes(base.id);
                          return (
                            <label
                              key={base.id}
                              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                                !includeAllBases && isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                              } ${includeAllBases ? 'opacity-60' : ''}`}
                            >
                              <Checkbox
                                checked={includeAllBases ? true : isSelected}
                                disabled={includeAllBases}
                                onCheckedChange={(checked) => {
                                  setIncludeAllBases(false);
                                  handleBaseToggle(base.id, checked === true);
                                }}
                              />
                              <span className="flex-1 text-left">{base.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo de veículo</p>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger className="bg-background md:w-[180px]">
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleOptions.map(([key, vehicle]) => (
                    <SelectItem key={key} value={key}>
                      {vehicle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:ml-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</p>
              <div className="flex justify-start md:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full md:w-auto justify-center md:justify-start"
                  onClick={() => {
                    setSelectedDestinations([]);
                    setIncludeAllDestinations(true);
                    setSelectedBaseIds([]);
                    setIncludeAllBases(true);
                    if (vehicleOptions.length) {
                      setSelectedVehicle(vehicleOptions[0][0]);
                    }
                  }}
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Limpar filtros
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-left md:text-right">
                {totalRoutes > 0
                  ? `${totalRoutes} rota${totalRoutes === 1 ? '' : 's'} encontradas`
                  : 'Nenhuma rota corresponde aos filtros'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleExportPdf}
          disabled={exportingPdf || !totalRoutes}
        >
          <FileDown className="w-4 h-4 mr-2" />
          {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
        </Button>
        <Button
          onClick={handleExportExcel}
          disabled={exportingExcel || !totalRoutes}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          {exportingExcel ? 'Gerando XLSX...' : 'Exportar XLSX'}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Menor tarifa" value={summaryStats.min} icon={TrendingUp} />
        <SummaryStat label="Maior tarifa" value={summaryStats.max} icon={TrendingUp} />
        <SummaryStat label="Tarifa média" value={summaryStats.average} icon={TrendingUp} />
        <SummaryStat label="Total de rotas" value={summaryStats.count} icon={Truck} />
      </div>

      {distanceCostMetrics && (
        <Card className="bg-card/80 border border-muted/40">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Distância x tarifa</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Correlação de Pearson entre distância informada e tarifa:{' '}
                <span className="font-semibold text-foreground">
                  r = {distanceCostMetrics.r.toFixed(2)}
                </span>{' '}
                ({distanceCostMetrics.strength} {distanceCostMetrics.direction}) em{' '}
                {distanceCostMetrics.points} rota(s).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <AnimatePresence mode="popLayout">
        {hasRoutes ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {filteredRoutesByBase.map((entry) => (
              <FreightRouteCard
                key={entry.baseCityName}
                baseCityName={entry.baseCityName}
                routes={entry.routes}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma rota disponível"
            description="Ajuste os filtros ou cadastre novas rotas na área de Configurações para visualizar os custos de frete."
          />
        )}
      </AnimatePresence>

      {expensiveDestinations.length > 0 && (
        <Card className="border border-muted/40 bg-card/80">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Cidades com frete mais caro (R$/L/km)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Compara quanto custa, em média, levar 1 litro por quilômetro (R$/L/km)
                  para cada cidade de destino. Quanto maior o valor, mais caro é o frete
                  daquela cidade considerando a distância percorrida.
                </p>
              </div>
              {vehicleOptions.length > 0 && (
                <div className="space-y-2 w-full md:w-72">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Veículo para este gráfico</p>
                    <Select value={expensiveVehicleKey} onValueChange={setExpensiveVehicleKey}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todos os veículos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os veículos (média)</SelectItem>
                        {vehicleOptions.map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            {value.name || key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Base para este gráfico</p>
                    <Select value={expensiveBaseId} onValueChange={setExpensiveBaseId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todas as bases" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as bases</SelectItem>
                        {baseOptions.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={expensiveDestinations}
                layout="vertical"
                margin={{ top: 5, right: 24, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis
                  type="number"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(value) => formatCurrency(value ?? 0)}
                />
                <YAxis
                  dataKey="destinationName"
                  type="category"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  width={140}
                />
                <Tooltip content={<ExpensiveFreightTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.06)' }} />
                <Bar dataKey="worstPerLiter" fill="#ef4444" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {(vehicleComparison || missingRoutes.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {vehicleComparison && (
            <Card className="bg-card/80 border border-muted/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  Comparação entre tipos de veículo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Menor custo médio:{' '}
                  <span className="font-semibold">{vehicleComparison.best.name}</span>{' '}
                  ({formatCurrency(vehicleComparison.best.avgCost)}/L) em{' '}
                  {vehicleComparison.best.routeCount} rota(s).
                </p>
                {vehicleComparison.spread > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Diferença média para o veículo mais caro:{' '}
                    <span className="font-mono">
                      {formatCurrency(vehicleComparison.spread)}
                      /L
                    </span>
                  </p>
                )}
                <div className="mt-2 max-h-40 overflow-y-auto border border-muted/40 rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-muted-foreground">Veículo</th>
                        <th className="px-2 py-1 text-right font-medium text-muted-foreground">Média (R$/L)</th>
                        <th className="px-2 py-1 text-right font-medium text-muted-foreground">Rotas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicleComparison.entries.map((entry) => (
                        <tr key={entry.key} className="border-t border-muted/30">
                          <td className="px-2 py-1 whitespace-nowrap">{entry.name}</td>
                          <td className="px-2 py-1 text-right font-mono">
                            {formatCurrency(entry.avgCost)}
                          </td>
                          <td className="px-2 py-1 text-right">{entry.routeCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/80 border border-muted/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Rotas de frete faltantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {missingRoutes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Não foram identificadas rotas faltantes para os filtros atuais.
                </p>
              ) : (
                <>
                  <p>
                    Combinações base → destino sem rota cadastrada:{' '}
                    <span className="font-semibold">{missingRoutes.length}</span>
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-muted/40 rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-muted-foreground">Base</th>
                          <th className="px-2 py-1 text-left font-medium text-muted-foreground">Destino</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingRoutes.map((row, index) => (
                          <tr
                            key={`${row.baseName}-${row.destinationName}-${index}`}
                            className="border-t border-muted/30"
                          >
                            <td className="px-2 py-1 whitespace-nowrap">{row.baseName}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{row.destinationName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border border-primary/30 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
            Comparação Frete x Piso ANTT (R$/L)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Avalie, por base e destino, como a tarifa atual se posiciona em relação ao piso mínimo
            da ANTT para granel líquido.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {anttLoading && (
            <p className="text-sm text-muted-foreground">Carregando tabela ANTT...</p>
          )}
          {anttError && (
            <p className="text-sm text-destructive">
              Não foi possível carregar a tabela ANTT. Os valores de piso não serão exibidos.
            </p>
          )}
          {!rowsWithAntt.length && !loading && (
            <p className="text-sm text-muted-foreground">
              Nenhuma rota encontrada para os filtros atuais.
            </p>
          )}
          {rowsWithAntt.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-muted/40">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Base</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Destino</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Veículo</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Tarifa (R$/L)
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Piso ANTT (R$/L)
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Diferença (R$/L)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rowsWithAntt.map((row, index) => {
                    const hasAntt =
                      row.anttFreightPerLiter != null && Number.isFinite(row.anttFreightPerLiter);
                    const diff = hasAntt ? row.anttDiffPerLiter : null;
                    const isAbove = hasAntt && diff > 0;
                    const isBelow = hasAntt && diff < 0;

                    return (
                      <tr
                        key={`${row.baseCity}-${row.destination}-${row.vehicle}-${index}`}
                        className="border-t border-muted/40"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">{row.baseCity}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.destination}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.vehicle}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(row.costPerLiter)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {hasAntt ? formatCurrency(row.anttFreightPerLiter) : '—'}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono ${
                            isAbove
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isBelow
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {hasAntt ? formatCurrency(diff) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </motion.div>
  );
};

export default FreightDetail;
