#!/usr/bin/env node
/**
 * Submits every sitemap URL to IndexNow (Bing, Yandex, DuckDuckGo, Naver, Seznam)
 * after a frontend deploy. Run via: npm run deploy:frontend (called automatically).
 *
 * INDEXNOW_KEY must stay published at https://<HOST>/<INDEXNOW_KEY>.txt — IndexNow
 * re-validates it on every submission and returns 403 if the file goes missing.
 *
 * Never fails a deploy: any error is logged as a warning and the process exits 0.
 */
const INDEXNOW_KEY = 'a464a4c238872496dcaa8d33718f8e13';
const HOST = 'worthit.canlah.app';

async function main() {
  const resp = await fetch(`https://${HOST}/sitemap.xml`);
  if (!resp.ok) throw new Error(`sitemap fetch returned HTTP ${resp.status}`);

  const urlList = [...(await resp.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (urlList.length === 0) throw new Error('sitemap contained no URLs');

  const submit = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  });
  if (!submit.ok) {
    throw new Error(`IndexNow returned HTTP ${submit.status}: ${(await submit.text()).slice(0, 200)}`);
  }

  console.log(`indexnow: submitted ${urlList.length} URLs`);
}

main().catch(err => console.warn(`indexnow: skipped — ${err.message}`));
