// admin.js — Full admin dashboard with CRUD operations
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ============================================================
// FIREBASE INIT
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyA3PFKO5piv3RM3f9PtaAleYA_g7TOLxYk",
  authDomain:        "spdly-website.firebaseapp.com",
  projectId:         "spdly-website",
  storageBucket:     "spdly-website.firebasestorage.app",
  messagingSenderId: "272994532908",
  appId:             "1:272994532908:web:8852742525c619c1cbdb89",
  measurementId:     "G-NEDDRR1XT7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ============================================================
// THEME
// ============================================================
(function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
})();

document.getElementById("themeToggle").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

// ============================================================
// STATE
// ============================================================
let allPosts = [];
let tags = [];
let deleteTargetId = null;
let editingPostId = null;
let adminFilterStatus = "all";
let adminSearch = "";

// ============================================================
// AUTH GUARD
// ============================================================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("/admin/");
    return;
  }
  document.getElementById("authLoading").classList.add("hidden");
  document.getElementById("adminLayout").classList.remove("hidden");
  document.getElementById("adminEmail").textContent = user.email;
  init();
});

// ============================================================
// SIGN OUT
// ============================================================
document.getElementById("signOutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("/admin/");
});

// ============================================================
// TOAST
// ============================================================
let toastTimer;
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 3500);
}

// ============================================================
// NAVIGATION
// ============================================================
function switchView(name) {
  document.querySelectorAll(".admin-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.getElementById(`view-${name}`).classList.add("active");
  document.querySelector(`[data-view="${name}"]`).classList.add("active");
  document.getElementById("adminPageTitle").textContent =
    name === "posts" ? "Posts" : name === "new" ? (editingPostId ? "Edit Post" : "New Post") : "Analytics";
  closeSidebar();
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    if (view === "new") {
      resetEditor();
      editingPostId = null;
    }
    if (view === "analytics") loadAnalytics();
    switchView(view);
  });
});

// SIDEBAR MOBILE
document.getElementById("hamburgerBtn").addEventListener("click", () => {
  document.getElementById("adminSidebar").classList.add("open");
});
document.getElementById("sidebarClose").addEventListener("click", closeSidebar);
function closeSidebar() {
  document.getElementById("adminSidebar").classList.remove("open");
}

// ============================================================
// HELPERS
// ============================================================
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ============================================================
// COVER IMAGE URL AUTO-GENERATION
// Format: https://raw.githubusercontent.com/spdly-studios/blog-assets/
//         refs/heads/main/{ddmmyyyy}/{slug}.png
// ============================================================
const GITHUB_BASE = "https://raw.githubusercontent.com/spdly-studios/blog-assets/refs/heads/main";

let coverManuallyEdited = false;
// Stores the date prefix to use — set once when a new post session starts
let postDatePrefix = getTodayDDMMYYYY();

function getTodayDDMMYYYY() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

function generateCoverUrl(slug) {
  if (!slug) return "";
  return `${GITHUB_BASE}/${postDatePrefix}/${slug}.png`;
}

function syncCoverUrl() {
  const slug = document.getElementById("postSlugInput").value.trim();
  const url = generateCoverUrl(slug);
  const coverInput = document.getElementById("postCoverInput");
  const coverHint = document.getElementById("coverUrlHint");

  if (!slug) {
    if (!coverManuallyEdited) coverInput.value = "";
    coverHint.textContent = "Cover image URL auto-generates once the slug is set.";
    updateCoverPreview(coverInput.value.trim());
    return;
  }

  coverHint.textContent = `Auto URL: ${url}`;
  if (!coverManuallyEdited || !coverInput.value.trim()) {
    coverInput.value = url;
    updateCoverPreview(url);
  }
}

function updateCoverPreview(url) {
  const preview = document.getElementById("coverPreview");
  if (url) {
    preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Cover preview" onerror="this.parentElement.innerHTML='<span class=cover-error>Image not found at this URL</span>'" />`;
  } else {
    preview.innerHTML = "";
  }
}

