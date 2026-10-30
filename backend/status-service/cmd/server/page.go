package main

// statusPage is the single served HTML document. It is deliberately one
// static file: the page shell renders immediately (a status page must be
// readable even when half the platform is down), then JavaScript refreshes
// it from /status.json every pageRefreshJS seconds.
const statusPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ft_transcendence — platform status</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 44rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  .overall { display: inline-block; padding: .15rem .7rem; border-radius: 1rem;
             font-weight: 600; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: .55rem .5rem; border-bottom: 1px solid rgba(128,128,128,.3); }
  th { font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; opacity: .7; }
  td.num { font-variant-numeric: tabular-nums; text-align: right; }
  .pill { display: inline-block; min-width: 3.2rem; text-align: center;
          padding: .1rem .5rem; border-radius: 1rem; font-weight: 700; font-size: .8rem; }
  .up   { background: #1a7f37; color: #fff; }
  .down { background: #cf222e; color: #fff; }
  footer { margin-top: 2rem; font-size: .8rem; opacity: .7; }
</style>
</head>
<body>
<main>
  <h1>Platform status</h1>
  <span class="overall" id="overall">…</span>
  <table>
    <thead><tr><th>Service</th><th>Status</th><th class="num">Latency</th></tr></thead>
    <tbody id="rows"></tbody>
  </table>
  <table id="backups" hidden>
    <thead><tr><th>Backup</th><th class="num">Newest artifact</th></tr></thead>
    <tbody id="backup-rows"></tbody>
  </table>
  <footer>Refreshes every 10s from <code>/status.json</code> ·
    JSON: <a href="/status.json">/status.json</a></footer>
</main>
<script>
function fmtAge(seconds) {
  if (seconds < 0) return "none";
  const hours = seconds / 3600;
  if (hours < 1) return Math.round(seconds / 60) + " min ago";
  if (hours < 48) return Math.round(hours) + " h ago";
  return Math.round(hours / 24) + " days ago";
}
async function refresh() {
  const status = await (await fetch("/status.json")).json();
  document.getElementById("overall").textContent = "all systems " + status.overall;
  document.getElementById("rows").replaceChildren(...status.services.map(s => {
    const tr = document.createElement("tr");
    const name = document.createElement("td"); name.textContent = s.name;
    const pill = document.createElement("td");
    const p = document.createElement("span");
    p.className = "pill " + s.status.toLowerCase(); p.textContent = s.status;
    pill.append(p);
    const lat = document.createElement("td"); lat.className = "num"; lat.textContent = s.latency_ms + " ms";
    tr.append(name, pill, lat); return tr;
  }));
  const backups = Object.entries(status.backup_age_seconds);
  if (backups.length) {
    document.getElementById("backups").hidden = false;
    document.getElementById("backup-rows").replaceChildren(...backups.map(([kind, age]) => {
      const tr = document.createElement("tr");
      const k = document.createElement("td"); k.textContent = kind;
      const a = document.createElement("td"); a.className = "num"; a.textContent = fmtAge(age);
      tr.append(k, a); return tr;
    }));
  }
}
refresh().catch(() => {});
setInterval(() => refresh().catch(() => {}), 10000);
</script>
</body>
</html>
`