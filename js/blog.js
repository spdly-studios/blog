// blog.js — Main blog page logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

// ============================================================
// FIREBASE INIT — Replace with your config
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
const analytics = getAnalytics(app);

// ============================================================
// STATE
// ============================================================
const PAGE_SIZE = 9;
let allPosts = [];
let filteredPosts = [];
let visibleCount = PAGE_SIZE;
let activeTag = "all";
let searchQuery = "";
let lastDoc = null;
let loading = false;

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
// HELPERS
// ============================================================
function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function estimateReadTime(content) {
  if (!content) return 1;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ============================================================
// RENDER POST CARD
// ============================================================
function renderCard(post) {
  const id = post.id;
  const url = `/post.html?id=${id}`;
  const cover = post.coverImage
    ? `<img class="post-card-cover" src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}" loading="lazy" />`
    : "";
  const tags = (post.tags || [])
    .map(t => `<span class="post-tag">${escapeHtml(t)}</span>`)
    .join("");
  const readTime = estimateReadTime(post.content);

  return `
    <a class="post-card" href="${url}" data-id="${id}">
      ${cover}
      <div class="post-card-tags">${tags}</div>
      <div class="post-card-title">${escapeHtml(post.title)}</div>
      <div class="post-card-excerpt">${escapeHtml(post.excerpt || "")}</div>
      <div class="post-card-footer">
        <span class="post-card-date">${formatDate(post.publishedAt || post.createdAt)}</span>
        <span class="post-card-meta">${readTime} min read</span>
        <span class="post-card-arrow">→</span>
      </div>
    </a>
  `;
}

// ============================================================
// RENDER POSTS
// ============================================================
function renderPosts() {
  const grid = document.getElementById("postsGrid");
  const emptyState = document.getElementById("emptyState");
  const loadMoreWrap = document.getElementById("loadMoreWrap");
  const postsMeta = document.getElementById("postsCount");

  const toShow = filteredPosts.slice(0, visibleCount);

  if (filteredPosts.length === 0) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
    loadMoreWrap.classList.add("hidden");
    postsMeta.textContent = "0 posts";
    return;
  }

  emptyState.classList.add("hidden");
  grid.innerHTML = toShow.map(renderCard).join("");
  postsMeta.textContent = `${filteredPosts.length} post${filteredPosts.length !== 1 ? "s" : ""}`;
  loadMoreWrap.classList.toggle("hidden", visibleCount >= filteredPosts.length);
}

// ============================================================
// FILTER + SEARCH
// ============================================================
function applyFilters() {
  visibleCount = PAGE_SIZE;
  filteredPosts = allPosts.filter(post => {
    const matchTag = activeTag === "all" || (post.tags || []).includes(activeTag);
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || (post.title || "").toLowerCase().includes(q)
      || (post.excerpt || "").toLowerCase().includes(q)
      || (post.tags || []).some(t => t.toLowerCase().includes(q))
      || (post.content || "").toLowerCase().includes(q);
    return matchTag && matchSearch;
  });
  renderPosts();

  if (searchQuery) {
    logEvent(analytics, "search", { search_term: searchQuery });
  }
}

// ============================================================
// TAGS
// ============================================================
function buildTags() {
  const tagSet = new Set();
  allPosts.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));

  const container = document.getElementById("tagsContainer");
  const allBtn = container.querySelector('[data-tag="all"]');

  tagSet.forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "tag-btn";
    btn.dataset.tag = tag;
    btn.textContent = tag;
    container.appendChild(btn);
  });

  container.addEventListener("click", e => {
    const btn = e.target.closest(".tag-btn");
    if (!btn) return;
    container.querySelectorAll(".tag-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeTag = btn.dataset.tag;
    applyFilters();
  });
}

// ============================================================
// SEARCH
// ============================================================
const searchInput = document.getElementById("searchInput");
let searchTimer;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    applyFilters();
  }, 220);
});

searchInput.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    searchInput.value = "";
    searchQuery = "";
    applyFilters();
  }
});

window.clearSearch = function () {
  searchInput.value = "";
  searchQuery = "";
  applyFilters();
};

// ============================================================
// LOAD MORE
// ============================================================
document.getElementById("loadMoreBtn").addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderPosts();
  logEvent(analytics, "load_more_posts");
});

// ============================================================
// FETCH POSTS
// ============================================================
async function fetchPosts() {
  try {
    const q = query(
      collection(db, "posts"),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
      limit(100)
    );
    const snap = await getDocs(q);
    allPosts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    buildTags();
    applyFilters();

    logEvent(analytics, "page_view", {
      page_title: "Blog Home",
      page_location: window.location.href
    });
  } catch (err) {
    console.error("Error fetching posts:", err);
    document.getElementById("postsGrid").innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem 0;color:var(--text-3);font-family:var(--font-mono);font-size:0.85rem;">
        Failed to load posts. Check your Firebase config.
      </div>`;
    document.getElementById("postsCount").textContent = "Error loading posts";
  }
}

fetchPosts();