function cleanTextForSummary(text) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#>*\-+]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generateOneLineSummary(title, content) {
  const raw = `${title} ${content}`.trim();
  const clean = cleanTextForSummary(raw);
  if (!clean) return "";

  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  let summary = sentences[0].trim();

  if (summary.length > 140) {
    const truncated = summary.slice(0, 140);
    const lastSpace = truncated.lastIndexOf(" ");
    summary = (lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trim();
    summary += "...";
  }

  if (summary.length < 25 && clean.length > summary.length) {
    const fallback = clean.slice(0, 120);
    const lastSpace = fallback.lastIndexOf(" ");
    summary = `${fallback.slice(0, lastSpace)}...`;
  }

  return summary;
}

function updateContentMetrics() {
  const content = document.getElementById("postContentInput").value.trim();
  const words = content ? content.replace(/\n/g, " ").trim().split(/\s+/).filter(Boolean).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 180));
  document.getElementById("wordCountIndicator").textContent = `${words} word${words === 1 ? "" : "s"}`;
  document.getElementById("readingTimeIndicator").textContent = `${minutes} min read`;
}

// Mark cover as manually edited when the user types in it
document.getElementById("postCoverInput").addEventListener("input", e => {
  coverManuallyEdited = true;
  updateCoverPreview(e.target.value.trim());
  const coverHint = document.getElementById("coverUrlHint");
  coverHint.textContent = "Manual cover URL override active. Click Reset to restore the auto-generated URL.";
});

// Refresh button — re-generate URL discarding manual edit
document.getElementById("coverRefreshBtn").addEventListener("click", () => {
  coverManuallyEdited = false;
  syncCoverUrl();
  showToast("Cover URL regenerated");
});

// ============================================================
// FETCH ALL POSTS
// ============================================================
async function fetchAllPosts() {
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPostsTable();
  } catch (err) {
    console.error("Fetch error:", err);
    showToast("Error loading posts", "error");
  }
}

// ============================================================
// POSTS TABLE
// ============================================================
function getFilteredPosts() {
  return allPosts.filter(p => {
    const matchStatus = adminFilterStatus === "all" || p.status === adminFilterStatus;
    const q = adminSearch.toLowerCase();
    const matchSearch = !q ||
      (p.title || "").toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });
}

function renderPostsTable() {
  const tbody = document.getElementById("adminPostsTable");
  const posts = getFilteredPosts();

  if (posts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No posts found.</td></tr>`;
    return;
  }

  tbody.innerHTML = posts.map(post => {
    const tagHtml = (post.tags || [])
      .map(t => `<span class="tag-cell">${escapeHtml(t)}</span>`)
      .join("");
    const statusBadge = `<span class="status-badge ${post.status}">${post.status}</span>`;
    const viewUrl = `/post.html?id=${post.id}`;

    return `
      <tr>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(post.title)}">
          ${escapeHtml(post.title)}
        </td>
        <td><div class="post-tags-cell">${tagHtml || "—"}</div></td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap;">${formatDate(post.publishedAt || post.createdAt)}</td>
        <td>
          <div class="table-actions">
            <button class="btn-edit" data-id="${post.id}">Edit</button>
            <a class="btn-view-post" href="${viewUrl}" target="_blank">View ↗</a>
            <button class="btn-delete" data-id="${post.id}" data-title="${escapeHtml(post.title)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => loadPostForEdit(btn.dataset.id));
  });
  tbody.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, btn.dataset.title));
  });
}

// SEARCH + FILTER
document.getElementById("adminSearch").addEventListener("input", e => {
  adminSearch = e.target.value.trim();
  renderPostsTable();
});

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    adminFilterStatus = btn.dataset.filter;
    renderPostsTable();
  });
});

