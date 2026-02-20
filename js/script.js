// ==========================================================
// 1. VARIÁVEIS DE ESTADO E ELEMENTOS DO DOM
// ==========================================================
const now = new Date();
let currentYear = now.getFullYear();
let currentMonth = now.getMonth();
let activities = [];
let dayTeams = {};
let observacoes = []; // NOVO: armazenar observações carregadas
let activeFilters = {
    company: '',
    description: ''
};

// NOVO: Controlar estado da navegação no modal
let modalState = {
    level: 1, // 1 = lista de atividades, 2 = detalhes da atividade
    date: null,
    selectedActivity: null,
    atividadesDoDia: []
};

const daysGrid = document.getElementById('days-grid');
const currentMonthYearHeader = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const activityModal = document.getElementById('activity-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalDateDisplay = document.getElementById('modal-date-display');
const activitiesList = document.getElementById('activities-list');
const modalTeamInfo = document.getElementById('modal-team-info');
const exportPdfBtn = document.getElementById('export-pdf');
const companyFilterBtn = document.getElementById('company-filter-btn');
const companyModal = document.getElementById('company-modal');
const closeCompanyModalBtn = document.getElementById('close-company-modal');
const applyCompanyFilterBtn = document.getElementById('apply-company-filter');
const cancelCompanyFilterBtn = document.getElementById('cancel-company-filter');

// ==========================================================
// 2. CONSTANTES E CONFIGURAÇÕES
// ==========================================================
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const COUNTABLE_PERIODICITIES = ['MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'QUADRIMESTRAL', 'SEMESTRAL', 'ANUAL'];

const DAY_CLASS_MAP = {
    'FREEZING_COMERCIAIS': 'holiday', // Rosa
    'TBRA': 'freezing-tbra',
    'B2B_TBRA': 'freezing-b2b-tbra',
    'FERIADO': 'holiday' // Rosa
};

const DAY_COLOR_PRIORITY_ORDER = ['FREEZING_COMERCIAIS', 'B2B_TBRA', 'TBRA'];

const EMPRESAS_DISPONIVEIS = [
    'VERTIV', 'Engemon', 'COTEPE', 'CARRIER', 'LG',
    'SOTREQ', 'ENERG', 'FERIADO', 'TBRA', 'B2B TBRA', 'M2E'
];

// ==========================================================
// 3. FUNÇÕES AUXILIARES
// ==========================================================

function getCurrentShift() {
    const hour = new Date().getHours();
    return (hour >= 6 && hour < 18) ? 'day' : 'night';
}

const normalizeText = (text) => text ? text.toUpperCase().replace(/-/g, '_').trim() : 'N_A';
const sanitizeFileName = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function applyFilters(activitiesArray, filters) {
    return activitiesArray.filter(activity => {
        const companyMatch = !filters.company ||
            (activity.company &&
                activity.company.toLowerCase() === filters.company.toLowerCase());

        const descriptionMatch = !filters.description ||
            (activity.description &&
                activity.description.toLowerCase().includes(filters.description.toLowerCase()));

        return companyMatch && descriptionMatch;
    });
}

function renderCompanyList() {
    const companyList = document.querySelector('.company-list');

    if (!companyList) {
        console.error('Elemento .company-list não encontrado!');
        return;
    }
    companyList.innerHTML = '';

    EMPRESAS_DISPONIVEIS.forEach(empresa => {
        const label = document.createElement('label');
        label.className = 'company-option';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'company';
        radio.value = empresa;

        if (activeFilters.company.toLowerCase() === empresa.toLowerCase()) {
            radio.checked = true;
        }

        const span = document.createElement('span');
        span.textContent = empresa;

        label.appendChild(radio);
        label.appendChild(span);
        companyList.appendChild(label);
    });
}

// ==========================================================
// 3.5 FUNÇÕES DE CRIPTOGRAFIA PARA LINKS COMPARTILHÁVEIS
// ==========================================================

const SECRET_KEY = 'MinhaChaveSuperSecreta2026!@#$';

function encryptCompany(companyName) {
    try {
        const data = {
            company: companyName,
            exp: new Date('2026-12-31').getTime()
        };

        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
        return encodeURIComponent(encrypted);
    } catch (e) {
        console.error('Erro ao criptografar:', e);
        return null;
    }
}

function decryptCompany(encryptedString) {
    try {
        if (!encryptedString) return null;

        const decoded = decodeURIComponent(encryptedString);
        const bytes = CryptoJS.AES.decrypt(decoded, SECRET_KEY);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

        if (decryptedData.exp && decryptedData.exp < Date.now()) {
            console.warn('Link expirado');
            return null;
        }

        return decryptedData.company;
    } catch (e) {
        console.error('Erro ao descriptografar:', e);
        return null;
    }
}

function generateShareableLink(companyName) {
    const encrypted = encryptCompany(companyName);
    if (!encrypted) return null;

    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?empresa=${encrypted}`;
}

function getCompanyFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const encryptedParam = urlParams.get('empresa');

    if (!encryptedParam) return null;

    return decryptCompany(encryptedParam);
}

// ==========================================================
// 4. CARREGAMENTO DOS DADOS (JSON)
// ==========================================================

// NOVA FUNÇÃO: Carregar observações do info.json
async function loadObservacoes() {
    try {
        const response = await fetch(`data/info.json`);
        if (response.ok) {
            const data = await response.json();
            observacoes = data.observacoes || [];
            console.log(`Carregadas ${observacoes.length} observações`);
        } else {
            console.log('Arquivo de observações não encontrado, criando array vazio');
            observacoes = [];
        }
    } catch (error) {
        console.error("Erro ao carregar observações:", error);
        observacoes = [];
    }
}

async function loadActivities(year, month) {
    try {
        const monthFileName = sanitizeFileName(MONTH_NAMES[month]);
        const [monthResponse, holidaysResponse] = await Promise.all([
            fetch(`data/${monthFileName}.json`).then(res => res.ok ? res.json() : []),
            fetch(`data/feriados.json`).then(res => res.ok ? res.json() : [])
        ]);

        activities = [];
        dayTeams = {};

        holidaysResponse.forEach(h => {
            activities.push({
                date: h.date, company: 'FERIADO', description: h.description,
                company_group: 'FERIADO', isHoliday: true
            });
        });

        monthResponse.forEach(dayData => {
            const { data, on_call_dia, on_call_noite, freezing, vendors } = dayData;
            dayTeams[data] = { day: on_call_dia, night: on_call_noite };

            if (Array.isArray(freezing)) {
                freezing.forEach(f => {
                    let groupKey = f.group;
                    let displayTitle = f.group.replace(/_/g, ' ');

                    if (groupKey === 'TBRA_FREEZING') {
                        groupKey = 'FREEZING_COMERCIAIS';
                        displayTitle = 'FREEZING COMERCIAL';
                    } else if (groupKey === 'TBRA_RELEASE' || groupKey === 'TBRA_NGIN') {
                        groupKey = 'TBRA';
                        displayTitle = 'TBRA';
                    } else if (groupKey === 'B2B_HUAWEI_FREEZING' || groupKey === 'B2B_TBRA') {
                        groupKey = 'B2B_TBRA';
                        displayTitle = 'B2B TBRA';
                    }

                    activities.push({
                        date: data, company: displayTitle, description: f.description,
                        company_group: groupKey, periodicity: 'FREEZING', isFreezing: true
                    });
                });
            }

            if (Array.isArray(vendors)) {
                vendors.forEach(v => { activities.push({ date: data, ...v }); });
            }
        });
    } catch (error) { console.error("Erro ao carregar dados:", error); }
}

// ==========================================================
// 5. RENDERIZAÇÃO DO CALENDÁRIO
// ==========================================================
function renderCalendar(year, month) {
    daysGrid.innerHTML = '';
    currentMonthYearHeader.textContent = `${MONTH_NAMES[month]} ${year}`;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = new Date(year, month, 1).getDay();

    for (let i = 0; i < startDayOfWeek; i++) {
        daysGrid.appendChild(Object.assign(document.createElement('div'), { className: 'day empty' }));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayElement = document.createElement('div');
        dayElement.className = 'day';
        dayElement.innerHTML = `<span class="day-number">${day}</span>`;

        const daily = activities.filter(a => a.date === dateString);
        const filteredDaily = applyFilters(daily, activeFilters);

        const countables = filteredDaily.filter(a => a.periodicity && COUNTABLE_PERIODICITIES.includes(normalizeText(a.periodicity)));
        if (countables.length > 0) {
            dayElement.innerHTML += `<span class="activity-indicator">${countables.length} Ativ.</span>`;
        }

        let appliedClass = null;
        dayElement.classList.remove('is-holiday-red', 'holiday');

        if (filteredDaily.some(a => a.isHoliday)) {
            appliedClass = DAY_CLASS_MAP['FERIADO'];
            dayElement.classList.add('is-holiday-red');
        } else {
            const presentGroups = filteredDaily.map(a => a.company_group);
            const winner = DAY_COLOR_PRIORITY_ORDER.find(p => presentGroups.includes(p));
            if (winner) appliedClass = DAY_CLASS_MAP[winner];
            else if (filteredDaily.length > 0) appliedClass = 'general-activity';
        }

        if (appliedClass) dayElement.classList.add(appliedClass);

        dayElement.onclick = () => openActivityModal(dateString, daily, filteredDaily);

        daysGrid.appendChild(dayElement);
    }
}

// ==========================================================
// NOVAS FUNÇÕES PARA NAVEGAÇÃO NO MODAL
// ==========================================================

// NOVA FUNÇÃO: Voltar para lista de atividades
function backToActivityList() {
    modalState.level = 1;
    renderActivityList(modalState.date, modalState.atividadesDoDia);
}

// NOVA FUNÇÃO: Mostrar detalhes de uma atividade específica
function showActivityDetails(activity) {
    modalState.level = 2;
    modalState.selectedActivity = activity;

    // Filtrar observações desta atividade
    const observacoesDaAtividade = observacoes.filter(obs =>
        obs.data === modalState.date &&
        obs.empresa === activity.company &&
        obs.descricao_atividade === activity.description
    );

    renderActivityDetails(activity, observacoesDaAtividade);
}

// NOVA FUNÇÃO: Renderizar lista de atividades (nível 1)
function renderActivityList(dateString, atividades) {
    activitiesList.innerHTML = '';

    // Adicionar botão de voltar se necessário (mas no nível 1 não aparece)

    if (atividades.length === 0) {
        activitiesList.innerHTML = '<p class="no-activity">Nenhuma atividade agendada.</p>';
        return;
    }

    // Agrupar atividades por empresa
    const atividadesPorEmpresa = {};
    atividades.forEach(activity => {
        if (!atividadesPorEmpresa[activity.company]) {
            atividadesPorEmpresa[activity.company] = [];
        }
        atividadesPorEmpresa[activity.company].push(activity);
    });

    // Renderizar cada empresa com suas atividades
    Object.keys(atividadesPorEmpresa).sort().forEach(empresa => {
        const empresaAtividades = atividadesPorEmpresa[empresa];

        // Cabeçalho da empresa
        const empresaHeader = document.createElement('h4');
        empresaHeader.textContent = `${empresa} (${empresaAtividades.length})`;
        empresaHeader.style.marginTop = '15px';
        empresaHeader.style.marginBottom = '5px';
        empresaHeader.style.color = '#007bff';
        activitiesList.appendChild(empresaHeader);

        // Atividades desta empresa
        empresaAtividades.forEach(activity => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.style.cursor = 'pointer';

            const pText = normalizeText(activity.periodicity);
            const isPeriodic = COUNTABLE_PERIODICITIES.includes(pText);

            let borderClass = activity.service_type ? `border-${activity.service_type}` :
                (activity.company_group ? `border-group-${activity.company_group}` : `border-p-${pText}`);
            div.classList.add(borderClass);

            // Verificar se tem observações
            const temObservacoes = observacoes.some(obs =>
                obs.data === dateString &&
                obs.empresa === activity.company &&
                obs.descricao_atividade === activity.description
            );

            const tag = isPeriodic ? `<span class="periodicidade-tag p-${pText}">${pText}</span>` : '';
            const observacaoIcon = temObservacoes ? ' 📝' : '';

            div.innerHTML = `
                <h4>${activity.company} ${tag} ${observacaoIcon}</h4>
                <p><strong>Descrição:</strong> ${activity.description}</p>
            `;

            div.onclick = (e) => {
                e.stopPropagation();
                showActivityDetails(activity);
            };

            activitiesList.appendChild(div);
        });
    });
}

// NOVA FUNÇÃO: Renderizar detalhes da atividade (nível 2)
function renderActivityDetails(activity, observacoesDaAtividade) {
    activitiesList.innerHTML = '';

    // Botão Voltar
    const backButton = document.createElement('button');
    backButton.textContent = '← Voltar para lista';
    backButton.style.cssText = `
        background: #f0f0f0;
        border: 1px solid #ddd;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        margin-bottom: 15px;
        font-size: 14px;
    `;
    backButton.onclick = backToActivityList;
    activitiesList.appendChild(backButton);

    // Detalhes da atividade
    const activityDetail = document.createElement('div');
    activityDetail.className = 'activity-item';

    const pText = normalizeText(activity.periodicity);
    const isPeriodic = COUNTABLE_PERIODICITIES.includes(pText);

    let borderClass = activity.service_type ? `border-${activity.service_type}` :
        (activity.company_group ? `border-group-${activity.company_group}` : `border-p-${pText}`);
    activityDetail.classList.add(borderClass);

    const tag = isPeriodic ? `<span class="periodicidade-tag p-${pText}">${pText}</span>` : '';

    activityDetail.innerHTML = `
        <h4>${activity.company} ${tag}</h4>
        <p><strong>Descrição:</strong> ${activity.description}</p>
    `;
    activitiesList.appendChild(activityDetail);

    // Seção de observações
    if (observacoesDaAtividade.length > 0) {
        const obsTitle = document.createElement('h5');
        obsTitle.textContent = '📋 Observações:';
        obsTitle.style.marginTop = '20px';
        obsTitle.style.marginBottom = '10px';
        obsTitle.style.color = '#555';
        activitiesList.appendChild(obsTitle);

        observacoesDaAtividade.forEach(obs => {
            const obsDiv = document.createElement('div');
            obsDiv.style.cssText = `
                background: #f9f9f9;
                border-left: 3px solid #007bff;
                padding: 10px;
                margin-bottom: 10px;
                border-radius: 0 4px 4px 0;
            `;

            // Formatar data de envio
            let dataEnvio = '';
            if (obs.data_envio) {
                const data = new Date(obs.data_envio);
                dataEnvio = data.toLocaleString('pt-BR');
            }

            obsDiv.innerHTML = `
                <p style="margin: 0 0 5px 0;"><strong>Observação:</strong> ${obs.observacao}</p>
                ${dataEnvio ? `<small style="color: #888;">Enviado em: ${dataEnvio}</small>` : ''}
            `;

            activitiesList.appendChild(obsDiv);
        });
    } else {
        const noObs = document.createElement('p');
        noObs.textContent = 'Nenhuma observação para esta atividade.';
        noObs.style.cssText = 'color: #888; font-style: italic; margin-top: 15px;';
        activitiesList.appendChild(noObs);
    }

    // Botão para adicionar observação (futuro)
    // Botão para adicionar observação
    const addButton = document.createElement('button');
    addButton.textContent = '+ Adicionar Observação';
    addButton.style.cssText = `
    background: #28a745;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 20px;
    font-size: 14px;
    width: 100%;
`;
    addButton.onclick = () => {
        // Pegar dados da atividade atual
        const data = modalState.date;
        const empresa = activity.company;
        const descricao = activity.description;

        // Construir URL com parâmetros
        const url = `form.html?data=${data}&empresa=${encodeURIComponent(empresa)}&descricao=${encodeURIComponent(descricao)}`;

        // Abrir em nova aba ou na mesma?
        window.open(url, '_blank'); // Abre em nova aba
        // ou window.location.href = url; // Abre na mesma aba
    };
    activitiesList.appendChild(addButton);
}

// ==========================================================
// 6. LÓGICA DO MODAL (MODIFICADA)
// ==========================================================
function openActivityModal(dateString, daily, filteredActivities = null) {
    modalDateDisplay.textContent = dateString.split('-').reverse().join('/');

    // Guardar estado
    modalState.date = dateString;
    modalState.level = 1;
    modalState.atividadesDoDia = filteredActivities !== null ? filteredActivities : daily;
    modalState.selectedActivity = null;

    // Info da equipe (mantido igual)
    modalTeamInfo.innerHTML = '';
    const agora = new Date();
    const hojeString = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

    const hasPeriodicActivity = modalState.atividadesDoDia.some(a => a.periodicity && COUNTABLE_PERIODICITIES.includes(normalizeText(a.periodicity)));
    exportPdfBtn.style.display = hasPeriodicActivity ? 'block' : 'none';

    const team = dayTeams[dateString];
    const shift = getCurrentShift();

    if (team) {
        const isToday = (dateString === hojeString);
        const seloDia = (isToday && shift === 'day') ? '<span style="color: #0056b3; font-weight: bold;"> (Plantão Agora)</span>' : '';
        const seloNoite = (isToday && shift === 'night') ? '<span style="color: #0056b3; font-weight: bold;"> (Plantão Agora)</span>' : '';

        modalTeamInfo.innerHTML = `
            <div class="on-call-modal">☀️ <strong>Equipe Diurna:</strong> ${team.day || '---'} ${seloDia}</div>
            <div class="on-call-modal">🌙 <strong>Equipe Noturna:</strong> ${team.night || '---'} ${seloNoite}</div>
        `;
    }

    // Renderizar lista de atividades (nível 1)
    renderActivityList(dateString, modalState.atividadesDoDia);

    activityModal.style.display = 'block';
}

// ==========================================================
// 7. EXPORTAÇÃO PDF (MODIFICADA PARA SUPORTAR O NOVO MODAL)
// ==========================================================
async function exportToPDF() {
    const { jsPDF } = window.jspdf;

    const tempContainer = document.createElement('div');
    tempContainer.style.padding = '30px';
    tempContainer.style.width = '700px';
    tempContainer.style.backgroundColor = '#fff';
    tempContainer.style.fontFamily = 'Arial, sans-serif';

    const title = document.createElement('h2');
    title.innerText = `Relatório de Manutenções - ${modalDateDisplay.textContent}`;
    title.style.color = '#007bff';
    title.style.borderBottom = '2px solid #007bff';
    title.style.paddingBottom = '10px';
    tempContainer.appendChild(title);

    if (modalTeamInfo.innerHTML !== '') {
        const teamClone = modalTeamInfo.cloneNode(true);
        teamClone.style.marginBottom = '20px';
        tempContainer.appendChild(teamClone);
    }

    const listClone = document.createElement('div');

    // Se estiver no nível 2, mostrar a atividade selecionada
    if (modalState.level === 2 && modalState.selectedActivity) {
        const activity = modalState.selectedActivity;
        const activityDiv = document.createElement('div');
        activityDiv.className = 'activity-item';
        activityDiv.innerHTML = `
            <h4>${activity.company}</h4>
            <p><strong>Descrição:</strong> ${activity.description}</p>
        `;
        listClone.appendChild(activityDiv);

        // Adicionar observações
        const observacoesDaAtividade = observacoes.filter(obs =>
            obs.data === modalState.date &&
            obs.empresa === activity.company &&
            obs.descricao_atividade === activity.description
        );

        if (observacoesDaAtividade.length > 0) {
            const obsTitle = document.createElement('h5');
            obsTitle.textContent = 'Observações:';
            obsTitle.style.marginTop = '15px';
            listClone.appendChild(obsTitle);

            observacoesDaAtividade.forEach(obs => {
                const obsDiv = document.createElement('div');
                obsDiv.style.marginBottom = '10px';
                obsDiv.style.padding = '10px';
                obsDiv.style.background = '#f9f9f9';
                obsDiv.innerHTML = `<p>${obs.observacao}</p>`;
                listClone.appendChild(obsDiv);
            });
        }
    } else {
        // Nível 1: mostrar todas as atividades do dia
        const originalItems = activitiesList.querySelectorAll('.activity-item');
        originalItems.forEach(item => {
            const itemClone = item.cloneNode(true);
            itemClone.style.marginBottom = '15px';
            itemClone.style.padding = '15px';
            itemClone.style.border = '1px solid #eee';
            itemClone.style.borderLeft = item.style.borderLeft || window.getComputedStyle(item).borderLeft;
            itemClone.style.pageBreakInside = 'avoid';
            listClone.appendChild(itemClone);
        });
    }

    tempContainer.appendChild(listClone);
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    try {
        const canvas = await html2canvas(tempContainer, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');

        const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 10, 15, pdfWidth, pdfHeight);

        const fileName = `manutencoes_${modalDateDisplay.textContent.replace(/\//g, '-')}.pdf`;
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);

        if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            try {
                await navigator.share({
                    title: 'Relatório de Manutenção',
                    text: 'Segue o relatório gerado.',
                    files: [file]
                });
            } catch (shareError) {
                window.open(pdfUrl, '_blank');
            }
        } else {
            pdf.save(fileName);
            window.open(pdfUrl, '_blank');
        }

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Houve um erro ao gerar o arquivo.");
    } finally {
        if (document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
        }
    }
}

// ==========================================================
// 8. EVENTOS E INICIALIZAÇÃO
// ==========================================================
async function navigateMonth(direction) {
    if (direction === 'prev') { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } }
    else { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } }
    await loadActivities(currentYear, currentMonth);
    renderCalendar(currentYear, currentMonth);
}

