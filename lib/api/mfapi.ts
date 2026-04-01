import axios from "axios";

const BASE = "https://api.mfapi.in";
const http = axios.create({ baseURL: BASE, timeout: 15000 });

export interface MfApiScheme {
  schemeCode: number;
  schemeName: string;
}

export interface MfApiNavData {
  meta: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
  };
  data: Array<{ date: string; nav: string }>;
  status: string;
}

/** Fetch all ~8000+ schemes list */
export async function fetchAllSchemes(): Promise<MfApiScheme[]> {
  const { data } = await http.get<MfApiScheme[]>("/mf");
  return data;
}

/** Fetch full NAV history for a scheme */
export async function fetchNavHistory(schemeCode: number): Promise<MfApiNavData> {
  const { data } = await http.get<MfApiNavData>(`/mf/${schemeCode}`);
  return data;
}

/** Fetch only latest NAV */
export async function fetchLatestNav(schemeCode: number): Promise<MfApiNavData> {
  const { data } = await http.get<MfApiNavData>(`/mf/${schemeCode}/latest`);
  return data;
}

/** Search schemes by name */
export async function searchSchemes(query: string): Promise<MfApiScheme[]> {
  const { data } = await http.get<MfApiScheme[]>(`/mf/search?q=${encodeURIComponent(query)}`);
  return data;
}
