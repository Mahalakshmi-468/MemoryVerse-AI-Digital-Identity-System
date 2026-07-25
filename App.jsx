import React, { useState, useMemo, useRef } from "react";
import {
  Sparkles, Upload, LayoutGrid, GitBranch, Search, Loader2, X, Plus,
  Award, Briefcase, GraduationCap, Rocket, Trophy, Star, FileText, ArrowRight
} from "lucide-react";

// ---------- design tokens ----------
const INK = "#EFE9DC";        // parchment ink on dark ground
const GROUND = "#171522";      // deep indigo-plum ground
const PANEL = "#1F1C2E";
const LINE = "#332F45";
const GOLD = "#D4A94B";
const TEAL = "#5EC8C0";
const CORAL = "#E0795A";

const CATEGORY_ORDER = ["Academics", "Certifications", "Certificates", "Skills", "Projects", "Internships", "Achievements"];
const CATEGORY_META = {
  Academics: { color: "#7FA1D9", icon: GraduationCap },
  Certifications: { color: GOLD, icon: Award },
  Certificates: { color: GOLD, icon: Award },
  Skills: { color: TEAL, icon: Star },
  Projects: { color: "#7FCB94", icon: Rocket },
  Internships: { color: CORAL, icon: Briefcase },
  Achievements: { color: "#C08BE0", icon: Trophy },
};
const normalizeCategory = (c) => {
  const found = CATEGORY_ORDER.find(k => k.toLowerCase() === String(c || "").toLowerCase());
  return found || "Academics";
};

// ---------- seed data (so the journey map isn't empty on load) ----------
const SEED_DOCS = [
  { id: "s1", title: "Class XII — CBSE Board", category: "Academics", year: 2022, skills: ["Mathematics", "Physics"], summary: "Completed higher secondary education with a science stream.", organization: "CBSE" },
  { id: "s2", title: "Python for Everybody", category: "Certifications", year: 2023, skills: ["Python", "Programming Fundamentals"], summary: "Certification covering Python basics through data structures.", organization: "Coursera" },
  { id: "s3", title: "Data Science Club — Lead", category: "Achievements", year: 2024, skills: ["Leadership", "Data Science", "Python"], summary: "Led a 40-member college data science community.", organization: "College Tech Council" },
  { id: "s4", title: "Crop Yield Prediction", category: "Projects", year: 2024, skills: ["Python", "Machine Learning", "Data Science"], summary: "ML model predicting crop yield from weather and soil data.", organization: "Personal Project" },
  { id: "s5", title: "Software Intern", category: "Internships", year: 2025, skills: ["Python", "Machine Learning", "APIs"], summary: "Built internal ML tooling during a 3-month internship.", organization: "XYZ Analytics" },
  { id: "s6", title: "AI/ML Portfolio Resume", category: "Academics", year: 2026, skills: ["Machine Learning", "Python", "Leadership"], summary: "Consolidated resume showcasing AI/ML project and internship work.", organization: "Self" },
];
const SEED_EDGES = [
  { from: "s2", to: "s4", label: "skill applied in" },
  { from: "s4", to: "s5", label: "project led to" },
  { from: "s3", to: "s5", label: "leadership shown in" },
  { from: "s5", to: "s6", label: "experience reflected in" },
  { from: "s1", to: "s2", label: "foundation for" },
];
const SEED_INSIGHT = "A steady climb from foundational science into applied machine learning — coursework became a certification, the certification became a project, and the project opened the door to a real internship.";

