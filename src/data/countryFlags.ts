/** Local flag asset name for a country. Assets are downloaded by tools/download-flags.mjs. */
export function flagFileName(countryName: string): string {
  return `${countryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.png`;
}
