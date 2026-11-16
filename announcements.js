/*
 * Facebook 公告資料：新增公告時，只需要在 announcements 陣列最前方新增一筆。
 * postUrl 請使用 Facebook 貼文「複製連結」取得的公開 permalink。
 * 首頁與「大會公告」頁面會自動同步，點選卡片才載入 iframe。
 */
(() => {
  "use strict";

  const announcements = [
    {
      id: "on-fire-hong-kong",
      category: "國際隊伍介紹",
      title: "🔥 國際隊伍介紹｜香港熱火體育會 On Fire Athletic Association",
      description: "來自香港的熱血勁旅，即將登場！🇭🇰",
      postUrl: "https://www.facebook.com/permalink.php?story_fbid=pfbid02QUQnzXSurMYzh3hJy6b3wabCc9JjYzvCzD87GpmpGxpP9kBgdrikeJos6Rcuxc2rl&id=61555701383095",
      image: "assets/announcements/on-fire-hong-kong-first.jpg",
      imageAlt: "香港熱火體育會足球隊在夜間球場的團隊合照",
      flag: "🇭🇰"
    }
  ];

  function makeElement(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function getPostUrl(post) {
    // Only allow Facebook permalink URLs in this board.
    try {
      const url = new URL(post.postUrl);
      if (url.protocol === "https:" && ["www.facebook.com", "facebook.com", "m.facebook.com"].includes(url.hostname)) return url.href;
    } catch (_) { /* Invalid links do not create a card. */ }
    return null;
  }

  let dialog;
  let iframe;
  let frameContainer;
  let sourceLink;
  let dialogTitle;
  let previousFocus;
  let currentPostUrl;
  const postFrameHeight = 740;

  // Facebook's post plugin needs a content width of at least 350px.
  // On narrower screens, scale the complete iframe into the available width.
  function updatePostFrameLayout() {
    if (!dialog || !dialog.open || !currentPostUrl) return;
    let availableWidth = Math.floor(frameContainer.clientWidth);
    if (!availableWidth) return;
    let pluginWidth;
    // A vertical scrollbar can reduce the content width on some browsers.
    // Re-measure after setting the scaled height so no part is clipped.
    for (let pass = 0; pass < 2; pass++) {
      pluginWidth = Math.min(500, Math.max(350, availableWidth));
      const scale = Math.min(1, availableWidth / pluginWidth);
      iframe.width = String(pluginWidth);
      iframe.style.transform = "scale(" + scale + ")";
      frameContainer.style.height = Math.ceil(postFrameHeight * scale) + "px";
      const nextWidth = Math.floor(frameContainer.clientWidth);
      if (nextWidth === availableWidth) break;
      availableWidth = nextWidth;
    }

    const embedUrl = "https://www.facebook.com/plugins/post.php?href=" +
      encodeURIComponent(currentPostUrl) + "&show_text=true&width=" + pluginWidth;
    if (iframe.getAttribute("src") !== embedUrl) iframe.src = embedUrl;
  }

  function closeDialog() {
    if (!dialog) return;
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    iframe.removeAttribute("src");
    currentPostUrl = null;
    document.body.classList.remove("facebook-dialog-open");
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }

  function createDialog() {
    if (dialog) return;
    dialog = makeElement("dialog", "facebook-post-dialog");
    dialog.setAttribute("aria-labelledby", "facebook-dialog-title");

    const header = makeElement("div", "facebook-dialog-header");
    dialogTitle = makeElement("h2", null, "Facebook 公告");
    dialogTitle.id = "facebook-dialog-title";
    const close = makeElement("button", "facebook-dialog-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "關閉 Facebook 公告");
    close.addEventListener("click", closeDialog);
    header.append(dialogTitle, close);

    const content = makeElement("div", "facebook-dialog-content");
    frameContainer = makeElement("div", "facebook-dialog-frame");
    iframe = document.createElement("iframe");
    iframe.title = "Facebook 貼文內容";
    iframe.height = String(postFrameHeight);
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.allow = "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share";
    frameContainer.appendChild(iframe);
    content.appendChild(frameContainer);

    const footer = makeElement("div", "facebook-dialog-footer");
    footer.appendChild(makeElement("p", null, "貼文由 Facebook 提供，若未顯示請直接開啟原文。"));
    sourceLink = makeElement("a", null, "在 Facebook 開啟原文 ↗");
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    footer.appendChild(sourceLink);
    dialog.append(header, content, footer);
    document.body.appendChild(dialog);

    dialog.addEventListener("close", () => {
      iframe.removeAttribute("src");
      currentPostUrl = null;
      document.body.classList.remove("facebook-dialog-open");
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    });
    dialog.addEventListener("click", event => { if (event.target === dialog) closeDialog(); });
    dialog.addEventListener("cancel", event => { event.preventDefault(); closeDialog(); });
    dialog.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); closeDialog(); } });
    window.addEventListener("resize", updatePostFrameLayout);
  }

  function openPost(post) {
    const url = getPostUrl(post);
    if (!url) return;
    createDialog();
    previousFocus = document.activeElement;
    dialogTitle.textContent = post.title;
    sourceLink.href = url;
    currentPostUrl = url;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.classList.add("facebook-dialog-open");
    updatePostFrameLayout();
  }

  function makeCard(post) {
    const button = makeElement("button", "bulletin-card");
    button.type = "button";
    button.setAttribute("aria-label", "檢視 Facebook 公告：" + post.title);

    const art = makeElement("span", "bulletin-card__art");
    if (post.image) {
      art.classList.add("has-photo");
      const photo = document.createElement("img");
      photo.className = "bulletin-card__photo";
      photo.src = post.image;
      photo.alt = post.imageAlt || post.title;
      photo.loading = "lazy";
      photo.decoding = "async";
      art.appendChild(photo);
    } else {
      const ball = makeElement("span", "bulletin-card__ball", "⚽");
      ball.setAttribute("aria-hidden", "true");
      const flag = makeElement("span", "bulletin-card__flag", post.flag || "📣");
      flag.setAttribute("aria-hidden", "true");
      const brand = makeElement("span", "bulletin-card__brand", "TAICHUNG · 2026");
      art.append(ball, flag, brand);
    }

    const body = makeElement("span", "bulletin-card__body");
    body.appendChild(makeElement("span", "news-tag", post.category));
    body.appendChild(makeElement("strong", null, post.title));
    body.appendChild(makeElement("p", null, post.description));
    body.appendChild(makeElement("span", "bulletin-card__action", "閱讀 Facebook 公告　↗"));
    button.append(art, body);
    button.addEventListener("click", () => openPost(post));
    return button;
  }

  document.querySelectorAll("[data-facebook-announcements]").forEach(container => {
    const limit = Number(container.dataset.limit || announcements.length);
    const visiblePosts = announcements.filter(post => getPostUrl(post)).slice(0, limit);
    if (!visiblePosts.length) return;
    container.replaceChildren(...visiblePosts.map(makeCard));
    container.classList.toggle("is-multi", visiblePosts.length > 1);
  });
})();