async function callClaude(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export default function App() {
  const [tab, setTab] = useState("ingest");
  const [docs, setDocs] = useState(SEED_DOCS);
  const [edges, setEdges] = useState(SEED_EDGES);
  const [insight, setInsight] = useState(SEED_INSIGHT);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState("");
  const [buildingGraph, setBuildingGraph] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const idCounter = useRef(100);

  async function handleIngest() {
    if (!pasteText.trim()) return;
    setIngesting(true);
    setIngestError("");
    try {
      const parsed = await callClaude(
        "You are a document classification engine inside a personal Digital Identity System. Given raw text pasted from a student or professional's document (certificate, resume, project report, internship letter, achievement note, etc), return ONLY a raw JSON object with no markdown fences and no preamble, shaped exactly as: {\"title\": string, \"category\": one of [\"Academics\",\"Certifications\",\"Certificates\",\"Skills\",\"Projects\",\"Internships\",\"Achievements\"], \"year\": four-digit number or null, \"skills\": array of short skill strings (max 5), \"summary\": one sentence, \"organization\": string or null}.",
        `Document title hint: ${pasteTitle || "(none given)"}\n\nDocument text:\n${pasteText}`
      );
      const newDoc = {
        id: `d${idCounter.current++}`,
        title: parsed.title || pasteTitle || "Untitled document",
        category: normalizeCategory(parsed.category),
        year: parsed.year || null,
        skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 5) : [],
        summary: parsed.summary || "",
        organization: parsed.organization || null,
      };
      setDocs((prev) => [...prev, newDoc]);
      setPasteTitle("");
      setPasteText("");
      setTab("repository");
    } catch (e) {
      setIngestError("Couldn't analyze that document. Try again, or paste a bit more text.");
    } finally {
      setIngesting(false);
    }
  }

  async function handleBuildGraph() {
    setBuildingGraph(true);
    try {
      const compact = docs.map((d) => ({ id: d.id, title: d.title, category: d.category, year: d.year, skills: d.skills, summary: d.summary }));
      const parsed = await callClaude(
        "You are a relationship engine inside a personal Digital Identity System. Given a JSON list of a person's documents (certificates, skills, projects, internships, achievements, academics), find meaningful connections between them, such as a certification leading to a skill used in a project, or a project leading to an internship. Return ONLY a raw JSON object, no markdown fences, shaped exactly as: {\"edges\": [{\"from\": doc id, \"to\": doc id, \"label\": short 2-4 word relationship phrase}], \"insight\": one to two sentence narrative describing this person's overall growth and trajectory}. Only include edges between ids that exist in the input. Limit to at most 12 edges, the strongest ones.",
        JSON.stringify(compact)
      );
      const validIds = new Set(docs.map((d) => d.id));
      const cleanEdges = (parsed.edges || []).filter((e) => validIds.has(e.from) && validIds.has(e.to));
      setEdges(cleanEdges);
      setInsight(parsed.insight || "");
      setTab("journey");
    } catch (e) {
      setIngestError("Couldn't build the connection map just now. Try again in a moment.");
    } finally {
      setBuildingGraph(false);
    }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const compact = docs.map((d) => ({ id: d.id, title: d.title, category: d.category, year: d.year, skills: d.skills, summary: d.summary }));
      const parsed = await callClaude(
        "You are the retrieval layer of a personal Digital Identity System. Given a natural-language query and a JSON list of the person's documents, find which documents answer the query. Return ONLY a raw JSON object, no markdown fences, shaped exactly as: {\"answer\": short natural-language answer to the query, \"matches\": array of matching doc ids, ordered by relevance}.",
        `Query: ${query}\n\nDocuments:\n${JSON.stringify(compact)}`
      );
      setSearchResult(parsed);
    } catch (e) {
      setSearchResult({ answer: "Search hit a snag — try rephrasing the question.", matches: [] });
    } finally {
      setSearching(false);
    }
  }

  const docsById = useMemo(() => Object.fromEntries(docs.map((d) => [d.id, d])), [docs]);
  const grouped = useMemo(() => {
    const g = {};
    CATEGORY_ORDER.forEach((c) => (g[c] = []));
    docs.forEach((d) => g[normalizeCategory(d.category)].push(d));
    return g;
  }, [docs]);

  // ---- journey map layout: x = year, y = category lane ----
  const journeyLayout = useMemo(() => {
    const yearVals = Array.from(new Set(docs.map((d) => d.year).filter(Boolean))).sort((a, b) => a - b);
    const cols = docs.some((d) => !d.year) ? ["Undated", ...yearVals] : yearVals;
    const colW = 132, laneH = 64, marginLeft = 148, marginTop = 24;
    const width = marginLeft + colW * Math.max(cols.length, 1) + 40;
    const height = marginTop + laneH * CATEGORY_ORDER.length + 30;
    const cellCounts = {};
    const positions = {};
    docs.forEach((d) => {
      const catIdx = CATEGORY_ORDER.indexOf(normalizeCategory(d.category));
      const colKey = d.year || "Undated";
      const colIdx = cols.indexOf(colKey);
      const cellKey = `${colIdx}-${catIdx}`;
      const n = cellCounts[cellKey] || 0;
      cellCounts[cellKey] = n + 1;
      const x = marginLeft + colW * colIdx + colW / 2 + n * 14 - 7;
      const y = marginTop + laneH * catIdx + laneH / 2;
      positions[d.id] = { x, y };
    });
    return { cols, colW, laneH, marginLeft, marginTop, width, height, positions };
  }, [docs]);

  return (
    <div style={{ background: GROUND, color: INK, minHeight: "600px", fontFamily: "'Georgia', 'Iowan Old Style', serif", display: "flex", borderRadius: "10px", overflow: "hidden", border: `1px solid ${LINE}` }}>
      {/* sidebar */}
      <div style={{ width: 208, background: PANEL, borderRight: `1px solid ${LINE}`, padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 18px" }}>
          <Sparkles size={18} color={GOLD} />
          <span style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>MemoryVerse</span>
        </div>
        <NavItem icon={Upload} label="Ingest" active={tab === "ingest"} onClick={() => setTab("ingest")} />
        <NavItem icon={LayoutGrid} label="Repository" active={tab === "repository"} onClick={() => setTab("repository")} count={docs.length} />
        <NavItem icon={GitBranch} label="Journey map" active={tab === "journey"} onClick={() => setTab("journey")} />
        <NavItem icon={Search} label="Ask" active={tab === "search"} onClick={() => setTab("search")} />
        <div style={{ marginTop: "auto", padding: "12px 8px 0", borderTop: `1px solid ${LINE}`, fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 11, color: "#8B8699", lineHeight: 1.5 }}>
          AI-powered digital identity system. Every classification, connection, and search below runs live through Claude.
        </div>
      </div>

      {/* main */}
      <div style={{ flex: 1, padding: "24px 28px", overflow: "auto" }}>
        {tab === "ingest" && (
          <div>
            <Header title="Add a document" subtitle="Paste in the text of a certificate, resume, project report, or internship letter — Claude reads it and files it away." />
            <input
              placeholder="Title (optional — Claude can infer one)"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              style={inputStyle}
            />
            <textarea
              placeholder="Paste the document text here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={10}
              style={{ ...inputStyle, marginTop: 10, resize: "vertical", fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 13, lineHeight: 1.6 }}
            />
            {ingestError && <div style={{ color: CORAL, fontSize: 13, marginTop: 8, fontFamily: "sans-serif" }}>{ingestError}</div>}
            <button onClick={handleIngest} disabled={ingesting || !pasteText.trim()} style={primaryBtn(ingesting || !pasteText.trim())}>
              {ingesting ? <><Loader2 size={15} className="spin" style={{ animation: "spin 1s linear infinite" }} /> Analyzing…</> : <><Plus size={15} /> Analyze and file it</>}
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            <div style={{ marginTop: 30, paddingTop: 20, borderTop: `1px solid ${LINE}` }}>
              <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "#8B8699", marginBottom: 10 }}>{docs.length} document{docs.length === 1 ? "" : "s"} in the repository so far</div>
              <button onClick={handleBuildGraph} disabled={buildingGraph || docs.length < 2} style={secondaryBtn(buildingGraph || docs.length < 2)}>
                {buildingGraph ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Mapping connections…</> : <><GitBranch size={15} /> Rebuild the journey map</>}
              </button>
            </div>
          </div>
        )}

        {tab === "repository" && (
          <div>
            <Header title="Repository" subtitle="Everything you've added, organized automatically by Claude — nothing sorted by hand." />
            {CATEGORY_ORDER.map((cat) => grouped[cat].length > 0 && (
              <div key={cat} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontFamily: "sans-serif" }}>
                  {React.createElement(CATEGORY_META[cat].icon, { size: 14, color: CATEGORY_META[cat].color })}
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: CATEGORY_META[cat].color }}>{cat}</span>
                  <span style={{ fontSize: 12, color: "#6C6880" }}>({grouped[cat].length})</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
                  {grouped[cat].map((d) => (
                    <div key={d.id} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{d.title}</div>
                      <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "#A8A3BC", marginBottom: 6 }}>{d.organization || "—"}{d.year ? ` · ${d.year}` : ""}</div>
                      <div style={{ fontFamily: "sans-serif", fontSize: 12.5, color: "#C7C2D6", lineHeight: 1.5, marginBottom: 8 }}>{d.summary}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {d.skills.map((s) => <Tag key={s} label={s} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "journey" && (
          <div>
            <Header title="Journey map" subtitle="Time runs left to right, category runs top to bottom, and gold threads are the connections Claude found." />
            {insight && (
              <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontFamily: "sans-serif", fontSize: 13, lineHeight: 1.6, color: "#E4DFCF" }}>
                {insight}
              </div>
            )}
            <div style={{ overflowX: "auto", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, padding: "10px 4px" }}>
              <svg width={journeyLayout.width} height={journeyLayout.height}>
                {CATEGORY_ORDER.map((cat, i) => (
                  <g key={cat}>
                    <line x1={journeyLayout.marginLeft - 10} y1={journeyLayout.marginTop + journeyLayout.laneH * i + journeyLayout.laneH} x2={journeyLayout.width - 10} y2={journeyLayout.marginTop + journeyLayout.laneH * i + journeyLayout.laneH} stroke={LINE} strokeWidth={1} />
                    <text x={8} y={journeyLayout.marginTop + journeyLayout.laneH * i + journeyLayout.laneH / 2 + 4} fontSize={11} fontFamily="Helvetica, Arial, sans-serif" fill={CATEGORY_META[cat].color} fontWeight="700">{cat}</text>
                  </g>
                ))}
                {journeyLayout.cols.map((c, i) => (
                  <text key={c} x={journeyLayout.marginLeft + journeyLayout.colW * i + journeyLayout.colW / 2} y={14} fontSize={11} fontFamily="Helvetica, Arial, sans-serif" fill="#8B8699" textAnchor="middle">{c}</text>
                ))}
                {edges.map((e, i) => {
                  const a = journeyLayout.positions[e.from], b = journeyLayout.positions[e.to];
                  if (!a || !b) return null;
                  const midX = (a.x + b.x) / 2;
                  return (
                    <path key={i} d={`M ${a.x} ${a.y} Q ${midX} ${Math.min(a.y, b.y) - 24} ${b.x} ${b.y}`} stroke={GOLD} strokeWidth={1.4} fill="none" opacity={0.55}>
                      <title>{e.label}</title>
                    </path>
                  );
                })}
                {docs.map((d) => {
                  const p = journeyLayout.positions[d.id];
                  if (!p) return null;
                  const color = CATEGORY_META[normalizeCategory(d.category)].color;
                  return (
                    <g key={d.id}>
                      <circle cx={p.x} cy={p.y} r={7} fill={GROUND} stroke={color} strokeWidth={2.2} />
                      <text x={p.x} y={p.y - 12} fontSize={10.5} fontFamily="Helvetica, Arial, sans-serif" fill={INK} textAnchor="middle">{d.title.length > 20 ? d.title.slice(0, 18) + "…" : d.title}</text>
                      <title>{d.title} — {d.summary}</title>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {tab === "search" && (
          <div>
            <Header title="Ask your repository" subtitle="Natural language in, exact documents out — no folders to search through." />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="e.g. Show my AI/ML projects"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                style={{ ...inputStyle, flex: 1, marginTop: 0 }}
              />
              <button onClick={handleSearch} disabled={searching || !query.trim()} style={primaryBtn(searching || !query.trim())}>
                {searching ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={15} />}
                Ask
              </button>
            </div>
            {searchResult && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: "sans-serif", fontSize: 14, lineHeight: 1.6, color: "#E4DFCF", marginBottom: 14 }}>{searchResult.answer}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
                  {(searchResult.matches || []).map((id) => {
                    const d = docsById[id];
                    if (!d) return null;
                    const color = CATEGORY_META[normalizeCategory(d.category)].color;
                    return (
                      <div key={id} style={{ background: PANEL, border: `1px solid ${LINE}`, borderLeft: `3px solid ${color}`, borderRadius: 6, padding: "10px 14px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{d.title}</div>
                        <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "#A8A3BC" }}>{d.category}{d.year ? ` · ${d.year}` : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, count }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 6,
      background: active ? "rgba(212,169,75,0.14)" : "transparent",
      border: "none", cursor: "pointer", textAlign: "left",
      color: active ? GOLD : "#C7C2D6", fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 13.5, fontWeight: active ? 700 : 400,
    }}>
      <Icon size={15} />
      <span style={{ flex: 1 }}>{label}</span>
      {count > 0 && <span style={{ fontSize: 11, color: "#6C6880" }}>{count}</span>}
    </button>
  );
}

function Header({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#8B8699" }}>{subtitle}</div>
    </div>
  );
}

function Tag({ label }) {
  return (
    <span style={{ fontFamily: "sans-serif", fontSize: 11, color: TEAL, background: "rgba(94,200,192,0.12)", border: `1px solid rgba(94,200,192,0.3)`, borderRadius: 4, padding: "2px 7px" }}>{label}</span>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: "#141220", border: `1px solid ${LINE}`, borderRadius: 6,
  padding: "9px 12px", color: INK, fontSize: 14, fontFamily: "'Helvetica Neue', Arial, sans-serif", outline: "none",
};

function primaryBtn(disabled) {
  return {
    marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, background: disabled ? "#5A4C29" : GOLD,
    color: "#1C1608", border: "none", borderRadius: 6, padding: "9px 16px", fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 13.5, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}
function secondaryBtn(disabled) {
  return {
    display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", color: TEAL,
    border: `1px solid ${TEAL}`, borderRadius: 6, padding: "8px 16px", fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 13.5, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
  };
}
