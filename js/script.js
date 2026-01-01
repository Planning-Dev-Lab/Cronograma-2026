// ==========================================================
// 1. VARIÁVEIS DE ESTADO E ELEMENTOS DO DOM
// ==========================================================
const now = new Date();
let currentYear = now.getFullYear();
let currentMonth = now.getMonth(); 
let activities = [];
let dayTeams = {};

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

// ==========================================================
// 3. FUNÇÕES AUXILIARES
// ==========================================================
function getCurrentShift() {
    const hour = new Date().getHours();
    return (hour >= 6 && hour < 18) ? 'day' : 'night';
}

const normalizeText = (text) => text ? text.toUpperCase().replace(/-/g, '_').trim() : 'N_A';
const sanitizeFileName = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
        daysGrid.appendChild(Object.assign(document.createElement('div'), {className: 'day empty'}));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayElement = document.createElement('div');
        dayElement.className = 'day';
        dayElement.innerHTML = `<span class="day-number">${day}</span>`;

        const daily = activities.filter(a => a.date === dateString);

        const countables = daily.filter(a => a.periodicity && COUNTABLE_PERIODICITIES.includes(normalizeText(a.periodicity)));
        if (countables.length > 0) {
            dayElement.innerHTML += `<span class="activity-indicator">${countables.length} Ativ.</span>`;
        }

        // Lógica de Classes
        let appliedClass = null;

        // Limpa qualquer classe de feriado antes de decidir
        dayElement.classList.remove('is-holiday-red', 'holiday');

        if (daily.some(a => a.isHoliday)) {
            appliedClass = DAY_CLASS_MAP['FERIADO'];
            dayElement.classList.add('is-holiday-red'); // SÓ FERIADO REAL FICA VERMELHO
        } else {
            const presentGroups = daily.map(a => a.company_group);
            const winner = DAY_COLOR_PRIORITY_ORDER.find(p => presentGroups.includes(p));
            if (winner) appliedClass = DAY_CLASS_MAP[winner];
            else if (daily.length > 0) appliedClass = 'general-activity';
        }

        if (appliedClass) dayElement.classList.add(appliedClass);
        dayElement.onclick = () => openActivityModal(dateString, daily);
        daysGrid.appendChild(dayElement);
    }
}

// ==========================================================
// 6. LÓGICA DO MODAL (COM VALIDAÇÃO DE DATA ATUAL)
// ==========================================================
function openActivityModal(dateString, daily) {
    modalDateDisplay.textContent = dateString.split('-').reverse().join('/');
    activitiesList.innerHTML = '';
    modalTeamInfo.innerHTML = '';

    // 1. Identificar a data de HOJE no formato YYYY-MM-DD
    const agora = new Date();
    const hojeString = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

    const hasPeriodicActivity = daily.some(a => a.periodicity && COUNTABLE_PERIODICITIES.includes(normalizeText(a.periodicity)));
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
    if (daily.length === 0) {
        activitiesList.innerHTML = '<p class="no-activity">Nenhuma atividade agendada.</p>';
    }
    
    daily.forEach(activity => {
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

window.onclick = (e) => { if (e.target === activityModal) activityModal.style.display = 'none'; };

async function init() {
    await loadActivities(currentYear, currentMonth);
    renderCalendar(currentYear, currentMonth);
}

init();