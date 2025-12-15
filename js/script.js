// VARIÁVEIS DE ESTADO
let currentYear = 2026;
let currentMonth = 0; // 0 = Janeiro, 11 = Dezembro
let activities = []; // Array que armazenará os dados do JSON

// VARIÁVEIS DO DOM
const daysGrid = document.getElementById('days-grid');
const currentMonthYearHeader = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const activityModal = document.getElementById('activity-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalDateDisplay = document.getElementById('modal-date-display');
const activitiesList = document.getElementById('activities-list');

const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// --- LÓGICA DE ESCALA 12X36 (EQUIPE) ---
const DIURNO_TEAMS = ['C', 'D', 'A', 'B']; 
const NOTURNO_TEAMS = ['D', 'A', 'B', 'C'];
// 01/01/2026 é o ponto de partida (Dia 0 do ciclo).
const REFERENCE_DATE = new Date('2026-01-01T00:00:00'); 

/**
 * Calcula a equipe de plantão 12x36 para uma determinada data e hora.
 * @param {string} dateString - Data no formato YYYY-MM-DD.
 * @param {boolean} isCurrentDay - Se é o dia atual.
 * @param {number} currentHour - A hora atual (0-23) se for o dia atual.
 * @returns {string} Equipe de plantão (A, B, C, D) e o turno.
 */
function getOnCallInfo(dateString, isCurrentDay, currentHour) {
    const targetDate = new Date(dateString + 'T00:00:00'); 
    const dayDiffMs = targetDate.getTime() - REFERENCE_DATE.getTime();
    const dayDiff = Math.floor(dayDiffMs / (1000 * 60 * 60 * 24)); 
    const cycleIndex = dayDiff % 4; 
    
    const diurnoTeam = DIURNO_TEAMS[cycleIndex];
    const noturnoTeam = NOTURNO_TEAMS[cycleIndex];
    
    let team = diurnoTeam;
    let turn = 'Diurno'; // Padrão
    
    if (isCurrentDay) {
        // Lógica sensível ao tempo para o dia atual
        if (currentHour >= 6 && currentHour < 18) {
            team = diurnoTeam; // 06:00h até 17:59h
            turn = 'Diurno';
        } else {
            team = noturnoTeam; // 18:00h até 05:59h (do dia seguinte)
            turn = 'Noturno';
        }
    } 
    // Se não for o dia atual, vamos exibir a equipe Diurna como representação do dia.
    
    return { team, turn, isCurrentDay };
}


// --- FUNÇÕES DE LÓGICA DO CALENDÁRIO ---

/**
 * Função principal para desenhar o calendário na tela.
 */
function renderCalendar(year, month) {
    daysGrid.innerHTML = ''; // Limpa o calendário anterior

    // 1. Atualiza o cabeçalho
    currentMonthYearHeader.textContent = `${monthNames[month]} ${year}`; 

    // 2. Cálculo dos dias
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Dia da semana em que o mês começa (0=Dom, 6=Sáb)
    let startDayOfWeek = firstDayOfMonth.getDay();

    // 3. Dias vazios (Preenchimento inicial para alinhar o primeiro dia)
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.classList.add('day', 'empty');
        daysGrid.appendChild(emptyDay);
    }

    // 4. Parâmetros do dia atual para a regra de plantão
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const currentHour = today.getHours();

    // 5. Criação dos Dias do Mês
    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayElement = document.createElement('div');
        dayElement.classList.add('day');
        dayElement.dataset.date = dateString; // Armazena a data

        // Adiciona o número do dia
        dayElement.innerHTML = `<span class="day-number">${day}</span>`;

        // Verifica se há atividades para este dia
        const dailyActivities = activities.filter(a => a.date === dateString);

        // 🆕 LÓGICA DE EQUIPE (Plantão)
        const isCurrentDay = dateString === todayString;
        const onCallInfo = getOnCallInfo(dateString, isCurrentDay, currentHour);
        
        // ❌ Removendo: dayElement.classList.add('on-call-day'); 
        // O destaque visual agora vem da tag da equipe, que é exibida em todos os dias.

        // Lista de periodicidades que DEVEM ser contadas
        const countablePeriodicities = [
            "MENSAL", "BIMESTRAL", "TRIMESTRAL", "QUADRIMESTRAL", "SEMESTRAL", "ANUAL"
        ];

        // Filtra as atividades para contagem (somente as periódicas definidas)
        const countableActivities = dailyActivities.filter(a => 
            countablePeriodicities.includes(a.periodicity)
        );
        
        // Verifica se o dia é FREEZING (para destaque de cor)
        const isFreezing = dailyActivities.some(a => a.priority === "FREEZING");
        
        // VERIFICAÇÃO DE ALTA PRIORIDADE VISUAL (FERIADO OU FREEZING COMERCIAL)
        const isHighPriorityFreezingVisual = dailyActivities.some(a => 
            a.company === "FERIADO" || a.company === "FREEZING COMERCIAL"
        );
        
        // Verifica se há *qualquer* atividade
        const hasActivities = dailyActivities.length > 0;

        // --- LÓGICA DE PRIORIDADE DE CORES ---
        // Aqui mantemos apenas as cores de atividades e freezings
        
        if (isFreezing) {
            
            // 1. MAIOR PRIORIDADE VISUAL: FERIADO OU FREEZING COMERCIAL
            if (isHighPriorityFreezingVisual) {
                dayElement.classList.add('holiday'); 
            } 
            // 2. SEGUNDA PRIORIDADE: TBRA RELEASE ou TBRA NGIN
            else if (dailyActivities.some(a => a.company_group === "TBRA RELEASE" || a.company_group === "TBRA NGIN")) {
                dayElement.classList.add('freezing-tbra-release-ngin');
            } 
            // 3. TERCEIRA PRIORIDADE: TBRA GERAL
            else if (dailyActivities.some(a => a.company === "TBRA")) {
                dayElement.classList.add('freezing-tbra');
            } 
            // 4. QUARTA PRIORIDADE: B2B/HUAWEI
            else if (dailyActivities.some(a => a.company === "B2B" || a.company === "HUAWEI")) {
                dayElement.classList.add('freezing-b2b-huawei');
            }

        } else if (hasActivities) {
            // Lógica para atividades gerais (NÃO FREEZING)
            dayElement.classList.add('general-activity'); 
        }

        // --- INSERÇÃO DOS INDICADORES ---
        
        // Indicador de Atividade (Contador)
        if (hasActivities) {
            const indicator = document.createElement('span');
            indicator.classList.add('activity-indicator');
            indicator.textContent = `${countableActivities.length} Ativ.`;
            dayElement.appendChild(indicator);
        }
        
        // Indicador de EQUIPE (Aparece em TODOS os dias)
        const onCallIndicator = document.createElement('span');
        onCallIndicator.classList.add('on-call-indicator');
        
        // Texto: "EQUIPE X"
        let teamText = `EQUIPE ${onCallInfo.team}`;
        
        // Adiciona o turno no dia atual
        if (onCallInfo.isCurrentDay) {
            teamText += ` (${onCallInfo.turn})`;
        }
        
        onCallIndicator.textContent = teamText;

        dayElement.appendChild(onCallIndicator);
        

        // Adiciona o evento de clique para abrir o modal
        dayElement.addEventListener('click', () => openActivityModal(dateString, dailyActivities, isHighPriorityFreezingVisual));

        daysGrid.appendChild(dayElement);
    }
}

