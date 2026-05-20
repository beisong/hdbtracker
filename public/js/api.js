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

  async getAreaOverview(town, flatType = 'ALL', street = null) {
    const params = new URLSearchParams({ town, flat_type: flatType });
    if (street) params.set('street', street);
    const resp = await fetch(`${this.baseUrl}/api/area-overview?${params}`);
    if (!resp.ok) throw new Error('Failed to get area overview');
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
};
