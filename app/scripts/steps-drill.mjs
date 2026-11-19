export default async (p) => { await p.locator('main button:has(kbd)').first().click(); };
