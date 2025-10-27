
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
    etanol: { name: "Etanol" },
    gasolina_comum: { name: "Gasolina Comum" },
    diesel_s10: { name: "Diesel S10" },
  },
  defaultDestinationPostoId: null,
};
