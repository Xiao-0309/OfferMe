/** Actual renderer + preload + local mock HTTP provider. All windows stay hidden. */
const { app, BrowserWindow, ipcMain, session } = require('electron');
const { createServer } = require('node:http');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { SettingsStore, plainCipher } = require('../out/ui-test/settings.js');
const { importDocuments } = require('../out/ui-test/services/documents.js');
const { runInterview } = require('../out/ui-test/llm/interview.js');
const demo = require('./demo-data.cjs');
const root = resolve(__dirname, '..');
const profile = mkdtempSync(join(tmpdir(), 'offerme-public-ui-'));
const screenshots = process.argv.includes('--screenshots');
const snapshotDirectory = join(root, 'docs/assets');
app.setName('OfferMe UI test');
app.setPath('userData', profile);
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
let win, setup, server, data, forceError = false, slow = false, settings, calls = [];
const controllers = new Map();
const errors = [];
const pause = ms => new Promise(r => setTimeout(r, ms));
const js = async code => { try { return await win.webContents.executeJavaScript(code); } catch (error) { throw new Error(`Renderer command failed: ${code}\n${error.message}`); } };
async function until(code) { for (let i = 0; i < 150; i++) { if (await js(code)) return; await pause(60); } throw new Error('UI timeout: ' + code); }
async function click(text) {
  await js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) throw new Error('Unavailable button: ' + ${JSON.stringify(text)}); b.click(); })()`);
  await pause(80);
}
async function select(selector, value, type = 'HTMLInputElement') {
  await js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw new Error('Missing input'); Object.getOwnPropertyDescriptor(${type}.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await pause(80);
}
async function nav(title) { await js(`document.querySelector('.sidebar-nav [title=${JSON.stringify(title)}],.sidebar-bottom [title=${JSON.stringify(title)}]').click()`); await pause(100); }
const backdrop = "document.body.style.background='radial-gradient(ellipse at 8% 15%,#b4d4bf 0,transparent 52%),radial-gradient(ellipse at 92% 85%,#c7bfdc 0,transparent 50%),linear-gradient(135deg,#dce7df,#dce1ed)'";
async function shot(name, target = win) {
  if (!screenshots) return;
  const isDark = await target.webContents.executeJavaScript("document.documentElement.dataset.theme === 'dark'");
  await target.webContents.executeJavaScript(isDark ? "document.body.style.background='radial-gradient(ellipse at 15% 20%,#1d3f35 0,transparent 52%),radial-gradient(ellipse at 90% 80%,#292c48 0,transparent 50%),linear-gradient(135deg,#142923,#151c2c)'" : backdrop);
  await pause(180);
  mkdirSync(snapshotDirectory, { recursive: true });
  writeFileSync(join(snapshotDirectory, name + '-en.png'), (await target.webContents.capturePage()).toPNG());
}
function windowOptions(preload, width = 1400, height = 960) {
  return { show: false, frame: false, transparent: true, backgroundColor: '#00000000', width, height,
    webPreferences: { preload: join(root, 'out/preload', preload), contextIsolation: true, sandbox: true, backgroundThrottling: false } };
}
function watch(window) { window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); }); }
const timeout = setTimeout(() => { console.error('UI test timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  // Even if a future renderer change requests permissions or network, this demo cannot capture or phone home.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, reply) => reply(false));
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, reply) => {
    const url = new URL(details.url); reply({ cancel: !['127.0.0.1', 'localhost'].includes(url.hostname) });
  });
  server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body); calls.push(payload);
    const input = JSON.parse(payload.messages[1].content);
    const fail = forceError; if (slow) await pause(1400);
    res.setHeader('Content-Type', 'application/json');
    if (fail) { res.statusCode = 503; res.end(JSON.stringify({ error: 'Synthetic provider outage' })); return; }
    const content = input.candidateAnswer ? {
      summary: 'You explain the stages clearly. Make the evaluation protocol and the tradeoff decision more concrete.',
      strengths: ['Separates candidate coverage from ranking quality.', 'Connects the design to latency and evidence.'],
      improvements: ['Describe how relevance labels were created and held out.', 'Name the baseline and isolate the effect of each retrieval stage.'],
      nextQuestion: 'What would you do if recall improved but p95 latency exceeded the budget?',
    } : {
      title: 'Atlas Search — explain your design choices',
      summary: 'A synthetic practice set connecting retrieval fundamentals to the project in your resume.',
      questions: input.retrievedQuestions.map(q => ({
        bankQuestionId: q.id, adaptation: 'adapted', category: 'Project deep dive', question: q.question,
        projectLink: 'Connect this topic to the hybrid retrieval and evaluation pipeline in Atlas Search.',
        resumeEvidence: 'Built a document search prototype using BM25 and dense embeddings.',
        focus: 'Explain the mechanism, a credible alternative and how you would verify the choice.',
        knowledgePoints: ['Candidate retrieval and reranking optimize different stages of the pipeline.', 'Recall@K measures coverage; MRR and nDCG also reflect ranking quality.', 'Ablation studies isolate the value of each component under a fixed evaluation protocol.'],
        answerOutline: ['Start with the user need and the constraints of Atlas Search.', 'Explain the chosen approach and compare a simpler baseline.', 'Describe the evidence you would collect, including relevance and latency. Do not invent results.'],
        followUps: ['How would your design change for queries outside the training distribution?'],
      })),
    };
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const config = { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, model: 'demo-model', apiKey: 'demo-not-a-real-key' };
  settings = new SettingsStore(join(profile, 'settings.json'), plainCipher);
  assert.equal(settings.getPublic().ui.lang, 'en');
  settings.applyPatch({ llm: { ...config, answerLang: 'english' }, asr: { realtime: { apiKey: 'demo-not-a-real-speech-key' } } });
  // Test settings is a synthetic cipher; suppress only its weak-crypto warning in the published demo.
  const publicSettings = () => ({ ...settings.getPublic(), weakCrypto: false });
  const imported = {};
  for (const [name, text, kind] of [['atlas-search.pdf', demo.project, 'project'], ['retrieval-reading-notes.pdf', demo.paper, 'paper']]) {
    const file = join(profile, name); writeFileSync(file, demo.pdf(text));
    const result = await importDocuments([file], kind); assert.equal(result.errors.length, 0); assert.match(result.documents[0].text, /synthetic/);
    imported[kind] = result;
  }
  const documents = [...imported.project.documents, ...imported.paper.documents];
  const t0 = Date.UTC(2026, 9, 31, 10);
  data = { currentId: 'atlas', sessions: [{ id: 'atlas', name: 'Atlas Search · practice', createdAt: t0,
    resumeName: 'alex-rivera-demo.txt', resumeText: demo.resume, jdName: 'ml-engineer-demo.txt', jdText: demo.jd,
    documents,
    segments: [
      { id: 1, speaker: 'them', text: 'Walk me through the retrieval pipeline you designed for Atlas Search.', startTs: t0, endTs: t0 + 4000 },
      { id: 2, speaker: 'me', text: 'I combined sparse and dense retrieval, then used a cross-encoder to rerank the candidates.', startTs: t0 + 6000, endTs: t0 + 11000 },
      { id: 3, speaker: 'them', text: 'How would you verify that the extra stage is worth its latency?', startTs: t0 + 14000, endTs: t0 + 18000 },
    ],
    turns: [{ id: 'demo-answer', kind: 'segment', label: 'How would you evaluate the extra reranking stage?', status: 'done', text: 'Start with a held-out query set and a simple retrieval baseline. Compare candidate Recall@20, final MRR and nDCG, then measure end-to-end p95 latency.\n\nRun an ablation with and without the cross-encoder under the same relevance labels and compute budget. Investigate false positives and queries with no relevant documents.\n\nFor Atlas Search, explain how you would decide whether a quality gain justifies the additional latency. Report only measurements you actually collected; the demo materials do not claim production results.' }],
  }, { id: 'empty', name: 'New practice session', createdAt: t0 + 1, turns: [], segments: [] }] };
  ipcMain.handle('settings:get', publicSettings);
  ipcMain.handle('settings:set', (_e, patch) => { settings.applyPatch(patch); return publicSettings(); });
  ipcMain.handle('sessions:load', () => data);
  ipcMain.on('sessions:save', (_e, next) => { data = next; });
  ipcMain.handle('asr:replay', () => ({ ready: { kind: 'ready', ep: 'cloud-realtime', loadMs: 0, warmMs: 0 }, status: null }));
  ipcMain.on('llm:prewarm', () => {});
  ipcMain.handle('llm:memo', () => '');
  ipcMain.handle('knowledge:pick', (_e, slot) => ({ name: slot === 'jd' ? 'ml-engineer-demo.txt' : 'alex-rivera-demo.txt', text: slot === 'jd' ? demo.jd : demo.resume, chars: (slot === 'jd' ? demo.jd : demo.resume).length }));
  ipcMain.handle('documents:pick', (_e, kind) => imported[kind]);
  ipcMain.handle('interview:source-open', () => true);
  ipcMain.handle('interview:run', async (_e, input) => { const controller = new AbortController(); controllers.set(input.requestId, controller); try { return await runInterview(config, input, controller.signal); } finally { controllers.delete(input.requestId); } });
  ipcMain.on('interview:cancel', (_e, id) => controllers.get(id)?.abort());
  ipcMain.handle('app:get-info', () => ({ version: require('../package.json').version, platform: process.platform, packaged: false }));
  ipcMain.handle('onboarding:get', () => settings.getPublic().onboarding);
  ipcMain.handle('app:open-external', () => true);
  ipcMain.on('capture:pcm', () => { throw new Error('Audio capture is not allowed in this test'); });
  win = new BrowserWindow(windowOptions('index.js')); watch(win);
  await win.loadFile(join(root, 'out/renderer/index.html'));
  await until("!!document.querySelector('.glass-control')");
  assert.equal(await js('document.title'), 'OfferMe');
  assert.equal(await js("document.querySelector('.brand-wordmark').textContent"), 'OfferMe');
  assert.equal(await js("document.querySelector('.brand-mark').naturalWidth"), 1024);
  assert(await js("document.querySelector('.workspace-sidebar').textContent.includes('0.7.0')"));
  await shot('workspace');
  await nav('Session documents'); await click('View'); // first reference
  await until("!!document.querySelector('.document-preview')");
  assert.match(await js("document.querySelector('.document-preview').textContent"), /Atlas Search/);
  await shot('documents');
  await nav('Mock interview');
  await until("!!document.querySelector('.interview-panel')");
  await select('.interview-role input', 'ML Engineer · retrieval and evaluation');
  await select('select[aria-label="Question count"]', '5', 'HTMLSelectElement');
  await select('select[aria-label="Direction"]', 'llm', 'HTMLSelectElement');
  await js("document.querySelector('.interview-bank').open = true");
  const browse = await js("[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Browse bank')).textContent.trim()");
  await click(browse);
  await select('.bank-search', 'hybrid');
  assert(await js("[...document.querySelectorAll('.bank-row')].some(e=>e.textContent.includes('BM25'))"));
  await select('.bank-search', ''); await js("document.querySelector('.interview-panel').scrollTop = 470"); await shot('bank');
  await js("document.querySelector('.interview-bank').open = false");
  await click('Generate questions');
  await until("document.querySelectorAll('.interview-question-nav').length === 5");
  assert.equal(calls.length, 1);
  assert(JSON.parse(calls[0].messages[1].content).referenceMaterials.includes('Atlas Search'));
  assert(await js("!!document.querySelector('.question-grounding .source-link')"));
  await pause(450);
  const firstIds = data.sessions[0].interview.seenQuestionIds;
  assert.equal(firstIds.length, 5);
  await js("document.querySelector('.interview-panel').scrollTop = 495");
  await shot('interview');
  await click('Practice one by one');
  assert.equal(await js("!!document.querySelector('.interview-notes')"), false);
  await select('#practice-answer', 'I would compare the same held-out queries against a BM25 baseline, measure Recall@20 and nDCG, then check p95 latency. A reranker ablation would show whether the extra stage adds value.', 'HTMLTextAreaElement');
  await click('Get AI feedback');
  await until("!!document.querySelector('.interview-feedback')");
  assert.equal(calls.length, 2);
  await js("document.querySelector('.interview-panel').scrollTop = 650");
  await shot('practice');
  await click('Reveal notes'); assert(await js("!!document.querySelector('.interview-notes')"));
  await js("document.querySelector('.interview-panel').scrollTop = 0");
  await click('Regenerate'); await until("!document.querySelector('.interview-progress')"); await pause(450);
  const secondIds = data.sessions[0].interview.plan.questions.map(q => q.grounding.bankQuestionId);
  assert(secondIds.every(id => !firstIds.includes(id)));
  assert.equal(data.sessions[0].interview.seenQuestionIds.length, 10);
  const oldCreatedAt = data.sessions[0].interview.plan.createdAt;
  forceError = true; await click('Regenerate'); await until("!!document.querySelector('.interview-error')");
  assert.equal(await js("document.querySelectorAll('.interview-question-nav').length"), 5);
  forceError = false; slow = true; await click('Regenerate'); await click('Cancel'); await pause(1500);
  assert.equal(data.sessions[0].interview.plan.createdAt, oldCreatedAt); slow = false;
  await nav('Workspace');
  await js("document.querySelector('.documents-panel').open=false");
  await js("document.querySelector('[title=\"Toggle theme\"]').click(); document.querySelector('.glass-control').open=true");
  await until("document.documentElement.dataset.theme === 'dark'");
  await js("document.querySelector('.palette-option[aria-label=\"Ocean\"]').click()");
  await until("window.offerme.getSettings().then(s => s.ui.backgroundPalette === 'ocean')");
  await select('#glass-alpha', '55');
  await until("document.querySelector('.glass-control summary span').textContent === '55%'");
  await js("document.querySelector('#glass-alpha').dispatchEvent(new Event('pointerup',{bubbles:true}))");
  await until("window.offerme.getSettings().then(s => Math.abs(s.ui.glassOpacity - .45) < 1e-9)");
  assert.equal(settings.getPublic().ui.backgroundPalette, 'ocean');
  assert(Math.abs(settings.getPublic().ui.glassOpacity - .45) < 1e-9);
  await shot('appearance');
  await js("document.querySelector('.glass-control').open=false; document.body.style.background='transparent'");
  await pause(150);
  const bitmap = (await win.webContents.capturePage()).toBitmap(); let partial = 0;
  for (let i = 3; i < bitmap.length; i += 4) if (bitmap[i] > 0 && bitmap[i] < 250) partial++;
  assert(partial > bitmap.length / 4 * .2, 'Real window background should be translucent');
  await js("document.querySelector('[title=\"Toggle theme\"]').click()");
  settings.applyPatch({ llm: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' } });
  await win.webContents.reload(); await until("!!document.querySelector('.glass-control')");
  await nav('Settings'); await until("!!document.querySelector('.settings') || !!document.querySelector('.settings-overlay') || document.body.textContent.includes('Text LLM')");
  await shot('settings');
  await js("document.querySelector('.settings-advanced').open = true; document.querySelector('.settings-advanced').scrollIntoView({block:'start'})");
  await shot('settings-api');
  // Main renderer reload preserves saved practice and independent appearance settings.
  await win.webContents.reload(); await until("!!document.querySelector('.glass-control')");
  await nav('Mock interview');
  assert.equal(await js("document.querySelectorAll('.interview-question-nav').length"), 5);
  assert.equal(settings.getPublic().ui.backgroundPalette, 'ocean');
  await js("document.querySelectorAll('.sidebar-session')[1].click()"); await nav('Mock interview');
  assert.equal(await js("document.querySelectorAll('.interview-question-nav').length"), 0);
  assert(await js("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Generate questions')).disabled"));
  win.setSize(980, 680); await pause(100);
  assert.equal(await js('document.documentElement.scrollWidth > innerWidth'), false);
  assert.equal(await js("document.querySelector('.interview-panel').scrollWidth > document.querySelector('.interview-panel').clientWidth + 1"), false);
  // Show the first-run renderer with the real setup preload, still hidden and using the fresh English defaults.
  setup = new BrowserWindow(windowOptions('setup.js', 1100, 820)); watch(setup);
  await setup.loadFile(join(root, 'out/renderer/setup.html'));
  await pause(350);
  assert.match(await setup.webContents.executeJavaScript('document.body.textContent'), /Start setup/);
  await shot('setup', setup);
  assert.deepEqual(errors, []);
  console.log('UI checks passed: English workspace/setup, real PDF extraction, bilingual bank search, mock HTTP generation/feedback, source attribution, unseen rounds, failure/cancel retention, session isolation/reload, palette persistence, compact layout and genuine alpha.');
  console.log(`No paid APIs, OS audio capture or desktop screenshots. Translucent pixel ratio: ${(partial / (bitmap.length / 4)).toFixed(3)}.`);
  if (screenshots) console.log('Synthetic screenshots saved in docs/assets.');
  clearTimeout(timeout); setup.destroy(); win.destroy(); server.close(); app.quit();
}).catch(error => { console.error(error, errors); clearTimeout(timeout); server?.close(); app.exit(1); });
app.on('will-quit', () => { try { rmSync(profile, { recursive: true, force: true }); } catch {} });