// ============================================================
// EDITOR — TAGS
// ============================================================
function renderTagsList() {
  const list = document.getElementById("tagsList");
  list.innerHTML = tags.map(t => `
    <span class="tag-item">
      ${escapeHtml(t)}
      <button data-tag="${escapeHtml(t)}" aria-label="Remove tag">✕</button>
    </span>
  `).join("");
  list.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => removeTag(btn.dataset.tag));
  });
}

function addTag(tag) {
  const clean = tag.toLowerCase().trim().replace(/\s+/g, "-");
  if (clean && !tags.includes(clean)) {
    tags.push(clean);
    renderTagsList();
  }
}

function removeTag(tag) {
  tags = tags.filter(t => t !== tag);
  renderTagsList();
}

document.getElementById("tagInput").addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, "");
    if (val) addTag(val);
    e.target.value = "";
  }
});

document.querySelectorAll(".tag-pill-btn").forEach(btn => {
  btn.addEventListener("click", () => addTag(btn.dataset.tag));
});

// ============================================================
// AUTO-TAGGER — Keyword analysis
// ============================================================
const TAG_RULES = {
  "engineering": [
    "engineer", "architect", "architecture", "system design", "backend", "frontend",
    "software", "build", "compile", "deploy", "ci/cd", "pipeline", "microservice",
    "monolith", "refactor", "codebase", "scalability", "performance", "latency",
    "cache", "database", "server", "infra", "infrastructure"
  ],
  "algorithms": [
    "algorithm", "complexity", "o(n)", "big o", "sort", "search", "graph",
    "tree", "dynamic programming", "recursion", "binary", "hash", "heap",
    "bfs", "dfs", "greedy", "divide and conquer", "data structure", "optimization"
  ],
  "devlog": [
    "devlog", "today i", "this week", "working on", "progress update",
    "sprint", "milestone", "shipped", "just pushed", "day ", "week ",
    "building my", "making a", "started", "finished", "completed", "launch"
  ],
  "discovery": [
    "discover", "found out", "realized", "interesting", "learned",
    "didn't know", "surprising", "unexpected", "rabbit hole", "turns out",
    "fascinating", "fun fact", "came across", "stumbled", "insight"
  ],
  "tools": [
    "tool", "cli", "utility", "plugin", "extension", "library", "framework",
    "package", "npm", "pip", "brew", "cargo", "workflow", "automation",
    "makefile", "dockerfile", "config", "dotfile", "script", "editor"
  ],
  "web": [
    "html", "css", "javascript", "browser", "http", "api", "rest", "graphql",
    "dom", "react", "vue", "angular", "nextjs", "svelte", "astro",
    "typescript", "jsx", "tsx", "tailwind", "fetch", "cors", "webhook",
    "firebase", "vercel", "netlify", "cloudflare", "frontend", "backend", "responsive"
  ],
  "linux": [
    "linux", "bash", "shell", "terminal", "unix", "grep", "awk", "sed",
    "systemd", "kernel", "debian", "ubuntu", "arch", "fedora", "chmod",
    "crontab", "tmux", "vim", "neovim", "zsh", "fish", "posix", "bashrc"
  ],
  "networks": [
    "network", "tcp", "udp", "ip", "dns", "http", "socket", "protocol",
    "packet", "firewall", "proxy", "vpn", "bandwidth", "latency", "ping",
    "ssl", "tls", "certificate", "cdn", "nginx", "reverse proxy", "load balancer"
  ],
  "security": [
    "security", "auth", "authentication", "authorization", "encryption",
    "vulnerability", "xss", "csrf", "csp", "secure", "ssl", "tls", "audit"
  ],
  "cloud": [
    "cloud", "aws", "azure", "gcp", "serverless", "kubernetes", "docker",
    "containers", "infrastructure", "terraform", "ci/cd", "deployment", "docker-compose"
  ]
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "about",
  "when", "where", "which", "while", "your", "their", "there", "then",
  "what", "will", "can", "have", "has", "had", "not", "but", "are",
  "was", "were", "been", "being", "its", "also", "more", "most", "some",
  "such", "than", "them", "they", "these", "those", "using", "used",
  "use", "into", "over", "under", "after", "before", "because", "through"
]);

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function phrasePresent(fullText, phrase) {
  const cleaned = phrase.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  if (!cleaned) return false;
  const regex = new RegExp(`\\b${cleaned.replace(/\\s+/g, "\\s+")}\\b`, "i");
  return regex.test(fullText);
}

