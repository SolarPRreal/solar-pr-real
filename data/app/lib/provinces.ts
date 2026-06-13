export type ProvinceName =
  | "A Coruña"
  | "Álava"
  | "Albacete"
  | "Alicante"
  | "Almería"
  | "Asturias"
  | "Ávila"
  | "Badajoz"
  | "Barcelona"
  | "Burgos"
  | "Cáceres"
  | "Cádiz"
  | "Cantabria"
  | "Castellón"
  | "Ceuta"
  | "Ciudad Real"
  | "Córdoba"
  | "Cuenca"
  | "Girona"
  | "Granada"
  | "Guadalajara"
  | "Guipúzcoa"
  | "Huelva"
  | "Huesca"
  | "Illes Balears"
  | "Jaén"
  | "La Rioja"
  | "Las Palmas"
  | "León"
  | "Lleida"
  | "Lugo"
  | "Madrid"
  | "Málaga"
  | "Melilla"
  | "Murcia"
  | "Navarra"
  | "Ourense"
  | "Palencia"
  | "Pontevedra"
  | "Salamanca"
  | "Santa Cruz de Tenerife"
  | "Segovia"
  | "Sevilla"
  | "Soria"
  | "Tarragona"
  | "Teruel"
  | "Toledo"
  | "Valencia"
  | "Valladolid"
  | "Vizcaya"
  | "Zamora"
  | "Zaragoza";

export const SPAIN_PROVINCES: ProvinceName[] = [
  "A Coruña",
  "Álava",
  "Albacete",
  "Alicante",
  "Almería",
  "Asturias",
  "Ávila",
  "Badajoz",
  "Barcelona",
  "Burgos",
  "Cáceres",
  "Cádiz",
  "Cantabria",
  "Castellón",
  "Ceuta",
  "Ciudad Real",
  "Córdoba",
  "Cuenca",
  "Girona",
  "Granada",
  "Guadalajara",
  "Guipúzcoa",
  "Huelva",
  "Huesca",
  "Illes Balears",
  "Jaén",
  "La Rioja",
  "Las Palmas",
  "León",
  "Lleida",
  "Lugo",
  "Madrid",
  "Málaga",
  "Melilla",
  "Murcia",
  "Navarra",
  "Ourense",
  "Palencia",
  "Pontevedra",
  "Salamanca",
  "Santa Cruz de Tenerife",
  "Segovia",
  "Sevilla",
  "Soria",
  "Tarragona",
  "Teruel",
  "Toledo",
  "Valencia",
  "Valladolid",
  "Vizcaya",
  "Zamora",
  "Zaragoza",
];

export type StationOption = {
  id: string;
  name: string;
  province: string;
  zoneAvgPR: number;
};

type SeedStation = {
  name: string;
  zoneAvgPR: number;
};

