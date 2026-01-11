
export const defaultSettings = {
  postos: [],
  freightRoutes: [],
  locations: [],
  brands: [],
  vehicleTypes: {
    truck: { name: "Truck", volume: 15000 },
    carreta: { name: "Carreta", volume: 30000 },
    bitrem: { name: "Bitrem", volume: 45000 },
    rodotrem: { name: "Rodotrem", volume: 60000 },
    vanderleia: { name: "Vanderleia", volume: 40000 },
  },
  fuelTypes: {
    gasolina_comum: { name: "Gasolina Comum" },
    gasolina_aditivada: { name: "Gasolina Aditivada" },
    etanol: { name: "Etanol" },
    etanol_aditivado: { name: "Etanol Aditivado" },
    diesel_s10: { name: "Diesel S10"},
    diesel_s10_aditivado: { name: "Diesel S10 Aditivado" },
    diesel_s500: { name: "Diesel S500" },
  },
  defaultDestinationPostoId: null,
};
