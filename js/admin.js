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
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
const views = { posts: null, new: null, analytics: null };

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
    const tags = (post.tags || [])
      .map(t => `<span class="tag-cell">${escapeHtml(t)}</span>`)
      .join("");
    const statusBadge = `<span class="status-badge ${post.status}">${post.status}</span>`;
    const viewUrl = `/post.html?id=${post.id}`;

    return `
      <tr>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(post.title)}">
          ${escapeHtml(post.title)}
        </td>
        <td><div class="post-tags-cell">${tags || "—"}</div></td>
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

  // Attach events
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
// EDITOR — SLUG AUTO-GENERATE
// ============================================================
const titleInput = document.getElementById("postTitleInput");
const slugInput = document.getElementById("postSlugInput");
let slugManuallyEdited = false;

titleInput.addEventListener("input", () => {
  if (!slugManuallyEdited) {
    slugInput.value = slugify(titleInput.value);
  }
  updateSeoPreview();
});
slugInput.addEventListener("input", () => {
  slugManuallyEdited = true;
});
document.getElementById("postExcerptInput").addEventListener("input", updateSeoPreview);

function updateSeoPreview() {
  document.getElementById("seoTitle").textContent = titleInput.value || "Post title";
  document.getElementById("seoDesc").textContent =
    document.getElementById("postExcerptInput").value || "Post excerpt will appear here...";
}

// ============================================================
// EDITOR — MARKDOWN PREVIEW
// ============================================================
let previewMode = false;
const editorTextarea = document.getElementById("postContentInput");
const editorPreview = document.getElementById("editorPreview");

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
    const md = btn.dataset.md;
    const ta = editorTextarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.substring(start, end);
    let insert = "";
    if (md.includes("$1")) {
      insert = md.replace("$1", sel);
    } else if (sel) {
      if (md === "**bold**") insert = `**${sel}**`;
      else if (md === "_italic_") insert = `_${sel}_`;
      else if (md === "`code`") insert = `\`${sel}\``;
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
  // Reuse same logic as post.js
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
// COVER IMAGE PREVIEW
// ============================================================
document.getElementById("postCoverInput").addEventListener("input", e => {
  const url = e.target.value.trim();
  const preview = document.getElementById("coverPreview");
  if (url) {
    preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Cover preview" onerror="this.parentElement.innerHTML=''" />`;
  } else {
    preview.innerHTML = "";
  }
});

// ============================================================
// LOAD POST FOR EDITING
// ============================================================
async function loadPostForEdit(id) {
  try {
    const docRef = doc(db, "posts", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) { showToast("Post not found", "error"); return; }

    const post = snap.data();
    editingPostId = id;
    slugManuallyEdited = true;
    tags = post.tags || [];

    document.getElementById("editPostId").value = id;
    document.getElementById("postTitleInput").value = post.title || "";
    document.getElementById("postSlugInput").value = post.slug || id;
    document.getElementById("postExcerptInput").value = post.excerpt || "";
    document.getElementById("postCoverInput").value = post.coverImage || "";
    document.getElementById("postContentInput").value = post.content || "";
    document.getElementById("postStatusInput").value = post.status || "draft";

    if (post.coverImage) {
      document.getElementById("coverPreview").innerHTML =
        `<img src="${escapeHtml(post.coverImage)}" alt="Cover" onerror="this.parentElement.innerHTML=''" />`;
    }

    renderTagsList();
    updateSeoPreview();

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
  editingPostId = null;
  slugManuallyEdited = false;
  tags = [];
  document.getElementById("editPostId").value = "";
  document.getElementById("postTitleInput").value = "";
  document.getElementById("postSlugInput").value = "";
  document.getElementById("postExcerptInput").value = "";
  document.getElementById("postCoverInput").value = "";
  document.getElementById("postContentInput").value = "";
  document.getElementById("postStatusInput").value = "draft";
  document.getElementById("coverPreview").innerHTML = "";
  renderTagsList();
  updateSeoPreview();
  previewMode = false;
  editorTextarea.classList.remove("hidden");
  editorPreview.classList.add("hidden");
  document.getElementById("previewToggle").textContent = "Preview";
}

// ============================================================
// SAVE POST
// ============================================================
async function savePost(status) {
  const title = document.getElementById("postTitleInput").value.trim();
  const slug = document.getElementById("postSlugInput").value.trim();
  const excerpt = document.getElementById("postExcerptInput").value.trim();
  const coverImage = document.getElementById("postCoverInput").value.trim();
  const content = document.getElementById("postContentInput").value.trim();

  if (!title) { showToast("Title is required", "error"); return; }
  if (!content) { showToast("Content is required", "error"); return; }

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
      // UPDATE
      if (status === "published" && !postData.publishedAt) {
        // Only set publishedAt if being published for the first time
        const existing = await getDoc(doc(db, "posts", editingPostId));
        if (existing.data()?.status !== "published") {
          postData.publishedAt = now;
        }
      }
      await updateDoc(doc(db, "posts", editingPostId), postData);
      showToast(status === "published" ? "Post published!" : "Draft saved!");
    } else {
      // CREATE
      if (status === "published") postData.publishedAt = now;
      postData.createdAt = now;
      const newDoc = await addDoc(collection(db, "posts"), postData);
      editingPostId = newDoc.id;
      document.getElementById("editPostId").value = newDoc.id;
      showToast(status === "published" ? "Post published!" : "Draft saved!");
    }

    // Refresh posts list
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
  const total = allPosts.length;
  const published = allPosts.filter(p => p.status === "published").length;
  const drafts = total - published;
  const allTags = new Set(allPosts.flatMap(p => p.tags || []));

  document.getElementById("statTotalPosts").textContent = total;
  document.getElementById("statPublished").textContent = published;
  document.getElementById("statDrafts").textContent = drafts;
  document.getElementById("statTags").textContent = allTags.size;

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