const SEEDED_STATIONS: Record<ProvinceName, SeedStation[]> = {
  "A Coruña": [
    { name: "A Coruña-Centro", zoneAvgPR: 81 },
    { name: "Santiago de Compostela", zoneAvgPR: 80 },
  ],
  "Álava": [
    { name: "Vitoria-Gasteiz", zoneAvgPR: 82 },
    { name: "Laguardia", zoneAvgPR: 83 },
  ],
  Albacete: [
    { name: "Albacete-Centro", zoneAvgPR: 87 },
    { name: "Almansa", zoneAvgPR: 86 },
  ],
  Alicante: [
    { name: "Alicante", zoneAvgPR: 87 },
    { name: "Elche", zoneAvgPR: 86 },
  ],
  Almería: [
    { name: "Almería-Centro", zoneAvgPR: 91 },
    { name: "Níjar", zoneAvgPR: 92 },
  ],
  Asturias: [
    { name: "Oviedo", zoneAvgPR: 79 },
    { name: "Gijón", zoneAvgPR: 78 },
  ],
  "Ávila": [
    { name: "Ávila-Centro", zoneAvgPR: 84 },
    { name: "Arévalo", zoneAvgPR: 85 },
  ],
  Badajoz: [
    { name: "Badajoz", zoneAvgPR: 90 },
    { name: "Mérida", zoneAvgPR: 89 },
  ],
  Barcelona: [
    { name: "Barcelona", zoneAvgPR: 84 },
    { name: "Sabadell", zoneAvgPR: 83 },
  ],
  Burgos: [
    { name: "Burgos-Centro", zoneAvgPR: 82 },
    { name: "Miranda de Ebro", zoneAvgPR: 83 },
  ],
  "Cáceres": [
    { name: "Cáceres-Centro", zoneAvgPR: 89 },
    { name: "Plasencia", zoneAvgPR: 88 },
  ],
  "Cádiz": [
    { name: "Cádiz-Centro", zoneAvgPR: 88 },
    { name: "Jerez de la Frontera", zoneAvgPR: 89 },
  ],
  Cantabria: [
    { name: "Santander", zoneAvgPR: 78 },
    { name: "Torrelavega", zoneAvgPR: 79 },
  ],
  Castellón: [
    { name: "Castellón de la Plana", zoneAvgPR: 86 },
    { name: "Vila-real", zoneAvgPR: 85 },
  ],
  Ceuta: [
    { name: "Ceuta-Centro", zoneAvgPR: 87 },
    { name: "Monte Hacho", zoneAvgPR: 86 },
  ],
  "Ciudad Real": [
    { name: "Ciudad Real-Centro", zoneAvgPR: 89 },
    { name: "Puertollano", zoneAvgPR: 90 },
  ],
  "Córdoba": [
    { name: "Córdoba-Centro", zoneAvgPR: 91 },
    { name: "Lucena", zoneAvgPR: 90 },
  ],
  Cuenca: [
    { name: "Cuenca-Centro", zoneAvgPR: 86 },
    { name: "Tarancón", zoneAvgPR: 87 },
  ],
  Girona: [
    { name: "Girona-Centro", zoneAvgPR: 83 },
    { name: "Figueres", zoneAvgPR: 84 },
  ],
  Granada: [
    { name: "Granada-Centro", zoneAvgPR: 89 },
    { name: "Motril", zoneAvgPR: 90 },
  ],
  Guadalajara: [
    { name: "Guadalajara-Centro", zoneAvgPR: 86 },
    { name: "Molina de Aragón", zoneAvgPR: 85 },
  ],
  "Guipúzcoa": [
    { name: "Donostia-San Sebastián", zoneAvgPR: 78 },
    { name: "Eibar", zoneAvgPR: 79 },
  ],
  Huelva: [
    { name: "Huelva-Centro", zoneAvgPR: 90 },
    { name: "Lepe", zoneAvgPR: 89 },
  ],
  Huesca: [
    { name: "Huesca-Centro", zoneAvgPR: 84 },
    { name: "Barbastro", zoneAvgPR: 85 },
  ],
  "Illes Balears": [
    { name: "Palma", zoneAvgPR: 86 },
    { name: "Manacor", zoneAvgPR: 85 },
  ],
  Jaén: [
    { name: "Jaén-Centro", zoneAvgPR: 91 },
    { name: "Linares", zoneAvgPR: 90 },
  ],
  "La Rioja": [
    { name: "Logroño", zoneAvgPR: 84 },
    { name: "Calahorra", zoneAvgPR: 85 },
  ],
  "Las Palmas": [
    { name: "Las Palmas de Gran Canaria", zoneAvgPR: 88 },
    { name: "Telde", zoneAvgPR: 87 },
  ],
  León: [
    { name: "León-Centro", zoneAvgPR: 82 },
    { name: "Ponferrada", zoneAvgPR: 83 },
  ],
  Lleida: [
    { name: "Lleida-Centro", zoneAvgPR: 86 },
    { name: "La Seu d'Urgell", zoneAvgPR: 84 },
  ],
  Lugo: [
    { name: "Lugo-Centro", zoneAvgPR: 80 },
    { name: "Monforte de Lemos", zoneAvgPR: 81 },
  ],
  Madrid: [
    { name: "Madrid-Retiro", zoneAvgPR: 88 },
    { name: "Getafe", zoneAvgPR: 87 },
    { name: "Alcalá de Henares", zoneAvgPR: 86 },
  ],
  Málaga: [
    { name: "Málaga", zoneAvgPR: 89 },
    { name: "Antequera", zoneAvgPR: 88 },
  ],
  Melilla: [
    { name: "Melilla-Centro", zoneAvgPR: 87 },
    { name: "Aeropuerto de Melilla", zoneAvgPR: 86 },
  ],
  Murcia: [
    { name: "Murcia", zoneAvgPR: 89 },
    { name: "Cartagena", zoneAvgPR: 87 },
  ],
  Navarra: [
    { name: "Pamplona", zoneAvgPR: 83 },
    { name: "Tudela", zoneAvgPR: 85 },
  ],
  Ourense: [
    { name: "Ourense-Centro", zoneAvgPR: 81 },
    { name: "Verín", zoneAvgPR: 82 },
  ],
  Palencia: [
    { name: "Palencia-Centro", zoneAvgPR: 83 },
    { name: "Aguilar de Campoo", zoneAvgPR: 82 },
  ],
  Pontevedra: [
    { name: "Pontevedra-Centro", zoneAvgPR: 80 },
    { name: "Vigo", zoneAvgPR: 81 },
  ],
  Salamanca: [
    { name: "Salamanca-Centro", zoneAvgPR: 85 },
    { name: "Ciudad Rodrigo", zoneAvgPR: 86 },
  ],
  "Santa Cruz de Tenerife": [
    { name: "Santa Cruz de Tenerife", zoneAvgPR: 87 },
    { name: "La Laguna", zoneAvgPR: 86 },
  ],
  Segovia: [
    { name: "Segovia-Centro", zoneAvgPR: 84 },
    { name: "Cuéllar", zoneAvgPR: 85 },
  ],
  Sevilla: [
    { name: "Sevilla-Aeropuerto", zoneAvgPR: 90 },
    { name: "Écija", zoneAvgPR: 89 },
  ],
  Soria: [
    { name: "Soria-Centro", zoneAvgPR: 83 },
    { name: "Almazán", zoneAvgPR: 84 },
  ],
  Tarragona: [
    { name: "Tarragona-Centro", zoneAvgPR: 85 },
    { name: "Reus", zoneAvgPR: 86 },
  ],
  Teruel: [
    { name: "Teruel-Centro", zoneAvgPR: 85 },
    { name: "Alcañiz", zoneAvgPR: 86 },
  ],
  Toledo: [
    { name: "Toledo", zoneAvgPR: 89 },
    { name: "Talavera de la Reina", zoneAvgPR: 88 },
  ],
  Valencia: [
    { name: "València", zoneAvgPR: 87 },
    { name: "Manises", zoneAvgPR: 86 },
  ],
  Valladolid: [
    { name: "Valladolid-Centro", zoneAvgPR: 84 },
    { name: "Medina del Campo", zoneAvgPR: 85 },
  ],
  Vizcaya: [
    { name: "Bilbao", zoneAvgPR: 79 },
    { name: "Durango", zoneAvgPR: 80 },
  ],
  Zamora: [
    { name: "Zamora-Centro", zoneAvgPR: 84 },
    { name: "Benavente", zoneAvgPR: 85 },
  ],
  Zaragoza: [
    { name: "Zaragoza-Aeropuerto", zoneAvgPR: 89 },
    { name: "Calatayud", zoneAvgPR: 87 },
  ],
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function getStationsByProvince(province: string): StationOption[] {
  const provinceKey = province as ProvinceName;
  const rows = SEEDED_STATIONS[provinceKey] || [];

  return rows.map((row, index) => ({
    id: `${slugify(province)}-${index + 1}`,
    name: row.name,
    province,
    zoneAvgPR: row.zoneAvgPR,
  }));
}