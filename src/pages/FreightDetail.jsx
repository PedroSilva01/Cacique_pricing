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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { defaultSettings } from '@/lib/mockData';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
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

  const [loading, setLoading] = useState(true);
  const [baseCities, setBaseCities] = useState([]);
  const [cities, setCities] = useState([]);
  const [freightRoutes, setFreightRoutes] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [selectedDestination, setSelectedDestination] = useState('all');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [settingsRes, baseCitiesRes, citiesRes, routesRes] = await Promise.all([
        supabase.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
        supabase.from('base_cities').select('*').eq('user_id', user.id).order('name'),
        supabase.from('cities').select('*').eq('user_id', user.id).order('name'),
        supabase
          .from('freight_routes')
          .select('*, origin:base_cities!origin_city_id(id, name), destination:cities!destination_city_id(id, name)')
          .eq('user_id', user.id),
      ]);

      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;
      if (baseCitiesRes.error) throw baseCitiesRes.error;
      if (citiesRes.error) throw citiesRes.error;
      if (routesRes.error) throw routesRes.error;

      const loadedSettings = settingsRes.data?.settings || defaultSettings;
      setSettings(loadedSettings);
      setBaseCities(baseCitiesRes.data || []);
      setCities(citiesRes.data || []);
      setFreightRoutes(routesRes.data || []);

      const vehicleKeys = Object.keys(loadedSettings.vehicleTypes || {});
      if (vehicleKeys.length > 0) {
        setSelectedVehicle((prev) => prev || vehicleKeys[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de frete', err);
      toast({
        title: 'Erro ao carregar dados',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const vehicleOptions = useMemo(() => Object.entries(settings.vehicleTypes || {}), [settings.vehicleTypes]);

  const destinationsOptions = useMemo(
    () => [
      { id: 'all', name: 'Todas as cidades' },
      ...cities.map((city) => ({ id: city.id, name: city.name })),
    ],
    [cities],
  );

  const filteredRoutesByBase = useMemo(() => {
    if (!freightRoutes.length || !selectedVehicle) return [];

    const grouped = new Map();

    freightRoutes.forEach((route) => {
      if (!route.origin) return;
      if (selectedDestination !== 'all' && route.destination_city_id !== selectedDestination) return;

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
  }, [freightRoutes, selectedDestination, selectedVehicle, settings.vehicleTypes]);

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
        })),
      ),
    [filteredRoutesByBase],
  );

  const totalRoutes = preparedRows.length;

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

  const selectedDestinationLabel = useMemo(() => {
    if (selectedDestination === 'all') return 'Todas as cidades';
    return destinationsOptions.find((c) => c.id === selectedDestination)?.name || 'Cidade desconhecida';
  }, [selectedDestination, destinationsOptions]);

  const selectedVehicleLabel = useMemo(() => {
    if (!selectedVehicle) return '—';
    return settings.vehicleTypes?.[selectedVehicle]?.name || selectedVehicle;
  }, [selectedVehicle, settings.vehicleTypes]);

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
      doc.text(`Destino: ${selectedDestinationLabel}`, 14, 24);
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
  }, [preparedRows, selectedDestinationLabel, selectedVehicleLabel, toast, totalRoutes]);

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
      sheet.addRow([`Destino: ${selectedDestinationLabel}`]);
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
  }, [preparedRows, selectedDestinationLabel, selectedVehicleLabel, toast, totalRoutes]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const hasRoutes = filteredRoutesByBase.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Detalhamento de Frete</h1>
        <p className="text-muted-foreground max-w-3xl">
          Visualize as tarifas de frete por base de carregamento e cidade de destino. Ajuste os filtros para comparar custos por tipo de veículo sem utilizar uma planilha.
        </p>
      </header>

      <Card className="border border-muted/40 bg-card/80">
        <CardContent className="grid gap-4 py-6 md:grid-cols-4">
          <div className="md:col-span-2 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cidade de destino</p>
            <Select value={selectedDestination} onValueChange={setSelectedDestination}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione a cidade" />
              </SelectTrigger>
              <SelectContent>
                {destinationsOptions.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo de veículo</p>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="bg-background">
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

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</p>
            <div className="flex justify-start md:justify-end">
              <Button
                variant="outline"
                className="w-full md:w-auto justify-center md:justify-start"
                onClick={() => {
                  setSelectedDestination('all');
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

      <AnimatePresence mode="popLayout">
        {hasRoutes ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {filteredRoutesByBase.map((entry) => (
              <FreightRouteCard key={entry.baseCityName} baseCityName={entry.baseCityName} routes={entry.routes} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma rota disponível"
            description="Ajuste os filtros ou cadastre novas rotas na área de Configurações para visualizar os custos de frete."
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FreightDetail;
