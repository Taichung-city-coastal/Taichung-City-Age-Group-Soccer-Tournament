(() => {
  "use strict";

  const teams = window.TEAM_INTRODUCTIONS || [];
  const grid = document.getElementById("teams-grid");
  const dialog = document.getElementById("team-dialog");
  if (!grid || !dialog) return;

  const heading = document.getElementById("team-dialog-title");
  const intro = document.getElementById("team-dialog-intro");
  const category = document.getElementById("team-dialog-category");
  const largePhoto = document.getElementById("team-dialog-photo");
  const photoCounter = document.getElementById("team-photo-counter");
  const thumbnails = document.getElementById("team-thumbnails");
  const previousButton = document.getElementById("team-photo-previous");
  const nextButton = document.getElementById("team-photo-next");
  const originalLink = document.getElementById("team-photo-original");
  const facebookLink = document.getElementById("team-facebook-link");

  let activeTeam = null;
  let activePhotoIndex = 0;
  let openingButton = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPhoto() {
    if (!activeTeam) return;
    const photos = activeTeam.images;
    const path = photos[activePhotoIndex];
    largePhoto.src = path;
    largePhoto.alt = `${activeTeam.name}，第 ${activePhotoIndex + 1} 張照片`;
    originalLink.href = path;
    photoCounter.textContent = `照片 ${activePhotoIndex + 1} / ${photos.length}`;
    previousButton.hidden = photos.length <= 1;
    nextButton.hidden = photos.length <= 1;
    [...thumbnails.children].forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === activePhotoIndex));
      button.setAttribute("aria-label", `查看第 ${index + 1} 張照片${index === activePhotoIndex ? "（目前顯示）" : ""}`);
    });
    const selected = thumbnails.children[activePhotoIndex];
    if (selected) selected.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function setPhoto(index) {
    if (!activeTeam) return;
    activePhotoIndex = (index + activeTeam.images.length) % activeTeam.images.length;
    renderPhoto();
  }

  function openTeam(team, button) {
    activeTeam = team;
    activePhotoIndex = 0;
    openingButton = button;
    heading.textContent = team.name;
    category.textContent = team.category;
    intro.textContent = team.description;
    facebookLink.hidden = !team.postUrl;
    if (team.postUrl) facebookLink.href = team.postUrl;
    else facebookLink.removeAttribute("href");

    const thumbButtons = team.images.map((path, index) => {
      const thumb = element("button", "team-thumbnail");
      thumb.type = "button";
      const image = document.createElement("img");
      image.src = path;
      image.alt = "";
      image.loading = "lazy";
      thumb.appendChild(image);
      thumb.addEventListener("click", () => setPhoto(index));
      return thumb;
    });
    thumbnails.replaceChildren(...thumbButtons);
    dialog.showModal();
    document.body.classList.add("team-dialog-open");
    renderPhoto();
    dialog.querySelector(".team-dialog-close").focus();
  }

  function closeTeam() {
    if (dialog.open) dialog.close();
  }

  teams.forEach(team => {
    if (!team.images || !team.images.length) return;
    const card = element("button", "team-card");
    card.type = "button";
    card.setAttribute("aria-label", `查看 ${team.name} 完整介紹及照片`);
    const art = element("span", "team-card-art");
    const image = document.createElement("img");
    image.src = team.images[0];
    image.alt = `${team.name} 球隊照片`;
    image.loading = "lazy";
    image.decoding = "async";
    art.appendChild(image);
    const body = element("span", "team-card-body");
    body.append(
      element("span", "team-card-category", team.category),
      element("strong", "team-card-name", team.name),
      element("span", "team-card-summary", team.description.replace(/\s+/g, " ").slice(0, 86))
    );
    card.append(art, body);
    card.addEventListener("click", () => openTeam(team, card));
    grid.appendChild(card);
  });

  const count = document.getElementById("teams-count");
  if (count) count.textContent = `${teams.length} 支參賽球隊 · 點選球隊查看介紹與照片`;
  document.getElementById("team-dialog-close").addEventListener("click", closeTeam);
  previousButton.addEventListener("click", () => setPhoto(activePhotoIndex - 1));
  nextButton.addEventListener("click", () => setPhoto(activePhotoIndex + 1));
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeTeam();
  });
  dialog.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      // Keep normal arrow-key navigation for links and photo thumbnail buttons.
      if (event.target.closest(".team-thumbnail")) return;
      event.preventDefault();
      setPhoto(activePhotoIndex + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("team-dialog-open");
    largePhoto.removeAttribute("src");
    activeTeam = null;
    if (openingButton && openingButton.isConnected) openingButton.focus();
  });
})();
