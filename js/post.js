// post.js — Individual post page logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
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
// READING PROGRESS
// ============================================================
function initReadingProgress() {
  const bar = document.getElementById("readingProgress");
  window.addEventListener("scroll", () => {
    const article = document.getElementById("postContent");
    if (!article) return;
    const rect = article.getBoundingClientRect();
    const total = article.offsetHeight - window.innerHeight;
    const scrolled = Math.max(0, -rect.top);
    const pct = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
    bar.style.width = pct + "%";
  }, { passive: true });
}

// ============================================================
// MARKDOWN RENDERER (lightweight, no dependencies)
// ============================================================
function renderMarkdown(md) {
  if (!md) return "";
  let html = md
    // Escape HTML entities first (but protect existing)
    .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;")
    // Fenced code blocks
    .replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang || "text"}">${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
    })
    // Headers
    .replace(/^###### (.+)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.+)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Images (before links)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Unordered lists
    .replace(/^\s*[-*+] (.+)$/gm, "<li>$1</li>")
    // Ordered lists
    .replace(/^\s*\d+\. (.+)$/gm, "<oli>$1</oli>")
    // Paragraphs (blank line separation)
    .replace(/\n\n+/g, "\n\n")
    // Line breaks
    .replace(/([^\n>])\n([^\n<#])/g, "$1<br>$2");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/gs, "<ul>$1</ul>");
  // Wrap consecutive <oli> in <ol>
  html = html.replace(/(<oli>.*?<\/oli>(\s*<oli>.*?<\/oli>)*)/gs, (match) => {
    return "<ol>" + match.replace(/<\/?oli>/g, m => m.replace("oli", "li")) + "</ol>";
  });

  // Paragraphs: wrap text blocks not inside block elements
  const blockTags = ["<h1", "<h2", "<h3", "<h4", "<h5", "<h6", "<ul", "<ol", "<li", "<pre", "<blockquote", "<hr", "<img"];
  const lines = html.split("\n");
  const result = [];
  let inPara = false;
  for (const line of lines) {
    const isBlock = blockTags.some(t => line.trimStart().startsWith(t));
    if (line.trim() === "") {
      if (inPara) { result.push("</p>"); inPara = false; }
    } else if (isBlock) {
      if (inPara) { result.push("</p>"); inPara = false; }
      result.push(line);
    } else {
      if (!inPara) { result.push("<p>"); inPara = true; }
      result.push(line);
    }
  }
  if (inPara) result.push("</p>");

  return result.join("\n");
}

// ============================================================
// HELPERS
// ============================================================
function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function estimateReadTime(content) {
  if (!content) return 1;
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

function setMeta(id, content) {
  const el = document.getElementById(id);
  if (el) el.setAttribute("content", content);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ============================================================
// LOAD POST
// ============================================================
async function loadPost() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");

  if (!postId) {
    showError();
    return;
  }

  try {
    const docRef = doc(db, "posts", postId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().status !== "published") {
      showError();
      return;
    }

    const post = { id: docSnap.id, ...docSnap.data() };
    renderPost(post);

    // Log analytics
    logEvent(analytics, "page_view", {
      page_title: post.title,
      page_location: window.location.href
    });

    // Load related
    loadRelated(post);

  } catch (err) {
    console.error("Error loading post:", err);
    showError();
  }
}

// ============================================================
// RENDER POST
// ============================================================
function renderPost(post) {
  // Update document meta
  document.title = `${post.title} — spdly.log`;
  document.querySelector("meta[name='description']").setAttribute("content", post.excerpt || "");
  document.getElementById("canonicalTag").setAttribute("href", `https://blog.spdly.is-a.dev/post.html?id=${post.id}`);

  setMeta("og-title", post.title);
  setMeta("og-desc", post.excerpt || "");
  setMeta("og-url", `https://blog.spdly.is-a.dev/post.html?id=${post.id}`);
  if (post.coverImage) setMeta("og-image", post.coverImage);
  setMeta("tw-title", post.title);
  setMeta("tw-desc", post.excerpt || "");

  // Inject structured data
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt || "",
    "url": `https://blog.spdly.is-a.dev/post.html?id=${post.id}`,
    "datePublished": post.publishedAt?.toDate?.().toISOString() || "",
    "dateModified": post.updatedAt?.toDate?.().toISOString() || "",
    "author": {
      "@type": "Person",
      "name": "spdly",
      "url": "https://spdly.is-a.dev"
    },
    "publisher": {
      "@type": "Person",
      "name": "spdly",
      "url": "https://spdly.is-a.dev"
    },
    "image": post.coverImage || "",
    "keywords": (post.tags || []).join(", ")
  };
  const schemaScript = document.createElement("script");
  schemaScript.type = "application/ld+json";
  schemaScript.textContent = JSON.stringify(schema);
  document.head.appendChild(schemaScript);

  // Tags header
  const tagsHeader = document.getElementById("postTagsHeader");
  tagsHeader.innerHTML = (post.tags || [])
    .map(t => `<span class="post-tag">${escapeHtml(t)}</span>`)
    .join("");

  // Title, excerpt
  document.getElementById("postTitle").textContent = post.title;
  document.getElementById("postExcerptHeader").textContent = post.excerpt || "";
  document.getElementById("postDate").textContent = formatDate(post.publishedAt || post.createdAt);
  document.getElementById("readTime").textContent = estimateReadTime(post.content);

  // Cover image
  if (post.coverImage) {
    document.getElementById("postCover").innerHTML =
      `<img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}" loading="eager" />`;
  }

  // Body
  document.getElementById("postBody").innerHTML = renderMarkdown(post.content || "");

  // Tags footer
  document.getElementById("postTagsFooter").innerHTML = (post.tags || [])
    .map(t => `<a href="/?tag=${encodeURIComponent(t)}" class="post-tag">${escapeHtml(t)}</a>`)
    .join("");

  // Share
  const postUrl = `https://blog.spdly.is-a.dev/post.html?id=${post.id}`;
  document.getElementById("copyLink").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      document.getElementById("copyLink").textContent = "✓ Copied!";
      setTimeout(() => { document.getElementById("copyLink").textContent = "⌘ Copy link"; }, 2000);
    } catch {
      prompt("Copy this link:", postUrl);
    }
    logEvent(analytics, "share", { method: "copy_link", content_id: post.id });
  });

  const twitterText = encodeURIComponent(`${post.title} — ${postUrl}`);
  document.getElementById("shareTwitter").href =
    `https://twitter.com/intent/tweet?text=${twitterText}`;

  // Show content, hide loading
  document.getElementById("postLoading").classList.add("hidden");
  document.getElementById("postContent").classList.remove("hidden");
  document.getElementById("postNav").classList.remove("hidden");

  initReadingProgress();
}

