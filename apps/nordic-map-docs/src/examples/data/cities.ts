import type { MapPin } from "@jielga/nordic-map";

export type City = {
  /** Inhabitants, from the OpenStreetMap `population` tag */
  population: number;
};

/** Swedish cities, used as pins in the demos. The larger the city, the higher its priority. */
export const cities: MapPin<City>[] = [
  { id: "kiruna", label: "Kiruna", lat: 67.8558, lon: 20.2253, data: { population: 17513 } },
  { id: "lulea", label: "Luleå", lat: 65.5848, lon: 22.1547, data: { population: 73864 } },
  { id: "umea", label: "Umeå", lat: 63.8258, lon: 20.263, data: { population: 89607 } },
  { id: "ostersund", label: "Östersund", lat: 63.1792, lon: 14.6357, data: { population: 44000 } },
  { id: "sundsvall", label: "Sundsvall", lat: 62.3908, lon: 17.3069, data: { population: 57606 } },
  { id: "gavle", label: "Gävle", lat: 60.6749, lon: 17.1413, data: { population: 102904 } },
  { id: "falun", label: "Falun", lat: 60.6065, lon: 15.6355, data: { population: 39492 } },
  { id: "uppsala", label: "Uppsala", lat: 59.8586, lon: 17.6389, data: { population: 166698 } },
  { id: "vasteras", label: "Västerås", lat: 59.6099, lon: 16.5448, data: { population: 110877 } },
  { id: "stockholm", label: "Stockholm", lat: 59.3293, lon: 18.0686, data: { population: 984748 } },
  { id: "tyreso", label: "Tyresö", lat: 59.2441, lon: 18.229, data: { population: 39437 } },
  { id: "karlstad", label: "Karlstad", lat: 59.3793, lon: 13.5036, data: { population: 62797 } },
  { id: "orebro", label: "Örebro", lat: 59.2753, lon: 15.2134, data: { population: 98237 } },
  { id: "norrkoping", label: "Norrköping", lat: 58.5877, lon: 16.1924, data: { population: 98088 } },
  { id: "linkoping", label: "Linköping", lat: 58.4108, lon: 15.6214, data: { population: 116851 } },
  { id: "jonkoping", label: "Jönköping", lat: 57.7826, lon: 14.1618, data: { population: 84423 } },
  { id: "goteborg", label: "Göteborg", lat: 57.7089, lon: 11.9746, data: { population: 607882 } },
  { id: "boras", label: "Borås", lat: 57.721, lon: 12.9401, data: { population: 66273 } },
  { id: "visby", label: "Visby", lat: 57.6348, lon: 18.2948, data: { population: 22593 } },
  { id: "vaxjo", label: "Växjö", lat: 56.8777, lon: 14.8091, data: { population: 55600 } },
  { id: "kalmar", label: "Kalmar", lat: 56.6634, lon: 16.3568, data: { population: 35170 } },
  { id: "halmstad", label: "Halmstad", lat: 56.6745, lon: 12.8578, data: { population: 55688 } },
  { id: "helsingborg", label: "Helsingborg", lat: 56.0465, lon: 12.6945, data: { population: 93838 } },
  { id: "lund", label: "Lund", lat: 55.7047, lon: 13.191, data: { population: 82800 } },
  { id: "malmo", label: "Malmö", lat: 55.605, lon: 13.0038, data: { population: 316588 } },
].map((city) => {
  return { ...city, priority: city.data.population };
});
