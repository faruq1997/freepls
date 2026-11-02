#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const server = spawn('node', [path.join(__dirname, 'index.js')], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

// Sample data: 3 variabel, 15 responden, skala Likert 1-5
const DATA = Array.from({ length: 15 }, (_, i) => ({
  X1: (i % 5) + 1, X2: ((i + 1) % 5) + 1, X3: ((i + 2) % 5) + 1,
  M1: ((i + 1) % 5) + 1, M2: ((i + 2) % 5) + 1,
  Y1: ((i + 2) % 5) + 1, Y2: ((i + 3) % 5) + 1, Y3: ((i + 4) % 5) + 1,
}));

const VARIABELS = [
  { nama: 'X', indikator: ['X1', 'X2', 'X3'], tipe: 'reflektif' },
  { nama: 'M', indikator: ['M1', 'M2'],        tipe: 'reflektif' },
  { nama: 'Y', indikator: ['Y1', 'Y2', 'Y3'], tipe: 'reflektif' },
];
const JALURS = [{ dari: 'X', ke: 'Y' }, { dari: 'M', ke: 'Y' }];

const messages = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0.1' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
  { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  { jsonrpc: '2.0', id: 3, method: 'resources/list', params: {} },
  {
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'pls_run_analysis', arguments: { data: DATA, variabels: VARIABELS, jalurs: JALURS } },
  },
  {
    jsonrpc: '2.0', id: 5, method: 'tools/call',
    params: { name: 'pls_list_projects', arguments: {} },
  },
];

let buf = '';
let plsResult = null;
const globalTimeout = setTimeout(() => {
  console.error('\nTimeout – tidak ada respons dari server');
  server.kill();
  process.exit(1);
}, 20000);

server.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.error) { console.error('Error:', obj.error); server.kill(); process.exit(1); }

      if (obj.id === 2) {
        console.log('\n=== Tools ===');
        obj.result.tools.forEach((t) => console.log(' •', t.name));

      } else if (obj.id === 3) {
        console.log('\n=== Resources ===');
        obj.result.resources.forEach((r) => console.log(' •', r.uri, '–', r.name));

      } else if (obj.id === 4) {
        plsResult = JSON.parse(obj.result.content[0].text);
        console.log('\n=== PLS Analysis ===');
        console.log('Path Coefficients:', plsResult.pathCoefficients);
        console.log('R²:', plsResult.rSquared);
        console.log('Converged:', plsResult.converged);

        // Now test pls_interpret_results with the live result
        server.stdin.write(JSON.stringify({
          jsonrpc: '2.0', id: 6, method: 'tools/call',
          params: { name: 'pls_interpret_results', arguments: { hasil: plsResult } },
        }) + '\n');

      } else if (obj.id === 5) {
        const projects = JSON.parse(obj.result.content[0].text);
        console.log('\n=== Saved Projects ===');
        if (projects.length === 0) {
          console.log('  (tidak ada proyek tersimpan — normal jika aplikasi belum dipakai)');
        } else {
          projects.forEach((p) => console.log(` • [${p.id}] ${p.nama}`));
        }

      } else if (obj.id === 6) {
        const { interpretasi } = JSON.parse(obj.result.content[0].text);
        console.log('\n=== Interpretasi ===');
        console.log(interpretasi.slice(0, 600) + '...');
        console.log('\n✅ Semua test lulus');
        clearTimeout(globalTimeout);
        server.kill();
        process.exit(0);
      }
    } catch {}
  }
});

messages.forEach((msg, i) => setTimeout(() => server.stdin.write(JSON.stringify(msg) + '\n'), i * 80));
