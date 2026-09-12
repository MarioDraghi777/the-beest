/**
 * Server di sviluppo per provare dal telefono: https autofirmato + rete locale.
 *
 *   npm run dev:phone
 *
 * Stampa l'indirizzo da aprire sull'iPhone. Safari dirà che il certificato non
 * è attendibile: si sceglie "Mostra dettagli" e poi "Visita il sito", una volta
 * sola. Senza https, iOS non concede Web Share, appunti, Wake Lock né
 * l'installazione sulla schermata Home.
 */
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);

console.log('\nIndirizzi disponibili su questa rete:');
for (const a of addresses) console.log(`   https://${a}:5173`);
console.log('\nApri quello della tua Wi-Fi sull\'iPhone (di solito 192.168.x.x).\n');

spawn('npx', ['vite', '--host'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, HTTPS_DEV: '1' },
});
