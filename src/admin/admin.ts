type BookingStatus = 'Pendente' | 'Conflito de horário' | 'Aprovado' | 'Rejeitado';

interface BookingRequest {
  id: string;
  userName: string;
  userRole: 'Professora' | 'Aluno' | 'Servidora';
  userInitials: string;
  date: string;
  timeSlot: string;
  purpose: string;
  participants: number;
  status: BookingStatus;
  labName: string;
}

interface Responsible {
  id: string;
  name: string;
  email: string;
}

interface LabItem {
  id: string;
  name: string;
  location: string;
  capacity: string;
  hours: string;
  rules: string;
  responsibles: Responsible[];
}

// ESTADO GLOBAL DA APLICAÇÃO
let requests: BookingRequest[] = [];
let labs: LabItem[] = [];
let activeLabId: string | null = null;
let selectedRequestId: string | null = null;

// ELEMENTOS DO DOM
const requestsContainer = document.querySelector<HTMLDivElement>('#requests-container');
const modalReject = document.querySelector<HTMLDivElement>('#modal-reject');
const modalSuggest = document.querySelector<HTMLDivElement>('#modal-suggest');
const rejectSummary = document.querySelector<HTMLDivElement>('#reject-summary');
const suggestSummary = document.querySelector<HTMLDivElement>('#suggest-summary');
const datePresetSelect = document.querySelector<HTMLSelectElement>('#filter-date-preset');
const customDateRangeGroup = document.querySelector<HTMLDivElement>('#custom-date-range');

// --- 1. ALTERNÂNCIA DE ABAS ---
function setupTabs() {
  const navButtons = document.querySelectorAll<HTMLButtonElement>('.nav-btn');
  const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');

  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const selectedTab = button.getAttribute('data-tab');
      navButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      button.classList.add('active');
      const target = document.querySelector<HTMLElement>(`#tab-${selectedTab}`);
      if (target) target.classList.add('active');
    });
  });
}

// Auxiliar: Converte string "DD/MM/AAAA" para objeto Date
function parseRequestDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

// Auxiliar: Converte string "YYYY-MM-DD" de input date para objeto Date
function parseInputDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// --- 2. FILA DE APROVAÇÕES E CONSULTA HISTÓRICA ---
function renderRequests() {
  if (!requestsContainer) return;

  updateFilterOptions('#filter-lab', 'Todos os laboratórios', labs.map(lab => lab.name));
  updateFilterOptions('#filter-purpose', 'Todas as finalidades', requests.map(req => req.purpose));

  const labFilter = document.querySelector<HTMLSelectElement>('#filter-lab')?.value || 'all';
  const purposeFilter = document.querySelector<HTMLSelectElement>('#filter-purpose')?.value || 'all';
  const statusFilter = (document.querySelector<HTMLSelectElement>('#filter-status')?.value) || 'all';
  const datePreset = datePresetSelect?.value || 'all';

  const startDateVal = (document.querySelector<HTMLInputElement>('#filter-date-start')?.value) || '';
  const endDateVal = (document.querySelector<HTMLInputElement>('#filter-date-end')?.value) || '';

  const baseToday = new Date();
  baseToday.setHours(0, 0, 0, 0);

  const filtered = requests.filter(req => {
    // 1. Filtro por Laboratório
    const matchLab = labFilter === 'all' || req.labName === labFilter;

    // 2. Filtro por Finalidade (Flag)
    const matchPurpose = purposeFilter === 'all' || req.purpose === purposeFilter;

    // 3. Filtro por Status
    const matchStatus = statusFilter === 'all' || req.status === statusFilter;

    // 4. Filtro por Data
    const reqDate = parseRequestDate(req.date);
    let matchDate = true;

    if (datePreset === 'today') {
      matchDate = reqDate.getTime() === baseToday.getTime();
    } else if (datePreset === '7days-next') {
      const next7 = new Date(baseToday);
      next7.setDate(baseToday.getDate() + 7);
      matchDate = reqDate >= baseToday && reqDate <= next7;
    } else if (datePreset === '7days-past') {
      const past7 = new Date(baseToday);
      past7.setDate(baseToday.getDate() - 7);
      matchDate = reqDate <= baseToday && reqDate >= past7;
    } else if (datePreset === '30days-past') {
      const past30 = new Date(baseToday);
      past30.setDate(baseToday.getDate() - 30);
      matchDate = reqDate <= baseToday && reqDate >= past30;
    } else if (datePreset === 'custom') {
      const start = parseInputDate(startDateVal);
      const end = parseInputDate(endDateVal);
      if (start && end) {
        matchDate = reqDate >= start && reqDate <= end;
      } else if (start) {
        matchDate = reqDate >= start;
      } else if (end) {
        matchDate = reqDate <= end;
      }
    }

    return matchLab && matchPurpose && matchStatus && matchDate;
  });

  if (filtered.length === 0) {
    const message = requests.length === 0
      ? 'Nenhuma solicitação carregada. Os dados serão exibidos após a integração com o backend.'
      : 'Nenhuma solicitação encontrada para os filtros selecionados.';
    requestsContainer.innerHTML = `<p class="empty-state">${message}</p>`;
    updateMetrics();
    return;
  }

  requestsContainer.innerHTML = filtered.map(req => {
    const isConflict = req.status === 'Conflito de horário';
    const isApproved = req.status === 'Aprovado';
    const isRejected = req.status === 'Rejeitado';

    let cardClass = 'request-card';
    if (isConflict) cardClass += ' has-conflict';

    let badgeClass = 'status-badge pending';
    if (isConflict) badgeClass = 'status-badge conflict';
    if (isApproved) badgeClass = 'status-badge approved';
    if (isRejected) badgeClass = 'status-badge rejected';

    return `
      <div class="${cardClass}">
        <div class="user-info">
          <div class="avatar-circle ${isConflict ? 'conflict' : ''}">${req.userInitials}</div>
          <div class="details">
            <span class="user-name">${req.userName}</span>
            <span class="user-role">${req.userRole}</span>
            <div class="booking-meta">
              <span>${req.date} - ${req.timeSlot}</span>
              <span>•</span>
              <span>${req.purpose}</span>
              <span>•</span>
              <span>${req.participants} participantes</span>
            </div>
            <span class="${badgeClass}">● ${req.status}</span>
          </div>
        </div>
        ${req.status === 'Pendente' || req.status === 'Conflito de horário' ? `
          <div class="card-actions">
            <button class="btn btn-approve" data-id="${req.id}">Aprovar</button>
            <button class="btn btn-reject" data-id="${req.id}">Rejeitar</button>
            <button class="btn btn-suggest" data-id="${req.id}">Sugerir novo horário</button>
          </div>
        ` : `
          <span style="color:${isApproved ? '#166534' : '#991b1b'}; font-weight:600; font-size:13px;">
            ${isApproved ? '✓ Aprovado' : '✕ Rejeitado'}
          </span>
        `}
      </div>
    `;
  }).join('');

  attachRequestEvents();
  updateMetrics();
}

