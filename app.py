from flask import Flask, jsonify, render_template, request
from datetime import datetime, timezone
import random

app = Flask(__name__)

ATTACKS = [
    ("Credential exposure scenario", "A simulated identity-risk pattern targets a decoy user account.", "Identity", 72),
    ("Suspicious traffic scenario", "A simulated lateral-movement signal crosses the virtual network.", "Network", 81),
    ("Malicious attachment scenario", "A simulated attachment attempts execution in an isolated endpoint.", "Endpoint", 67),
    ("Service disruption scenario", "A simulated traffic surge tests the availability safeguards.", "Availability", 76),
]
DEFENSES = [
    ("Adaptive access policy", "Require step-up verification and isolate the simulated account session.", "Identity", 84),
    ("Network segmentation", "Quarantine the virtual segment and route telemetry to the SOC queue.", "Network", 88),
    ("Endpoint containment", "Block the simulated process chain and collect a safe forensic snapshot.", "Endpoint", 86),
    ("Rate-limiting posture", "Apply simulated throttling and preserve service capacity.", "Availability", 82),
]
CONTROLS = [
    "Propose phishing-resistant authentication for privileged prototype accounts.",
    "Propose segmentation policy review for the simulated application zone.",
    "Propose endpoint isolation playbook validation in the lab environment.",
    "Propose alert tuning for anomalous virtual network activity.",
]

state = {
    "attack": None, "defense": None, "control": None, "events": [],
    "approved": 0, "rejected": 0, "runs": 0, "incidents": [], "next_incident": 1,
}


def now():
    return datetime.now(timezone.utc).strftime("%H:%M:%S UTC")


def log(message, level="info"):
    state["events"].insert(0, {"time": now(), "message": message, "level": level})
    state["events"] = state["events"][:12]


def attack_payload():
    name, detail, domain, base = random.choice(ATTACKS)
    score = max(40, min(100, base + random.randint(-10, 10)))
    return {"name": name, "detail": detail, "domain": domain, "score": score}


def defense_payload():
    name, detail, domain, base = random.choice(DEFENSES)
    score = max(40, min(100, base + random.randint(-10, 10)))
    return {"name": name, "detail": detail, "domain": domain, "score": score}


def severity_for(score):
    if score >= 85:
        return "Critical"
    if score >= 72:
        return "High"
    if score >= 55:
        return "Medium"
    return "Low"


def add_incident(attack, defense, result):
    incident_id = f"INC-{datetime.now(timezone.utc).year}-{state['next_incident']:03d}"
    state["next_incident"] += 1
    incident = {
        "id": incident_id,
        "title": attack["name"],
        "domain": attack["domain"],
        "severity": severity_for(attack["score"]),
        "status": "Contained" if result == "Defense successful" else "Investigating",
        "owner": "A. Lin",
        "created": now(),
        "attack_score": attack["score"],
        "defense_score": defense["score"],
        "summary": attack["detail"],
    }
    state["incidents"].insert(0, incident)
    state["incidents"] = state["incidents"][:20]
    return incident


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/generate-attack")
def generate_attack():
    state["attack"] = attack_payload()
    log(f"Simulated threat scenario generated: {state['attack']['name']}", "warning")
    return jsonify({"attack": state["attack"]["detail"], "score": state["attack"]["score"], "scenario": state["attack"]})


@app.route("/generate-defense")
def generate_defense():
    state["defense"] = defense_payload()
    log(f"Simulated defensive response generated: {state['defense']['name']}", "success")
    return jsonify({"defense": state["defense"]["detail"], "score": state["defense"]["score"], "strategy": state["defense"]})


@app.route("/run-simulation")
def run_simulation():
    attack = state["attack"] or attack_payload()
    defense = state["defense"] or defense_payload()
    state["attack"], state["defense"] = attack, defense
    margin = defense["score"] - attack["score"]
    result = "Defense successful" if margin >= 0 else "Containment required"
    confidence = min(99, 65 + abs(margin))
    state["runs"] += 1
    incident = add_incident(attack, defense, result)
    log(f"Simulation #{state['runs']} completed — {result}.", "success" if margin >= 0 else "warning")
    log(f"{incident['id']} opened with {incident['severity'].lower()} simulated severity.", "warning" if incident["severity"] in {"High", "Critical"} else "info")
    return jsonify({"attack": attack["score"], "defense": defense["score"], "result": result, "margin": margin, "confidence": confidence, "attack_scenario": attack, "defense_strategy": defense, "incident": incident})


@app.route("/generate-control")
def generate_control():
    state["control"] = random.choice(CONTROLS)
    log("Proposed control queued for human review.", "info")
    return jsonify({"control": state["control"]})


@app.route("/review-control", methods=["POST"])
def review_control():
    decision = (request.get_json(silent=True) or {}).get("decision")
    if decision not in {"approve", "reject"}:
        return jsonify({"error": "Decision must be approve or reject."}), 400
    if not state["control"]:
        return jsonify({"error": "Generate a proposed control first."}), 400
    state["approved" if decision == "approve" else "rejected"] += 1
    log(f"Human reviewer {decision}d the proposed control. No deployment performed.", "success" if decision == "approve" else "warning")
    return jsonify({"decision": decision, "control": state["control"]})


@app.route("/dashboard-state")
def dashboard_state():
    return jsonify({**state, "risk": state["attack"]["score"] if state["attack"] else 0})


@app.route("/incidents/<incident_id>", methods=["PATCH"])
def update_incident(incident_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    allowed = {"Open", "Investigating", "Contained", "Closed"}
    if status not in allowed:
        return jsonify({"error": "Use a valid incident status."}), 400
    incident = next((item for item in state["incidents"] if item["id"] == incident_id), None)
    if not incident:
        return jsonify({"error": "Incident not found."}), 404
    incident["status"] = status
    log(f"{incident_id} status changed to {status} by the simulated analyst workspace.", "success" if status in {"Contained", "Closed"} else "info")
    return jsonify({"incident": incident})


@app.route("/analytics")
def analytics():
    incidents = state["incidents"]
    total = len(incidents)
    successful = sum(item["defense_score"] >= item["attack_score"] for item in incidents)
    domains = {"Identity": 0, "Network": 0, "Endpoint": 0, "Availability": 0}
    for item in incidents:
        domains[item["domain"]] = domains.get(item["domain"], 0) + 1
    return jsonify({
        "total": total,
        "success_rate": round((successful / total) * 100) if total else 0,
        "avg_attack": round(sum(item["attack_score"] for item in incidents) / total) if total else 0,
        "avg_defense": round(sum(item["defense_score"] for item in incidents) / total) if total else 0,
        "domains": domains,
    })


@app.route("/reset", methods=["POST"])
def reset():
    state.update({"attack": None, "defense": None, "control": None, "events": [], "approved": 0, "rejected": 0, "runs": 0, "incidents": [], "next_incident": 1})
    log("Prototype workspace reset.", "info")
    return jsonify({"ok": True, "events": state["events"]})


if __name__ == "__main__":
    app.run(debug=True)
