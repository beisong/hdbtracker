/**
 * WorthOrNot — API Client
 */

const API = {
  baseUrl: '',

  async getStatus() {
    const resp = await fetch(`${this.baseUrl}/api/status`);
    if (!resp.ok) throw new Error('Failed to get status');
    return resp.json();
  },

  async getTowns() {
    const resp = await fetch(`${this.baseUrl}/api/towns`);
    if (!resp.ok) throw new Error('Failed to fetch towns');
    return resp.json();
  },

  async resolve(query) {
    const resp = await fetch(`${this.baseUrl}/api/resolve?q=${encodeURIComponent(query)}`);
    if (!resp.ok) throw new Error('Failed to resolve');
    return resp.json();
  },

  async getAreaOverview(town, flatType = 'ALL', street = null, streets = null) {
    const params = new URLSearchParams({ town, flat_type: flatType });
    if (streets) params.set('streets', streets);
    else if (street) params.set('street', street);
    const resp = await fetch(`${this.baseUrl}/api/area-overview?${params}`);
    if (!resp.ok) throw new Error('Failed to get area overview');
    return resp.json();
  },

  async getNearbyStreets(lat, lng, town) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), town });
    const resp = await fetch(`${this.baseUrl}/api/nearby-streets?${params}`);
    if (!resp.ok) throw new Error('Failed to get nearby streets');
    return resp.json();
  },

  async geocodeAddresses(addresses) {
    const resp = await fetch(`${this.baseUrl}/api/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses }),
    });
    if (!resp.ok) throw new Error('Failed to geocode addresses');
    return resp.json();
  },

  // Private property endpoints
  async searchPrivateProjects(query, limit = 10) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const resp = await fetch(`${this.baseUrl}/api/private/projects?${params}`);
    if (!resp.ok) throw new Error('Failed to search projects');
    return resp.json();
  },

  async getNearbyHDB(lat, lng) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    const resp = await fetch(`${this.baseUrl}/api/nearby-hdb?${params}`);
    if (!resp.ok) throw new Error('Failed to fetch nearby HDB');
    return resp.json();
  },

  async getPrivateProjectOverview(project, propertyType = null) {
    const params = new URLSearchParams({ project });
    if (propertyType) params.set('property_type', propertyType);
    const resp = await fetch(`${this.baseUrl}/api/private/project-overview?${params}`);
    if (!resp.ok) throw new Error('Failed to get project overview');
    return resp.json();
  },

  async getPrivatePropertyTypes() {
    const resp = await fetch(`${this.baseUrl}/api/private/property-types`);
    if (!resp.ok) throw new Error('Failed to fetch property types');
    return resp.json();
  },

  // District summary for HDB town pages
  async getDistrictSummary(districts) {
    const params = new URLSearchParams({ districts: districts.join(',') });
    const resp = await fetch(`${this.baseUrl}/api/private/district-summary?${params}`);
    if (!resp.ok) throw new Error('Failed to get district summary');
    return resp.json();
  },

  // Full district overview for district search
  async getDistrictOverview(district) {
    const params = new URLSearchParams({ district });
    const resp = await fetch(`${this.baseUrl}/api/private/district-overview?${params}`);
    if (!resp.ok) throw new Error('Failed to get district overview');
    return resp.json();
  },
};