function updateFilterOptions(selector: string, allLabel: string, values: string[]) {
  const select = document.querySelector<HTMLSelectElement>(selector);
  if (!select) return;

  const selectedValue = select.value;
  select.replaceChildren(
    new Option(allLabel, 'all'),
    ...[...new Set(values)].map(value => new Option(value, value))
  );
  if (values.includes(selectedValue)) select.value = selectedValue;
}

function attachRequestEvents() {
  document.querySelectorAll<HTMLButtonElement>('.btn-approve').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const req = requests.find(r => r.id === id);
      if (req) {
        req.status = 'Aprovado';
        renderRequests();
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.btn-reject').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRequestId = btn.getAttribute('data-id');
      const req = requests.find(r => r.id === selectedRequestId);
      if (req && modalReject && rejectSummary) {
        rejectSummary.innerHTML = `
          <strong>${req.userName} • ${req.labName}</strong>
          <span>${req.date} - ${req.timeSlot} • ${req.purpose}</span>
        `;
        modalReject.classList.add('active');
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.btn-suggest').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRequestId = btn.getAttribute('data-id');
      const req = requests.find(r => r.id === selectedRequestId);
      if (req && modalSuggest && suggestSummary) {
        suggestSummary.innerHTML = `
          <span>Horário solicitado</span>
          <strong>${req.date} - ${req.timeSlot}</strong>
        `;
        modalSuggest.classList.add('active');
      }
    });
  });
}

function updateMetrics() {
  const pendingCount = requests.filter(r => r.status === 'Pendente').length;
  const conflictCount = requests.filter(r => r.status === 'Conflito de horário').length;
  const approvedCount = requests.filter(r => r.status === 'Aprovado').length;

  const elPending = document.querySelector('#metric-pending');
  const elConflicts = document.querySelector('#metric-conflicts');
  const elApproved = document.querySelector('#metric-approved');
  const elLabs = document.querySelector('#metric-labs');

  if (elPending) elPending.textContent = pendingCount.toString();
  if (elConflicts) elConflicts.textContent = conflictCount.toString();
  if (elApproved) elApproved.textContent = approvedCount.toString();
  if (elLabs) elLabs.textContent = labs.length.toString();
}

// --- 3. MODAIS DE AÇÃO ---
function setupModals() {
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      modalReject?.classList.remove('active');
      modalSuggest?.classList.remove('active');
    });
  });

  document.querySelector('#btn-confirm-reject')?.addEventListener('click', () => {
    if (selectedRequestId) {
      const req = requests.find(r => r.id === selectedRequestId);
      if (req) {
        req.status = 'Rejeitado';
      }
      modalReject?.classList.remove('active');
      renderRequests();
    }
  });

  document.querySelector('#btn-confirm-suggest')?.addEventListener('click', () => {
    if (selectedRequestId) {
      const req = requests.find(r => r.id === selectedRequestId);
      if (req) {
        req.status = 'Pendente';
        const newDate = (document.querySelector('#new-date') as HTMLInputElement).value;
        const newTime = (document.querySelector('#new-time') as HTMLInputElement).value;
        if (newDate) req.date = newDate;
        if (newTime) req.timeSlot = newTime;
      }
      modalSuggest?.classList.remove('active');
      renderRequests();
    }
  });
}

