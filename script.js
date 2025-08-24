// --- State & helpers ---
const els = {
  taskInput: $("#taskInput"),
  dueDate: $("#dueDate"),
  priority: $("#priority"),
  category: $("#category"),
  addBtn: $("#addTaskBtn"),
  taskList: $("#taskList"),
  compList: $("#completedList"),
  clearCompletedBtn: $("#clearCompletedBtn"),
  filterChips: $all(".chip"),
  allCount: $("#allCount"),
  activeCount: $("#activeCount"),
  completedCount: $("#completedCount"),
  search: $("#search"),
  catFilter: $("#catFilter"),
  sortBy: $("#sortBy"),
  progressText: $("#progressText"),
  progressFill: $("#progressFill"),
  emptyActive: $("#emptyActive"),
  emptyCompleted: $("#emptyCompleted"),
  snack: $("#snack"),
};

const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1 };

let tasks = loadTasks();
let currentFilter = "all";

function $(sel) {
  return document.querySelector(sel);
}
function $all(sel) {
  return Array.from(document.querySelectorAll(sel));
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function todayStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function showSnack(msg) {
  els.snack.textContent = msg;
  els.snack.classList.add("show");
  setTimeout(() => els.snack.classList.remove("show"), 1400);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem("tasks_v2");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveTasks() {
  localStorage.setItem("tasks_v2", JSON.stringify(tasks));
  refreshCategoryOptions();
}

// --- Add / Edit / Delete / Toggle ---
function addTask() {
  const text = els.taskInput.value.trim();
  if (!text) return;
  const t = {
    id: uid(),
    text,
    due: els.dueDate.value || "",
    priority: els.priority.value,
    category: (els.category.value || "").trim(),
    completed: false,
    createdAt: Date.now(),
    completedAt: null,
  };
  tasks.push(t);
  saveTasks();
  render();
  els.taskInput.value = "";
  els.dueDate.value = "";
  els.priority.value = "Low";
  // keep last category typed
  showSnack("Task added");
}

function editTask(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  const newText = prompt("Edit task title:", t.text);
  if (newText === null) return;
  const trimmed = newText.trim();
  if (trimmed) {
    t.text = trimmed;
    saveTasks();
    render();
    showSnack("Task updated");
  }
}

function deleteTask(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  if (confirm(`Delete task: "${t.text}"?`)) {
    tasks = tasks.filter((x) => x.id !== id);
    saveTasks();
    render();
    showSnack("Task deleted");
  }
}

function toggleComplete(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? Date.now() : null;
  saveTasks();
  render();
  showSnack(t.completed ? "Marked as completed" : "Marked as active");
}

function clearCompleted() {
  if (!tasks.some((t) => t.completed)) return;
  if (confirm("Clear all completed tasks?")) {
    tasks = tasks.filter((t) => !t.completed);
    saveTasks();
    render();
    showSnack("Cleared completed");
  }
}

// --- Filtering / Sorting / Search ---
function applyFilterSearchSort(list) {
  const term = els.search.value.trim().toLowerCase();
  const cat = els.catFilter.value;
  const sortKey = els.sortBy.value;

  let res = list.filter((t) => {
    if (currentFilter === "active" && t.completed) return false;
    if (currentFilter === "completed" && !t.completed) return false;
    if (cat && t.category !== cat) return false;
    if (term && !t.text.toLowerCase().includes(term)) return false;
    return true;
  });

  res.sort((a, b) => {
    switch (sortKey) {
      case "created_asc":
        return a.createdAt - b.createdAt;
      case "created_desc":
        return b.createdAt - a.createdAt;
      case "due_asc":
        return (a.due || "") > (b.due || "") ? 1 : a.due == b.due ? 0 : -1;
      case "due_desc":
        return (a.due || "") < (b.due || "") ? 1 : a.due == b.due ? 0 : -1;
      case "priority_desc":
        return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      case "priority_asc":
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      default:
        return 0;
    }
  });

  return res;
}

// --- Rendering ---
function render() {
  // Counters
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const active = total - completed;
  els.allCount.textContent = total;
  els.activeCount.textContent = active;
  els.completedCount.textContent = completed;

  // Progress
  const pct = total ? Math.round((completed / total) * 100) : 0;
  els.progressText.textContent = `${completed} of ${total} completed (${pct}%)`;
  els.progressFill.style.width = pct + "%";

  // Lists
  els.taskList.innerHTML = "";
  els.compList.innerHTML = "";

  const visible = applyFilterSearchSort(tasks);
  // we still show two columns (active & completed) simultaneously,
  // but filter/search affects what appears in each list.
  const activeItems = visible.filter((t) => !t.completed);
  const completedItems = visible.filter((t) => t.completed);

  // Active list
  if (activeItems.length === 0) els.emptyActive.style.display = "block";
  else els.emptyActive.style.display = "none";

  activeItems.forEach((t) => {
    els.taskList.appendChild(renderItem(t));
  });

  // Completed list
  if (completedItems.length === 0) els.emptyCompleted.style.display = "block";
  else els.emptyCompleted.style.display = "none";

  completedItems.forEach((t) => {
    els.compList.appendChild(renderItem(t, true));
  });

  // Refresh categories dropdown (in case user typed new one)
  refreshCategoryOptions();
}

function isOverdue(t) {
  if (!t.due || t.completed) return false;
  const due = new Date(t.due);
  const today = todayStr();
  return due < today;
}

function renderItem(t, isCompletedCol = false) {
  const li = document.createElement("li");
  li.className = "task" + (t.completed ? " completed" : "");
  const top = document.createElement("div");
  top.className = "task-top";

  const left = document.createElement("div");
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = t.text;
  const meta = document.createElement("div");
  meta.className = "meta";
  const dueTxt = t.due
    ? new Date(t.due + "T00:00:00").toLocaleDateString()
    : "N/A";
  meta.textContent = `Due: ${dueTxt} • Category: ${t.category || "—"}`;

  left.appendChild(title);
  left.appendChild(meta);

  const badges = document.createElement("div");
  badges.className = "badges";
  const p = document.createElement("span");
  p.className = "badge " + t.priority.toLowerCase();
  p.textContent = `Priority: ${t.priority}`;
  badges.appendChild(p);

  if (isOverdue(t)) {
    const ov = document.createElement("span");
    ov.className = "badge overdue";
    ov.textContent = "Overdue";
    badges.appendChild(ov);
  }

  top.appendChild(left);
  top.appendChild(badges);

  const actions = document.createElement("div");
  actions.className = "actions";
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "btn-small " + (t.completed ? "btn-grey" : "btn-ok");
  toggleBtn.textContent = t.completed ? "Undo" : "Complete";
  toggleBtn.addEventListener("click", () => toggleComplete(t.id));

  const editBtn = document.createElement("button");
  editBtn.className = "btn-small";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => editTask(t.id));

  const delBtn = document.createElement("button");
  delBtn.className = "btn-small btn-danger";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => deleteTask(t.id));

  actions.append(toggleBtn, editBtn, delBtn);

  li.appendChild(top);
  li.appendChild(actions);
  return li;
}

function refreshCategoryOptions() {
  const cats = Array.from(
    new Set(tasks.map((t) => t.category).filter(Boolean))
  ).sort();
  const cur = els.catFilter.value;
  els.catFilter.innerHTML =
    '<option value="">All categories</option>' +
    cats
      .map((c) => `<option ${c === cur ? "selected" : ""}>${c}</option>`)
      .join("");
}

// --- Events ---
els.addBtn.addEventListener("click", addTask);
els.taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
});

els.clearCompletedBtn.addEventListener("click", clearCompleted);

els.filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    els.filterChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    render();
  });
});

["input", "change", "keyup"].forEach((ev) => {
  els.search.addEventListener(ev, render);
  els.catFilter.addEventListener(ev, render);
  els.sortBy.addEventListener(ev, render);
});

// Initial
refreshCategoryOptions();
render();