prevMonthBtn.addEventListener('click', () => navigateMonth('prev'));
nextMonthBtn.addEventListener('click', () => navigateMonth('next'));
closeModalBtn.addEventListener('click', () => {
    activityModal.style.display = 'none';
    modalState.level = 1; // Resetar estado ao fechar
});
exportPdfBtn.addEventListener('click', exportToPDF);

const descriptionFilterInput = document.getElementById('description-filter');
const clearFiltersBtn = document.getElementById('clear-filters');

companyFilterBtn.addEventListener('click', () => {
    renderCompanyList();
    companyModal.style.display = 'block';
});

closeCompanyModalBtn.addEventListener('click', () => {
    companyModal.style.display = 'none';
});

cancelCompanyFilterBtn.addEventListener('click', () => {
    companyModal.style.display = 'none';
});

applyCompanyFilterBtn.addEventListener('click', () => {
    const selectedRadio = document.querySelector('input[name="company"]:checked');

    if (selectedRadio) {
        activeFilters.company = selectedRadio.value;
        companyFilterBtn.classList.add('filtro-aplicado');
        companyFilterBtn.innerHTML = `🏢 ${selectedRadio.value}`;
    } else {
        activeFilters.company = '';
        companyFilterBtn.classList.remove('filtro-aplicado');
        companyFilterBtn.innerHTML = '🏢 Selecionar Empresa';
    }

    companyModal.style.display = 'none';
    renderCalendar(currentYear, currentMonth);
});