function scoreTagsFromContent(title, excerpt, content) {
  const text = `${title} ${excerpt} ${content}`.toLowerCase();
  const words = normalizeText(text);
  const counts = words.reduce((acc, word) => {
    if (!STOP_WORDS.has(word) && word.length > 2) {
      acc[word] = (acc[word] || 0) + 1;
    }
    return acc;
  }, {});

  const suggestions = [];

  for (const [tag, keywords] of Object.entries(TAG_RULES)) {
    let score = 0;

    if (phrasePresent(title, tag)) score += 4;
    if (phrasePresent(excerpt, tag)) score += 2;

    for (const keyword of keywords) {
      if (phrasePresent(text, keyword)) {
        score += 2;
      }
      const normalized = keyword.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
      if (normalized && counts[normalized]) {
        score += counts[normalized];
      }
    }

    if (score > 0) {
      suggestions.push({ tag, score });
    }
  }

  return { suggestions, counts };
}

function extractCustomTags(counts) {
  return Object.entries(counts)
    .filter(([word, frequency]) => frequency >= 3 && word.length > 4 && !Object.keys(TAG_RULES).includes(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
}

function inferTagsFromContent(title, content, excerpt = "") {
  const { suggestions, counts } = scoreTagsFromContent(title, excerpt, content);

  const ordered = suggestions
    .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
    .slice(0, 5)
    .map(item => item.tag);

  if (ordered.length >= 2) {
    return ordered;
  }

  const custom = extractCustomTags(counts);
  const fallback = [...ordered, ...custom].slice(0, 6);

  if (fallback.length) {
    return fallback;
  }

  const titleWords = normalizeText(title).filter(word => word.length > 3 && !STOP_WORDS.has(word));
  return titleWords.slice(0, 3).map(word => word.replace(/\s+/g, "-"));
}

function getTopKeywords(text, limit = 3) {
  const words = normalizeText(text);
  const counts = words.reduce((acc, word) => {
    if (!STOP_WORDS.has(word) && word.length > 3) {
      acc[word] = (acc[word] || 0) + 1;
    }
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function getSummarySentences(content) {
  const clean = cleanTextForSummary(content);
  if (!clean) return [];
  return clean.match(/[^.!?]+[.!?]+/g) || [clean];
}

function smartTruncate(text, maxLength = 130) {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 30 ? lastSpace : maxLength).trim()}...`;
}

function autoTagPost() {
  const title   = document.getElementById("postTitleInput").value.trim();
  const content = document.getElementById("postContentInput").value.trim();
  const excerpt = document.getElementById("postExcerptInput").value.trim();

  if (!title && !content) {
    showToast("Add a title or content first", "error");
    return;
  }

  const suggested = inferTagsFromContent(title, content, excerpt);
  if (!suggested.length) {
    showToast("No relevant tags inferred; try adding keywords", "error");
    return;
  }

  let added = 0;
  suggested.forEach(tag => {
    const clean = tag.toLowerCase().trim().replace(/\s+/g, "-");
    if (clean && !tags.includes(clean)) {
      tags.push(clean);
      added++;
    }
  });

  renderTagsList();
  showToast(added ? `Added ${added} tag${added > 1 ? "s" : ""}` : "Suggested tags already present");
}

function autoSummaryPost() {
  const title   = document.getElementById("postTitleInput").value.trim();
  const content = document.getElementById("postContentInput").value.trim();
  const excerpt = document.getElementById("postExcerptInput").value.trim();

  if (!title && !content) {
    showToast("Add a title or content first", "error");
    return;
  }

  const summary = generateOneLineSummary(title, content, excerpt);
  if (!summary) {
    showToast("Could not generate a one-line summary", "error");
    return;
  }

  document.getElementById("postExcerptInput").value = summary;
  updateSeoPreview();
  showToast("One-line summary generated");
}

document.getElementById("autoTagBtn").addEventListener("click", autoTagPost);
document.getElementById("autoSummaryBtn").addEventListener("click", autoSummaryPost);

// ============================================================
// EDITOR — SLUG AUTO-GENERATE
// ============================================================
const titleInput = document.getElementById("postTitleInput");
const slugInput  = document.getElementById("postSlugInput");
let slugManuallyEdited = false;

titleInput.addEventListener("input", () => {
  if (!slugManuallyEdited) {
    slugInput.value = slugify(titleInput.value);
    syncCoverUrl();
  }
  updateSeoPreview();
});

slugInput.addEventListener("input", () => {
  slugManuallyEdited = true;
  syncCoverUrl();
  updateSeoPreview();
});

document.getElementById("postExcerptInput").addEventListener("input", updateSeoPreview);
document.getElementById("postContentInput").addEventListener("input", () => {
  updateContentMetrics();
  updateSeoPreview();
});

function updateSeoPreview() {
  const slug = slugInput.value.trim() || "post";
  document.querySelector(".seo-url").textContent = `blog.spdly.is-a.dev › ${slug}`;
  document.getElementById("seoTitle").textContent =
    titleInput.value || "Post title";
  document.getElementById("seoDesc").textContent =
    document.getElementById("postExcerptInput").value || "Post excerpt will appear here...";
}

// ============================================================
// EDITOR — MARKDOWN PREVIEW
// ============================================================
let previewMode = false;
const editorTextarea = document.getElementById("postContentInput");
const editorPreview  = document.getElementById("editorPreview");

document.getElementById("previewToggle").addEventListener("click", () => {
  previewMode = !previewMode;
  if (previewMode) {
    editorPreview.innerHTML = renderMarkdownAdmin(editorTextarea.value);
    editorTextarea.classList.add("hidden");
    editorPreview.classList.remove("hidden");
    document.getElementById("previewToggle").textContent = "Edit";
  } else {
    editorTextarea.classList.remove("hidden");
    editorPreview.classList.add("hidden");
    document.getElementById("previewToggle").textContent = "Preview";
  }
});

// Toolbar buttons
document.querySelectorAll(".toolbar-btn[data-md]").forEach(btn => {
  btn.addEventListener("click", () => {
    const md  = btn.dataset.md;
    const ta  = editorTextarea;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = ta.value.substring(start, end);
    let insert  = "";
    if (md.includes("$1")) {
      insert = md.replace("$1", sel);
    } else if (sel) {
      if (md === "**bold**")       insert = `**${sel}**`;
      else if (md === "_italic_")  insert = `_${sel}_`;
      else if (md === "`code`")    insert = `\`${sel}\``;
      else if (md === "[text](url)") insert = `[${sel}](url)`;
      else insert = md + sel;
    } else {
      insert = md;
    }
    ta.setRangeText(insert, start, end, "end");
    ta.focus();
  });
});

