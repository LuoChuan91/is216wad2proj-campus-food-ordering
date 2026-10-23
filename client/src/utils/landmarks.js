// Campus buildings shown on the map so students can tell where they are.
// The database's venues of type "building" are shown too; these are the other SMU buildings.
// Coordinates: OneMap (Singapore Land Authority) geocodes of each building's address.
// TODO add to database?
export const LANDMARKS = [
  { id: 'lm-connexion', name: 'SMU Connexion', short: 'Connexion', address: '40 Stamford Road', lat: 1.295584, lng: 103.849331, kind: 'building' },
  { id: 'lm-soa', name: 'School of Accountancy', short: 'SOA', address: '60 Stamford Road', lat: 1.295671, lng: 103.849924, kind: 'school' },
  { id: 'lm-soe', name: 'School of Economics / SCIS 2', short: 'SOE / SCIS 2', address: '90 Stamford Road', lat: 1.297925, lng: 103.848851, kind: 'school' },
  { id: 'lm-law', name: 'Yong Pung How School of Law', short: 'Law', address: '55 Armenian Street', lat: 1.295108, lng: 103.848922, kind: 'school' },
  { id: 'lm-admin', name: 'Administration Building', short: 'Admin Building', address: '81 Victoria Street', lat: 1.296847, lng: 103.852208, kind: 'building' },
  { id: 'lm-soss', name: 'School of Social Sciences / CIS', short: 'SOSS / CIS', address: '10 Canning Rise', lat: 1.294594, lng: 103.848557, kind: 'school' },
]

// A short name for a database venue on a small map label
export function shortName(name) {
  const known = { 'Li Ka Shing Library': 'LKS Library', 'School of Business': 'LKCSB', 'School of Computing': 'SCIS 1' }
  return known[name] || name
}