// --- FUNÇÕES DE DADOS E INTERAÇÃO (RESTANTE DO CÓDIGO) ---

/**
 * Carrega os agendamentos do arquivo JSON.
 */
async function loadActivities() {
    try {
        const response = await fetch('./data/activities.json');
        if (!response.ok) {
            console.warn("Arquivo activities.json não encontrado ou vazio. Iniciando com dados vazios.");
            return;
        }
        activities = await response.json();
    } catch (error) {
        console.error("Erro ao carregar os dados das atividades:", error);
    }
}

/**
 * Abre o modal para visualizar as atividades do dia
 */
function openActivityModal(dateString, dailyActivities, isHighPriorityFreezingVisual) {
    
    modalDateDisplay.textContent = dateString;
    activitiesList.innerHTML = ''; // Limpa o conteúdo anterior
    
    const isHoliday = dailyActivities.some(a => a.company === "FERIADO");
    
    // Filtramos apenas o FERIADO para não aparecer duas vezes no aviso e na lista
    const filteredActivities = dailyActivities.filter(a => a.company !== "FERIADO"); 

    let modalTitle;
    
    // Se for feriado, o título é a descrição do feriado + data
    if (isHoliday) {
        const holidayDescription = dailyActivities.find(a => a.company === "FERIADO")?.description || 'Feriado';
        modalTitle = `${holidayDescription}: ${dateString}`;
        
    // Se for Freezing Comercial, ou qualquer outro dia, o título é genérico
    } else {
        modalTitle = `Detalhes do Dia: ${dateString}`;
    }

    document.querySelector('#activity-modal h3').textContent = modalTitle;
    
    // Verifica se deve exibir "Nenhuma atividade"
    if (filteredActivities.length === 0 && !isHighPriorityFreezingVisual) {
        activitiesList.innerHTML = '<p class="no-activity">Nenhuma atividade agendada neste dia.</p>';
    } else {
        
        // AVISO ESPECIAL: SOMENTE PARA FERIADO (a mensagem de aviso em negrito)
        if (isHoliday) {
            activitiesList.innerHTML += `<p style="color: red; font-weight: bold;">⚠️ É um feriado nacional! ${dailyActivities.find(a => a.company === "FERIADO")?.description || ''}</p><hr>`;
        }
        
        // ORDENAÇÃO: Ordenar as atividades antes de renderizar
        filteredActivities.sort((a, b) => {
            const groupA = a.company_group || "Z_DEFAULT"; 
            const groupB = b.company_group || "Z_DEFAULT";
            
            if (groupA < groupB) return -1;
            if (groupA > groupB) return 1;
            
            // Critério secundário: Ordena por empresa
            const companyA = a.company || "";
            const companyB = b.company || "";
            if (companyA < companyB) return -1;
            if (companyA > companyB) return 1;
            
            return 0;
        });
        // FIM DA ORDENAÇÃO

        filteredActivities.forEach(activity => {
            // CRIA A TAGS DE ESTILO
            const periodicityTag = `<span class="periodicidade-tag p-${activity.periodicity}">${activity.periodicity}</span>`;
            
            // >>> TAGS DE PRIORIDADE REMOVIDAS DO MODAL <<<

            // >>> INÍCIO DA LÓGICA DE COR DA BORDA (Engemon) <<<
            let borderClass = `border-p-${activity.periodicity}`; // Padrão: usa a periodicidade

            if (activity.company && activity.company.toUpperCase() === "ENGEMON") {
                
                const descNormalizada = activity.description
                    .normalize("NFD") 
                    .replace(/[\u0300-\u036f]/g, "") 
                    .toUpperCase(); 
                
                // Subgrupo 1: Incêndio/Hidrante
                if (descNormalizada.includes("INCENDIO") || descNormalizada.includes("HIDRANTE")) {
                    borderClass = "border-engemon-incendio"; 
                
                // Subgrupo 2: Automação/Sensores
                } else if (descNormalizada.includes("AUTOMACAO") || descNormalizada.includes("SENSORES")) {
                    borderClass = "border-engemon-automacao"; 
                } 
            }
            // >>> FIM DA LÓGICA DE COR DA BORDA <<<


            // Lógica do groupKey para ORDENAÇÃO
            const groupKey = activity.company_group 
                ? activity.company_group.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
                : "DEFAULT";


            const item = document.createElement('div');
            item.classList.add('activity-item');
            
            // 1. ADICIONA A CLASSE DE ORDENAÇÃO CSS
            item.classList.add(`order-gr-${groupKey}`); 

            // 2. ADICIONA A CLASSE QUE DEFINE A COR DA BORDA LATERAL
            item.classList.add(borderClass); 
            
            // CONTEÚDO FINAL DO CARD: Sem a tag de prioridade.
            item.innerHTML = `
                <h4>${activity.company} ${periodicityTag}</h4>
                <p><strong>Serviço:</strong> ${activity.description}</p>
            `;

            activitiesList.appendChild(item);
        });
    }

    activityModal.style.display = 'block';
}


/**
 * Função para fechar o modal.
 */
function closeModal() {
    activityModal.style.display = 'none';
}

// --- EVENT LISTENERS E INICIALIZAÇÃO ---

// Navegação do Calendário
prevMonthBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar(currentYear, currentMonth);
});

nextMonthBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar(currentYear, currentMonth);
});

// Fechar Modal
closeModalBtn.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
    if (event.target === activityModal) {
        closeModal();
    }
});

// Inicialização: Carrega os dados e desenha o calendário
async function init() {
    await loadActivities(); // Espera os dados carregarem
    renderCalendar(currentYear, currentMonth); // Desenha o calendário
}

init();