// Lightweight markdown for preview in admin
function renderMarkdownAdmin(md) {
  if (!md) return "<p style='color:var(--text-3)'>Nothing to preview yet...</p>";
  let html = md
    .replace(/&(?!amp;|lt;|gt;)/g, "&amp;")
    .replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code>${code.replace(/</g, "&lt;")}</code></pre>`)
    .replace(/^###### (.+)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.+)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\s*[-*+] (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<)(.+)$/gm, "<p>$1</p>");
  html = html.replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/gs, "<ul>$1</ul>");
  return `<div class="post-body">${html}</div>`;
}

// ============================================================
// LOAD POST FOR EDITING
// ============================================================
async function loadPostForEdit(id) {
  try {
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) { showToast("Post not found", "error"); return; }

    const post = snap.data();
    editingPostId = id;
    slugManuallyEdited = true;
    coverManuallyEdited = true; // existing post — keep its cover URL as-is
    tags = post.tags || [];

    // Extract date prefix from existing cover URL if possible, so refresh works correctly
    if (post.coverImage) {
      const match = post.coverImage.match(/\/main\/(\d{8})\//);
      if (match) postDatePrefix = match[1];
    }

    document.getElementById("editPostId").value       = id;
    document.getElementById("postTitleInput").value   = post.title || "";
    document.getElementById("postSlugInput").value    = post.slug || id;
    document.getElementById("postExcerptInput").value = post.excerpt || "";
    document.getElementById("postCoverInput").value   = post.coverImage || "";
    document.getElementById("postContentInput").value = post.content || "";
    document.getElementById("postStatusInput").value  = post.status || "draft";

    updateCoverPreview(post.coverImage || "");
    renderTagsList();
    updateSeoPreview();
    updateContentMetrics();
    syncCoverUrl();

    // Reset preview mode
    previewMode = false;
    editorTextarea.classList.remove("hidden");
    editorPreview.classList.add("hidden");
    document.getElementById("previewToggle").textContent = "Preview";

    document.getElementById("adminPageTitle").textContent = "Edit Post";
    switchView("new");
  } catch (err) {
    console.error("Load for edit error:", err);
    showToast("Error loading post for editing", "error");
  }
}

// ============================================================
// RESET EDITOR
// ============================================================
function resetEditor() {
  editingPostId       = null;
  slugManuallyEdited  = false;
  coverManuallyEdited = false;
  postDatePrefix      = getTodayDDMMYYYY(); // fresh date for new post
  tags = [];
  document.getElementById("editPostId").value       = "";
  document.getElementById("postTitleInput").value   = "";
  document.getElementById("postSlugInput").value    = "";
  document.getElementById("postExcerptInput").value = "";
  document.getElementById("postCoverInput").value   = "";
  document.getElementById("postContentInput").value = "";
  document.getElementById("postStatusInput").value  = "draft";
  document.getElementById("coverPreview").innerHTML = "";
  renderTagsList();
  updateSeoPreview();
  updateContentMetrics();
  syncCoverUrl();
  previewMode = false;
  editorTextarea.classList.remove("hidden");
  editorPreview.classList.add("hidden");
  document.getElementById("previewToggle").textContent = "Preview";
}

// ============================================================
// SAVE POST
// ============================================================
async function savePost(status) {
  const title      = document.getElementById("postTitleInput").value.trim();
  let slug         = document.getElementById("postSlugInput").value.trim();
  let excerpt      = document.getElementById("postExcerptInput").value.trim();
  let coverImage   = document.getElementById("postCoverInput").value.trim();
  const content    = document.getElementById("postContentInput").value.trim();

  if (!title)   { showToast("Title is required", "error"); return; }
  if (!content) { showToast("Content is required", "error"); return; }

  if (!slug) {
    slug = slugify(title);
    document.getElementById("postSlugInput").value = slug;
  }

  if (!excerpt) {
    excerpt = generateOneLineSummary(title, content);
    document.getElementById("postExcerptInput").value = excerpt;
  }

  if (!coverImage && slug) {
    coverImage = generateCoverUrl(slug);
    if (!coverManuallyEdited) {
      document.getElementById("postCoverInput").value = coverImage;
      updateCoverPreview(coverImage);
    }
  }

  const btn = status === "published"
    ? document.getElementById("publishBtn")
    : document.getElementById("saveDraftBtn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const now = serverTimestamp();
    const postData = {
      title,
      slug: slug || slugify(title),
      excerpt,
      coverImage,
      content,
      tags,
      status,
      updatedAt: now,
    };

    if (editingPostId) {
      const existing = await getDoc(doc(db, "posts", editingPostId));
      const previousStatus = existing.data()?.status;

      if (status === "published") {
        if (previousStatus !== "published") {
          postData.publishedAt = now;
        }
      } else if (previousStatus === "published") {
        postData.publishedAt = deleteField();
      }

      await updateDoc(doc(db, "posts", editingPostId), postData);
      document.getElementById("postStatusInput").value = status;
      showToast(status === "published" ? "Post published!" : "Draft saved!");
    } else {
      if (status === "published") postData.publishedAt = now;
      postData.createdAt = now;
      const newDoc = await addDoc(collection(db, "posts"), postData);
      editingPostId = newDoc.id;
      document.getElementById("editPostId").value = newDoc.id;
      document.getElementById("postStatusInput").value = status;
      showToast(status === "published" ? "Post published!" : "Draft saved!");
    }

    await fetchAllPosts();

  } catch (err) {
    console.error("Save error:", err);
    showToast("Error saving post: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

document.getElementById("publishBtn").addEventListener("click", () => savePost("published"));
document.getElementById("saveDraftBtn").addEventListener("click", () => savePost("draft"));

document.getElementById("cancelEditBtn").addEventListener("click", () => {
  resetEditor();
  switchView("posts");
});

// ============================================================
// DELETE POST
// ============================================================
function openDeleteModal(id, title) {
  deleteTargetId = id;
  document.getElementById("deleteModalBody").textContent =
    `"${title}" will be permanently deleted. This cannot be undone.`;
  document.getElementById("deleteModal").classList.remove("hidden");
}

document.getElementById("deleteCancelBtn").addEventListener("click", () => {
  document.getElementById("deleteModal").classList.add("hidden");
  deleteTargetId = null;
});

document.getElementById("deleteModal").addEventListener("click", e => {
  if (e.target === document.getElementById("deleteModal")) {
    document.getElementById("deleteModal").classList.add("hidden");
    deleteTargetId = null;
  }
});

document.getElementById("deleteConfirmBtn").addEventListener("click", async () => {
  if (!deleteTargetId) return;
  const btn = document.getElementById("deleteConfirmBtn");
  btn.disabled = true;
  btn.textContent = "Deleting...";

  try {
    await deleteDoc(doc(db, "posts", deleteTargetId));
    allPosts = allPosts.filter(p => p.id !== deleteTargetId);
    renderPostsTable();
    showToast("Post deleted.");
  } catch (err) {
    showToast("Error deleting post", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Delete";
    document.getElementById("deleteModal").classList.add("hidden");
    deleteTargetId = null;
  }
});

// ============================================================
// ANALYTICS VIEW
// ============================================================
function loadAnalytics() {
  const total     = allPosts.length;
  const published = allPosts.filter(p => p.status === "published").length;
  const drafts    = total - published;
  const allTags   = new Set(allPosts.flatMap(p => p.tags || []));

  document.getElementById("statTotalPosts").textContent = total;
  document.getElementById("statPublished").textContent  = published;
  document.getElementById("statDrafts").textContent     = drafts;
  document.getElementById("statTags").textContent       = allTags.size;

  const recent = [...allPosts].slice(0, 8);
  document.getElementById("recentPostsList").innerHTML = recent.map(p => `
    <div class="recent-post-item">
      <span class="recent-post-title">${escapeHtml(p.title)}</span>
      <span class="status-badge ${p.status}">${p.status}</span>
      <span class="recent-post-date">${formatDate(p.publishedAt || p.createdAt)}</span>
    </div>
  `).join("");
}

// ============================================================
// INIT
// ============================================================
async function init() {
  await fetchAllPosts();
}