// --- 4. GESTÃO DE LABORATÓRIOS ---
function renderLabsSidebar() {
  const labsListContainer = document.querySelector<HTMLDivElement>('#labs-list');
  if (!labsListContainer) return;

  if (!activeLabId && labs.length > 0) activeLabId = labs[0].id;
  labsListContainer.innerHTML = labs.length === 0
    ? '<p class="empty-state">Nenhum laboratório carregado. Os dados serão exibidos após a integração com o backend.</p>'
    : labs.map(lab => `
    <div class="lab-item ${lab.id === activeLabId ? 'active' : ''}" data-lab-id="${lab.id}">
      <span class="lab-item-name">${lab.name}</span>
      <span class="lab-item-sub">${lab.location}</span>
    </div>
  `).join('');

  const newLabButton = document.querySelector<HTMLButtonElement>('#btn-new-lab');
  if (newLabButton) newLabButton.disabled = true;
  const labForm = document.querySelector<HTMLFormElement>('#lab-form');
  labForm?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input, textarea, button')
    .forEach(element => { element.disabled = true; });

  document.querySelectorAll<HTMLDivElement>('.lab-item').forEach(item => {
    item.addEventListener('click', () => {
      activeLabId = item.getAttribute('data-lab-id');
      renderLabsSidebar();
      loadLabForm();
    });
  });
}

function loadLabForm() {
  const currentLab = labs.find(l => l.id === activeLabId);
  if (!currentLab) return;

  (document.querySelector('#lab-name') as HTMLInputElement).value = currentLab.name;
  (document.querySelector('#lab-capacity') as HTMLInputElement).value = currentLab.capacity;
  (document.querySelector('#lab-location') as HTMLInputElement).value = currentLab.location;
  (document.querySelector('#lab-hours') as HTMLInputElement).value = currentLab.hours;
  (document.querySelector('#lab-rules') as HTMLTextAreaElement).value = currentLab.rules;

  renderResponsibles(currentLab);
}

function renderResponsibles(lab: LabItem) {
  const responsiblesContainer = document.querySelector<HTMLDivElement>('#responsibles-list');
  if (!responsiblesContainer) return;

  if (lab.responsibles.length === 0) {
    responsiblesContainer.innerHTML = '<p class="empty-state">Nenhum responsável cadastrado.</p>';
    return;
  }

  responsiblesContainer.innerHTML = lab.responsibles.map(resp => `
    <div class="responsible-card">
      <div>
        <span class="resp-name">${resp.name}</span>
        <span class="resp-email">${resp.email}</span>
      </div>
      <button type="button" class="btn-remove-resp" data-resp-id="${resp.id}">Remover</button>
    </div>
  `).join('');

  document.querySelectorAll<HTMLButtonElement>('.btn-remove-resp').forEach(btn => {
    btn.addEventListener('click', () => {
      const respId = btn.getAttribute('data-resp-id');
      lab.responsibles = lab.responsibles.filter(r => r.id !== respId);
      renderResponsibles(lab);
    });
  });
}

function setupLabEvents() {
  document.querySelector('#btn-add-responsible')?.addEventListener('click', () => {
    const currentLab = labs.find(l => l.id === activeLabId);
    if (!currentLab) return;

    const name = prompt('Nome do responsável:');
    const email = prompt('E-mail do responsável:');

    if (name && email) {
      currentLab.responsibles.push({ id: Date.now().toString(), name, email });
      renderResponsibles(currentLab);
    }
  });

  document.querySelector('#lab-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const currentLab = labs.find(l => l.id === activeLabId);
    if (currentLab) {
      currentLab.name = (document.querySelector('#lab-name') as HTMLInputElement).value;
      currentLab.capacity = (document.querySelector('#lab-capacity') as HTMLInputElement).value;
      currentLab.location = (document.querySelector('#lab-location') as HTMLInputElement).value;
      currentLab.hours = (document.querySelector('#lab-hours') as HTMLInputElement).value;
      currentLab.rules = (document.querySelector('#lab-rules') as HTMLTextAreaElement).value;

      renderLabsSidebar();
      alert('Laboratório salvo com sucesso!');
    }
  });
}

// LISTENERS DE FILTROS DA FILA
datePresetSelect?.addEventListener('change', () => {
  if (customDateRangeGroup) {
    customDateRangeGroup.style.display = datePresetSelect.value === 'custom' ? 'flex' : 'none';
  }
  renderRequests();
});

document.querySelector('#filter-lab')?.addEventListener('change', renderRequests);
document.querySelector('#filter-purpose')?.addEventListener('change', renderRequests);
document.querySelector('#filter-status')?.addEventListener('change', renderRequests);
document.querySelector('#filter-date-start')?.addEventListener('change', renderRequests);
document.querySelector('#filter-date-end')?.addEventListener('change', renderRequests);

// INICIALIZAÇÃO DA PÁGINA
setupTabs();
renderRequests();
setupModals();
renderLabsSidebar();
loadLabForm();
setupLabEvents();