if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
        const urlCompany = getCompanyFromUrl();

        if (urlCompany) {
            activeFilters.description = '';
            if (descriptionFilterInput) descriptionFilterInput.value = '';
            alert('Você está em modo de visualização restrita. Não é possível limpar o filtro de empresa.');
        } else {
            activeFilters.company = '';
            activeFilters.description = '';

            companyFilterBtn.classList.remove('filtro-aplicado');
            companyFilterBtn.innerHTML = '🏢 Selecionar Empresa';

            if (descriptionFilterInput) descriptionFilterInput.value = '';

            const radios = document.querySelectorAll('input[name="company"]');
            radios.forEach(radio => radio.checked = false);
        }

        renderCalendar(currentYear, currentMonth);
    });
}

window.onclick = (e) => {
    if (e.target === activityModal) {
        activityModal.style.display = 'none';
        modalState.level = 1; // Resetar estado ao fechar
    }
    if (e.target === companyModal) companyModal.style.display = 'none';
};

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const applyFilterWithDebounce = debounce(() => {
    renderCalendar(currentYear, currentMonth);
}, 300);

if (descriptionFilterInput) {
    descriptionFilterInput.addEventListener('input', (e) => {
        activeFilters.description = e.target.value.trim();
        applyFilterWithDebounce();
    });
}

async function init() {
    await loadActivities(currentYear, currentMonth);
    await loadObservacoes(); // NOVO: Carregar observações

    const urlCompany = getCompanyFromUrl();

    if (urlCompany) {
        activeFilters.company = urlCompany;
        companyFilterBtn.classList.add('filtro-aplicado');
        companyFilterBtn.innerHTML = `🏢 ${urlCompany}`;
        companyFilterBtn.style.display = 'none';
    }

    renderCalendar(currentYear, currentMonth);
}

init();