// Chargement des données TikTok d'un compte et remplissage de la page.
// Le compte vient de <body data-account="...">. La mise en forme viendra après :
// ici on branche seulement les données sur les éléments de la page.
(() => {
  const API = window.TIKTOK_CONFIG.API_BASE.replace(/\/$/, "");
  const slug = document.body.dataset.account;

  const $ = (id) => document.getElementById(id);
  const nf = new Intl.NumberFormat("fr-FR");
  const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  const dateOnly = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

  async function getJSON(path) {
    const res = await fetch(`${API}${path}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `HTTP ${res.status}`);
      err.code = body.error;
      throw err;
    }
    return body;
  }

  // Exposé pour la suite (graphiques, filtres…)
  const api = {
    videos: (refresh = false) => getJSON(`/api/${slug}/videos${refresh ? "?refresh=1" : ""}`),
    history: () => getJSON(`/api/${slug}/history`),
  };
  window.TikTokAPI = api;

  function setStatus(message, isError = false) {
    const el = $("status");
    el.textContent = message;
    el.dataset.state = isError ? "error" : "ok";
  }

  function renderStats(data) {
    const views = data.totals.views;
    const count = data.videos.length;
    const values = {
      followers: data.user.follower_count,
      likes: data.user.likes_count,
      videos: data.user.video_count ?? count,
      views,
      "avg-views": count ? Math.round(views / count) : 0,
    };
    document.querySelectorAll("[data-stat]").forEach((el) => {
      const v = values[el.dataset.stat];
      el.textContent = v == null ? "–" : nf.format(v);
    });
    if (data.user.display_name) $("account-name").textContent = data.user.display_name;
  }

  function renderTable(data) {
    const tbody = $("videos-body");
    tbody.replaceChildren();
    const rows = [...data.videos].sort(
      (a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0)
    );
    for (const v of rows) {
      const tr = document.createElement("tr");
      const cell = (content) => {
        const td = document.createElement("td");
        if (content instanceof Node) td.appendChild(content);
        else td.textContent = content;
        tr.appendChild(td);
      };
      cell(v.posted_at ? dateOnly.format(new Date(v.posted_at)) : "–");

      if (v.url) {
        const a = document.createElement("a");
        a.href = v.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = v.title || "(sans titre)";
        cell(a);
      } else {
        cell(v.title || "(sans titre)");
      }

      cell(nf.format(v.views));
      cell(nf.format(v.likes));
      cell(nf.format(v.comments));
      cell(nf.format(v.shares));
      cell(v.duration ? `${v.duration} s` : "–"); // 0 pour les publications photo
      tbody.appendChild(tr);
    }
  }

  async function load(refresh = false) {
    const button = $("refresh");
    button.disabled = true;
    setStatus("Chargement…");
    try {
      const data = await api.videos(refresh);
      renderStats(data);
      renderTable(data);
      $("raw").textContent = JSON.stringify(data, null, 2);

      let message = `Données du ${dateTime.format(new Date(data.fetched_at))}`;
      if (data.stale) message += " (TikTok n'a pas répondu, dernières données connues)";
      else if (data.cached) message += " (déjà en cache)";
      setStatus(message);
    } catch (err) {
      if (err.code === "not_connected" || err.code === "reauth_needed") {
        setStatus("Ce compte n'est pas connecté, ou l'autorisation a expiré. Voir SETUP.md.", true);
      } else if (err.code) {
        setStatus(`Erreur : ${err.code}`, true);
      } else {
        setStatus("Impossible de joindre le back-end.", true);
      }
    } finally {
      button.disabled = false;
    }
  }

  $("refresh").addEventListener("click", () => load(true));
  load();
})();