// ============================================================
// LOAD RELATED POSTS
// ============================================================
async function loadRelated(post) {
  if (!post.tags || post.tags.length === 0) return;

  try {
    const q = query(
      collection(db, "posts"),
      where("status", "==", "published"),
      where("tags", "array-contains", post.tags[0]),
      orderBy("publishedAt", "desc"),
      limit(4)
    );
    const snap = await getDocs(q);
    const related = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.id !== post.id)
      .slice(0, 3);

    if (related.length === 0) return;

    const container = document.getElementById("relatedPosts");
    container.innerHTML = `
      <p style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-3);margin-bottom:0.75rem;letter-spacing:0.04em;text-transform:uppercase;">Related posts</p>
      ${related.map(p => `
        <a href="/post.html?id=${p.id}" class="post-card" style="text-decoration:none;">
          <div class="post-card-tags">${(p.tags || []).map(t => `<span class="post-tag">${escapeHtml(t)}</span>`).join("")}</div>
          <div class="post-card-title">${escapeHtml(p.title)}</div>
          <div class="post-card-footer">
            <span class="post-card-date">${formatDate(p.publishedAt)}</span>
            <span class="post-card-arrow">→</span>
          </div>
        </a>
      `).join("")}
    `;
  } catch (err) {
    // Related posts are optional — fail silently
    console.warn("Related posts error:", err);
  }
}

// ============================================================
// ERROR STATE
// ============================================================
function showError() {
  document.getElementById("postLoading").classList.add("hidden");
  document.getElementById("postError").classList.remove("hidden");
  document.title = "Post Not Found — spdly.log";
}

// ============================================================
// INIT
// ============================================================
loadPost();
