const $ = (id) => document.getElementById(id);
let approved = 0, rejected = 0, runs = 0;
async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The prototype request could not be completed.");
  return data;
}
function events(items) {
  $("eventLog").innerHTML = (items.length ? items : [{time:"—",message:"Workspace initialized. Ready for simulation.",level:"info"}]).map(e => `<li class="${e.level}"><time>${e.time}</time><span>${e.message}</span></li>`).join("");
}
function renderIncidents(items) {
  $("caseTotal").textContent = items.length;
  $("incidentList").innerHTML = items.length ? items.map(item => `<div class="incident-row"><div class="incident-title"><strong>${item.id} · ${item.title}</strong><small>${item.summary}</small></div><span class="severity ${item.severity.toLowerCase()}">${item.severity}</span><span class="case-status ${item.status.toLowerCase()}">${item.status}</span><span class="case-owner">${item.owner}</span><button class="case-action" data-case="${item.id}" data-status="${item.status}">${item.status === "Closed" ? "Closed" : "Advance →"}</button></div>`).join("") : '<div class="empty-cases">No cases yet. Run a full simulation to create a traceable incident.</div>';
}
function riskFactors(attack = 0, defense = 0) {
  const severity = Math.round(attack * 0.45), asset = attack ? 22 : 0, exposure = attack ? Math.round(attack * 0.25) : 0, readiness = defense ? Math.round(defense * 0.3) : 0;
  $("riskBreakdown").innerHTML = `<div><span>Threat severity</span><b>${severity || "—"}</b></div><div><span>Asset sensitivity</span><b>${asset || "—"}</b></div><div><span>Exposure context</span><b>${exposure || "—"}</b></div><div class="reduction"><span>Defense readiness</span><b>${readiness ? "−" + readiness : "—"}</b></div>`;
}
async function analytics() {
  const data = await api("/analytics");
  $("successRate").textContent = `${data.success_rate}%`; $("avgAttack").textContent = data.avg_attack; $("avgDefense").textContent = data.avg_defense;
  const max = Math.max(1, ...Object.values(data.domains));
  Array.from($("domainChart").children).forEach(row => { const name = row.children[0].textContent; const amount = data.domains[name] || 0; row.children[1].children[0].style.width = `${(amount / max) * 100}%`; row.children[2].textContent = amount; });
}
async function refresh() { const s = await api("/dashboard-state"); runs = s.runs; approved = s.approved; rejected = s.rejected; $("runs").textContent = String(runs).padStart(2,"0"); $("decisions").textContent = `${approved} / ${rejected}`; events(s.events); renderIncidents(s.incidents); riskFactors(s.attack?.score, s.defense?.score); await analytics(); }
function setBusy(value) { $("status").textContent = value; }
function setPressure(attack, defense) {
  $("attackMini").style.width = `${attack}%`;
  $("defenseMini").style.width = `${defense}%`;
  const posture = Math.max(0, Math.min(99, 100 - Math.round(attack * 0.55) + Math.round(defense * 0.35)));
  $("postureValue").textContent = posture;
  $("postureDetail").textContent = defense >= attack
    ? "Simulated safeguards are keeping pace with the active scenario."
    : "Response refinement is recommended in the virtual environment.";
}
$("attackBtn").onclick = async () => { try { setBusy("Generating scenario"); const d = await api("/generate-attack"); $("attackText").textContent = `${d.scenario.name}: ${d.attack}`; $("attackScore").textContent = `${d.score}%`; $("attackMini").style.width = `${d.score}%`; $("risk").innerHTML = `${String(d.score).padStart(2,"0")}<sup>/100</sup>`; $("riskNote").textContent = `${d.scenario.domain} signal`; setBusy("Scenario ready"); await refresh(); } catch(e) { setBusy("Error"); alert(e.message); } };
$("defenseBtn").onclick = async () => { try { setBusy("Planning response"); const d = await api("/generate-defense"); $("defenseText").textContent = `${d.strategy.name}: ${d.defense}`; $("defenseScore").textContent = `${d.score}%`; $("defenseMini").style.width = `${d.score}%`; setBusy("Response ready"); await refresh(); } catch(e) { alert(e.message); } };
$("runBtn").onclick = async () => { try { setBusy("Simulating"); const d = await api("/run-simulation"); $("attackText").textContent = `${d.attack_scenario.name}: ${d.attack_scenario.detail}`; $("defenseText").textContent = `${d.defense_strategy.name}: ${d.defense_strategy.detail}`; $("attackScore").textContent = `${d.attack}%`; $("defenseScore").textContent = `${d.defense}%`; $("risk").innerHTML = `${String(d.attack).padStart(2,"0")}<sup>/100</sup>`; $("riskNote").textContent = `${d.incident.id} · ${d.attack_scenario.domain}`; $("attackBar").style.width = `${d.attack}%`; $("defenseBar").style.width = `${d.defense}%`; $("aBarLabel").textContent = `${d.attack}%`; $("dBarLabel").textContent = `${d.defense}%`; setPressure(d.attack, d.defense); const outcome=$("outcome"); outcome.textContent = `${d.result} · ${d.confidence}% confidence`; outcome.className = `outcome ${d.margin >= 0 ? "good" : "warn"}`; setBusy(d.result); await refresh(); } catch(e) { alert(e.message); } };
$("controlBtn").onclick = async () => { try { const d = await api("/generate-control"); $("controlText").textContent = d.control; $("reviewText").textContent = "Control is ready for a human reviewer. Approval records a prototype decision only."; await refresh(); } catch(e) { alert(e.message); } };
async function review(decision) { try { const d = await api("/review-control", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision})}); $("reviewText").textContent = decision === "approve" ? "Approved for prototype documentation. No deployment was performed." : "Rejected by reviewer. The proposed control remains un-deployed."; await refresh(); } catch(e) { alert(e.message); } }
$("approveBtn").onclick = () => review("approve"); $("rejectBtn").onclick = () => review("reject");
$("incidentList").onclick = async (event) => { const button = event.target.closest("[data-case]"); if (!button || button.dataset.status === "Closed") return; const sequence = {Open:"Investigating", Investigating:"Contained", Contained:"Closed"}; await api(`/incidents/${button.dataset.case}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:sequence[button.dataset.status]})}); await refresh(); };
$("resetBtn").onclick = async () => { await api("/reset", {method:"POST"}); ["attackText","defenseText"].forEach(id => $(id).textContent = id === "attackText" ? "No synthetic scenario selected." : "No simulated response selected."); $("attackScore").textContent=$("defenseScore").textContent="—"; $("controlText").textContent="Generate a simulation-informed safeguard for human review."; $("reviewText").textContent="A named reviewer must decide before the prototype records the proposed control."; $("outcome").textContent="No comparison has been run."; $("outcome").className="outcome empty"; $("attackBar").style.width=$("defenseBar").style.width=$("attackMini").style.width=$("defenseMini").style.width="0"; $("risk").innerHTML="00<sup>/100</sup>"; $("riskNote").textContent="No active scenario"; $("postureValue").textContent="72"; $("postureDetail").textContent="Baseline coverage is active in the virtual environment."; setBusy("Ready"); await refresh(); };
function updateClock() { $("clock").textContent = new Date().toISOString().slice(11, 19) + " UTC"; }
updateClock(); setInterval(updateClock, 1000);
refresh().catch(() => setBusy("Offline"));
