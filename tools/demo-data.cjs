/** Synthetic documentation fixtures. No real person, employer or provider account. */
const resume = `Alex Rivera — synthetic demonstration resume
Machine Learning Engineer | Retrieval and evaluation

Atlas Search — project example
Built a document search prototype using BM25 and dense embeddings. Added a cross-encoder reranking stage and a RAG answer pipeline with source attribution.
Created a labeled evaluation set to compare Recall@20, MRR and nDCG. Investigated false-positive retrieval and tracked end-to-end latency.
Personal contribution: retrieval design, evaluation scripts and failure analysis. This demo makes no claims about production outcomes or employment.`;
const jd = `Machine Learning Engineer — synthetic job description
Design reliable retrieval and ranking systems. Explain model choices, evaluation methodology and latency tradeoffs. Experience with RAG, hybrid search, Python and distributed inference is useful.`;
const project = `Atlas Search: design notes (synthetic example)

Goal: help a small team find relevant technical documents and trace answers to their sources.
Pipeline: parse documents, retrieve with BM25 and dense embeddings, fuse candidate lists, rerank with a cross-encoder, then build a grounded answer prompt.
Evaluation: use a held-out query set with relevance labels. Track Recall@20, MRR, nDCG and p95 end-to-end latency. Keep retriever, reranker and generator ablations separate.
Open questions: score normalization, query drift, stale documents and how to handle insufficient evidence.
All content is invented for UI documentation; no measured performance is claimed.`;
const paper = `Retrieval evaluation: reading notes (synthetic reference)

Recall@K measures candidate coverage. MRR rewards the position of the first relevant result. nDCG supports graded relevance and position discounts.
Use a fixed evaluation protocol and report uncertainty. Improving one offline metric does not establish a production benefit.
This is a demonstration reference, not a published paper or a claim of authorship.`;
function pdf(text) {
  const lines = text.split('\n').flatMap(line => line.match(/.{1,82}(?:\s|$)|.{1,82}/g) || ['']);
  const escaped = s => s.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  const content = `BT /F1 11 Tf 42 756 Td 15 TL\n${lines.map(line => `(${escaped(line.trim())}) Tj T*`).join('\n')}\nET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
  let body = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj,i) => { offsets.push(Buffer.byteLength(body)); body += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
module.exports = { resume, jd, project, paper, pdf };
