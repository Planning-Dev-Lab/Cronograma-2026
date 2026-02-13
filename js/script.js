// ==========================================================
// 1. VARIÁVEIS DE ESTADO E ELEMENTOS DO DOM
// ==========================================================
const now = new Date();
let currentYear = now.getFullYear();
let currentMonth = now.getMonth();
let activities = [];
let dayTeams = {};
let activeFilters = {
    company: '',
    description: ''
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
    'SOTREQ', 'ENERG', 'FERIADO', 'TBRA', 'B2B TBRA'
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
// Modificar a função applyFilters existente
function applyFilters(activitiesArray, filters) {
    return activitiesArray.filter(activity => {
        // Verificar filtro de empresa (agora busca exata ou vazia)
        const companyMatch = !filters.company ||
            (activity.company &&
                activity.company.toLowerCase() === filters.company.toLowerCase());

        // Verificar filtro de descrição (mantém busca parcial)
        const descriptionMatch = !filters.description ||
            (activity.description &&
                activity.description.toLowerCase().includes(filters.description.toLowerCase()));

        return companyMatch && descriptionMatch;
    });
}

// Na Seção 3 (Funções Auxiliares), após applyFilters
function renderCompanyList() {
    const companyList = document.querySelector('.company-list');
    
    // Verifica se encontrou
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

        // Marcar se já estiver selecionada
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

// Chave secreta - em produção, use uma mais complexa e guarde no servidor
const SECRET_KEY = 'MinhaChaveSuperSecreta2026!@#$';

function encryptCompany(companyName) {
    try {
        // Adiciona timestamp para evitar que links sejam válidos para sempre (opcional)
        const data = {
            company: companyName,
            exp: new Date('2026-12-31').getTime() // validade 31/12/2026
        };
        
        // Criptografa
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
        
        // Codifica para URL
        return encodeURIComponent(encrypted);
    } catch (e) {
        console.error('Erro ao criptografar:', e);
        return null;
    }
}

function decryptCompany(encryptedString) {
    try {
        if (!encryptedString) return null;
        
        // Decodifica da URL
        const decoded = decodeURIComponent(encryptedString);
        
        // Descriptografa
        const bytes = CryptoJS.AES.decrypt(decoded, SECRET_KEY);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        
        // Verifica se o link expirou
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

// Função para gerar link compartilhável
function generateShareableLink(companyName) {
    const encrypted = encryptCompany(companyName);
    if (!encrypted) return null;
    
    // Pega a URL atual sem parâmetros
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?empresa=${encrypted}`;
}

// Função para ler filtro da URL
function getCompanyFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const encryptedParam = urlParams.get('empresa');
    
    if (!encryptedParam) return null;
    
    return decryptCompany(encryptedParam);
}

// ==========================================================
// 4. CARREGAMENTO DOS DADOS (JSON)
// ==========================================================
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

        // === MODIFICAÇÃO 1: Aplicar filtros às atividades ===
        const filteredDaily = applyFilters(daily, activeFilters);
        // ====================================================

        // === MODIFICAÇÃO 2: Usar filteredDaily para contagem ===
        const countables = filteredDaily.filter(a => a.periodicity && COUNTABLE_PERIODICITIES.includes(normalizeText(a.periodicity)));
        if (countables.length > 0) {
            dayElement.innerHTML += `<span class="activity-indicator">${countables.length} Ativ.</span>`;
        }
        // =======================================================

        // Lógica de Classes
        let appliedClass = null;

        // Limpa qualquer classe de feriado antes de decidir
        dayElement.classList.remove('is-holiday-red', 'holiday');

        // === MODIFICAÇÃO 3: Usar filteredDaily para determinar cores ===
        if (filteredDaily.some(a => a.isHoliday)) {
            appliedClass = DAY_CLASS_MAP['FERIADO'];
            dayElement.classList.add('is-holiday-red'); // SÓ FERIADO REAL FICA VERMELHO
        } else {
            // CORREÇÃO: Usar filteredDaily aqui também
            const presentGroups = filteredDaily.map(a => a.company_group);
            const winner = DAY_COLOR_PRIORITY_ORDER.find(p => presentGroups.includes(p));
            if (winner) appliedClass = DAY_CLASS_MAP[winner];
            else if (filteredDaily.length > 0) appliedClass = 'general-activity';
        }
        // ================================================================

        if (appliedClass) dayElement.classList.add(appliedClass);

        // === MODIFICAÇÃO 4: Passar ambos daily e filteredDaily para o modal ===
        dayElement.onclick = () => openActivityModal(dateString, daily, filteredDaily);
        // ======================================================================

        daysGrid.appendChild(dayElement);
    }
}
// ==========================================================
// 6. LÓGICA DO MODAL (COM VALIDAÇÃO DE DATA ATUAL)
// ==========================================================
function openActivityModal(dateString, daily, filteredActivities = null) {
    modalDateDisplay.textContent = dateString.split('-').reverse().join('/');
    activitiesList.innerHTML = '';
    modalTeamInfo.innerHTML = '';

    const activitiesToShow = filteredActivities !== null ? filteredActivities : daily;

    // 1. Identificar a data de HOJE no formato YYYY-MM-DD
    const agora = new Date();
    const hojeString = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

    const hasPeriodicActivity = activitiesToShow.some(a => a.periodicity && COUNTABLE_PERIODICITIES.includes(normalizeText(a.periodicity)));
    exportPdfBtn.style.display = hasPeriodicActivity ? 'block' : 'none';

    const team = dayTeams[dateString];
    const shift = getCurrentShift();

    if (team) {
        // 2. Só exibe o selo se a data clicada (dateString) for igual a hoje (hojeString)
        const isToday = (dateString === hojeString);

        const seloDia = (isToday && shift === 'day') ? '<span style="color: #0056b3; font-weight: bold;"> (Plantão Agora)</span>' : '';
        const seloNoite = (isToday && shift === 'night') ? '<span style="color: #0056b3; font-weight: bold;"> (Plantão Agora)</span>' : '';

        modalTeamInfo.innerHTML = `
            <div class="on-call-modal">☀️ <strong>Equipe Diurna:</strong> ${team.day || '---'} ${seloDia}</div>
            <div class="on-call-modal">🌙 <strong>Equipe Noturna:</strong> ${team.night || '---'} ${seloNoite}</div>
        `;
    }

    // ... (restante do código de exibição das atividades)
    if (activitiesToShow.length === 0) {
        activitiesList.innerHTML = '<p class="no-activity">Nenhuma atividade agendada.</p>';
    }

    activitiesToShow.forEach(activity => {
        // ... (seu código de renderização das atividades continua aqui)
        const div = document.createElement('div');
        div.className = 'activity-item';
        // ... (etc)
        const pText = normalizeText(activity.periodicity);
        const isPeriodic = COUNTABLE_PERIODICITIES.includes(pText);
        if (isPeriodic) div.classList.add('is-countable-task');
        if (activity.isHoliday) {
            div.style.borderLeft = '5px solid red';
            div.innerHTML = `🛑 <strong>FERIADO:</strong> ${activity.description}`;
        } else {
            const tag = isPeriodic ? `<span class="periodicidade-tag p-${pText}">${pText}</span>` : '';
            let borderClass = activity.service_type ? `border-${activity.service_type}` : (activity.company_group ? `border-group-${activity.company_group}` : `border-p-${pText}`);
            div.classList.add(borderClass);
            div.innerHTML = `<h4>${activity.company} ${tag}</h4><p><strong>Descrição:</strong> ${activity.description}</p>`;
        }
        activitiesList.appendChild(div);
    });

    activityModal.style.display = 'block';
}

// ==========================================================
// 7. EXPORTAÇÃO PDF
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
    const originalItems = activitiesList.querySelectorAll('.activity-item.is-countable-task');

    originalItems.forEach(item => {
        const itemClone = item.cloneNode(true);
        itemClone.style.marginBottom = '15px';
        itemClone.style.padding = '15px';
        itemClone.style.border = '1px solid #eee';
        itemClone.style.borderLeft = item.style.borderLeft || window.getComputedStyle(item).borderLeft;
        itemClone.style.pageBreakInside = 'avoid';
        listClone.appendChild(itemClone);
    });

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

        // Verifica se é mobile para usar a Web Share API
        if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            try {
                await navigator.share({
                    title: 'Relatório de Manutenção',
                    text: 'Segue o relatório gerado.',
                    files: [file]
                });
            } catch (shareError) {
                // Se o usuário cancelar o compartilhamento, abre no navegador
                window.open(pdfUrl, '_blank');
            }
        } else {
            // Desktop: Baixa e abre em nova aba
            pdf.save(fileName);
            window.open(pdfUrl, '_blank');
        }

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Houve um erro ao gerar o arquivo.");
    } finally {
        // IMPORTANTE: Limpa o elemento criado para não poluir o HTML
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
closeModalBtn.addEventListener('click', () => activityModal.style.display = 'none');
exportPdfBtn.addEventListener('click', exportToPDF);

// Elementos dos filtros (AJUSTADO)
const descriptionFilterInput = document.getElementById('description-filter');
const clearFiltersBtn = document.getElementById('clear-filters');

// Event listeners para o modal de empresas
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

// Event listener para clearFilters (VERSÃO ATUALIZADA)
// Event listener para clearFilters (VERSÃO CORRIGIDA)
if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
        // Verifica se veio de um link compartilhado
        const urlCompany = getCompanyFromUrl();
        
        if (urlCompany) {
            // Se veio de link, NÃO limpa o filtro de empresa
            activeFilters.description = '';
            // Mantém activeFilters.company = urlCompany
            
            if (descriptionFilterInput) descriptionFilterInput.value = '';
            
            // Mostra um aviso sutil (opcional)
            alert('Você está em modo de visualização restrita. Não é possível limpar o filtro de empresa.');
        } else {
            // Modo normal: limpa todos os filtros
            activeFilters.company = '';
            activeFilters.description = '';
            
            // Resetar botão de empresa
            companyFilterBtn.classList.remove('filtro-aplicado');
            companyFilterBtn.innerHTML = '🏢 Selecionar Empresa';
            
            if (descriptionFilterInput) descriptionFilterInput.value = '';
            
            // Desmarcar radio no modal
            const radios = document.querySelectorAll('input[name="company"]');
            radios.forEach(radio => radio.checked = false);
        }
        
        renderCalendar(currentYear, currentMonth);
    });
}

// Fechar ambos modais ao clicar fora
window.onclick = (e) => { 
    if (e.target === activityModal) activityModal.style.display = 'none';
    if (e.target === companyModal) companyModal.style.display = 'none';
};

// Debounce para o filtro de descrição
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

// Event listener para descrição (mantém busca parcial)
if (descriptionFilterInput) {
    descriptionFilterInput.addEventListener('input', (e) => {
        activeFilters.description = e.target.value.trim();
        applyFilterWithDebounce();
    });
}

async function init() {
    await loadActivities(currentYear, currentMonth);
    
    // Verifica se há empresa na URL
    const urlCompany = getCompanyFromUrl();
    
    if (urlCompany) {
        // Se veio de um link compartilhado, aplica o filtro
        activeFilters.company = urlCompany;
        companyFilterBtn.classList.add('filtro-aplicado');
        companyFilterBtn.innerHTML = `🏢 ${urlCompany}`;
        
        // Opcional: Esconder o botão de filtro para não permitir trocar
        companyFilterBtn.style.display = 'none';
        
        // Opcional: Mostrar mensagem de "Visualização restrita"
        //showRestrictedViewMessage(urlCompany);
    }
    
    renderCalendar(currentYear, currentMonth);
}

init();