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

// --- FUNÇÕES DE LÓGICA DO CALENDÁRIO ---

/**
 * Função principal para desenhar o calendário na tela.
 */
function renderCalendar(year, month) {
    daysGrid.innerHTML = ''; // Limpa o calendário anterior

    // 1. Atualiza o cabeçalho
    currentMonthYearHeader.textContent = `${monthNames[month]} - ${year}`;

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

    // 4. Criação dos Dias do Mês
    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayElement = document.createElement('div');
        dayElement.classList.add('day');
        dayElement.dataset.date = dateString; // Armazena a data

        // Adiciona o número do dia
        dayElement.innerHTML = `<span class="day-number">${day}</span>`;

        // Verifica se há atividades para este dia
        const dailyActivities = activities.filter(a => a.date === dateString);

        // NOVO: Verifica se o dia é um feriado
        const isHoliday = dailyActivities.some(a => a.company === "FERIADO");

        if (isHoliday) {
            // APLICA O DESTAQUE EM VERMELHO (usa o CSS que definimos)
            dayElement.classList.add('holiday');
            // Se for feriado, NÃO queremos mostrar o indicador de atividade padrão (opcional)
        }
        
        if (dailyActivities.length > 0 && !isHoliday) { // Não mostra indicador de atividade se for feriado
            // Se houver atividades (e não for feriado), adiciona um indicador visual
            const indicator = document.createElement('span');
            indicator.classList.add('activity-indicator');
            indicator.textContent = `${dailyActivities.length} Ativ.`;
            dayElement.appendChild(indicator);
            
            // Adiciona a classe para destaque de dias com atividade
            dayElement.classList.add('has-activity');
        }


        // Adiciona o evento de clique para abrir o modal
        dayElement.addEventListener('click', () => openActivityModal(dateString, dailyActivities, isHoliday));

        daysGrid.appendChild(dayElement);
    }
}

// --- FUNÇÕES DE DADOS E INTERAÇÃO ---

/**
 * Carrega os agendamentos do arquivo JSON.
 */
async function loadActivities() {
    try {
        const response = await fetch('./data/activities.json');
        if (!response.ok) {
            // Se o arquivo não for encontrado ou der erro
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
function openActivityModal(dateString, dailyActivities, isHoliday) {
    // Se for feriado, vamos mudar o título do modal para destacar
    modalDateDisplay.textContent = dateString;
    activitiesList.innerHTML = ''; // Limpa o conteúdo anterior
    
    // Filtra o feriado, para que não apareça apenas a palavra "FERIADO" no item de atividade
    const filteredActivities = dailyActivities.filter(a => a.company !== "FERIADO");
    
    let modalTitle = isHoliday ? `FERIADO: ${dateString}` : `Detalhes do Dia: ${dateString}`;
    document.querySelector('#activity-modal h3').textContent = modalTitle;
    
    if (filteredActivities.length === 0 && !isHoliday) {
        activitiesList.innerHTML = '<p class="no-activity">Nenhuma atividade agendada neste dia.</p>';
    } else {
        if (isHoliday) {
            activitiesList.innerHTML += `<p style="color: red; font-weight: bold;">⚠️ É um feriado nacional! ${dailyActivities.find(a => a.company === "FERIADO")?.description || ''}</p><hr>`;
        }
        
        filteredActivities.forEach(activity => {
            const item = document.createElement('div');
            item.classList.add('activity-item');
            item.innerHTML = `
                <h4>${activity.company}</h4>
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