// script.js

// Substitua com as suas credenciais reais do Supabase
const SUPABASE_URL = 'https://uodjtrnbaykkbandcwju.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZGp0cm5iYXlra2JhbmRjd2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyOTYxNDksImV4cCI6MjEwMDg3MjE0OX0.Ajq_iyVaRVgjuz_QvM7RhKQId3bs6DmiXm-QfBmSwys';

let supabaseClient = null;
if (SUPABASE_URL.startsWith('http')) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const state = {
    user: null,
    profile: null,
    matches: [],
    bets: [],
    
    // New Cart State
    cart: [],
    isCartOpen: false
};

const AVATARS = [
    'foto de perfil beckenbauer.jpg', 'foto de perfil cr7.jpg', 'foto de perfil cruyff.jpg',
    'foto de perfil eto.jpg', 'foto de perfil haaland.jpg', 'foto de perfil hazard.jpg',
    'foto de perfil kaka.jpg', 'foto de perfil kane.jpg', 'foto de perfil kimmich.jpg',
    'foto de perfil mbappe.jpg', 'foto de perfil messi.jpeg', 'foto de perfil neymar.jpg',
    'foto de perfil palmer.jpg', 'foto de perfil pele.jpeg', 'foto de perfil r9.jpg',
    'foto de perfil romario.jpg', 'foto de perfil ronaldindo.jpeg', 'foto de perfil son.jpg',
    'foto de perfil vinijr.jpeg'
];

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    
    // Mostra o loader enquanto busca os dados
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('hidden');

    try {
        await checkUser();
        
        // Se não estiver logado após checar, exibe o modal de login obrigatório
        if (!state.user) {
            const loginModal = document.getElementById('login-modal');
            if (loginModal) {
                loginModal.classList.remove('hidden');
                loginModal.classList.add('flex');
            }
        }

        await loadMatches();
        
        if (state.user) {
            await loadBets();
        }
    } catch (err) {
        console.error("Erro na inicialização:", err);
        alert("Erro ao conectar no banco de dados. Configure sua URL e KEY do Supabase no script.js!");
    } finally {
        if (loader) loader.classList.add('hidden');
    }

    // Inicializa a UI
    updateUIBalances();
    renderHomeMatches();
    renderBracket();
    renderBetMatches();
    loadLeaderboard();
    
    // Setup Navigation
    // (O onclick já está no HTML chamando nav())

    // Setup Modal Inputs
    
    // Listener do form de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Add close logic for login modal for testing purposes (so user can navigate)
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        // Optional: click outside to close so they aren't stuck if not configured
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                loginModal.classList.remove('flex');
                loginModal.classList.add('hidden');
            }
        });
    }
});

// Autenticação e Carregamento de Dados do Supabase
async function checkUser() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        await loadUserProfile(session.user);
    }
}

async function loadUserProfile(authUser) {
    if (!supabaseClient) return;
    // Tenta pegar o perfil
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
        
    if (profile) {
        state.user = {
            id: authUser.id,
            email: authUser.email
        };
        state.profile = profile;
        
        const loginSection = document.getElementById('login-section');
        const profileInfoSection = document.getElementById('profile-info-section');
        
        if (loginSection) loginSection.classList.add('hidden');
        if (profileInfoSection) profileInfoSection.classList.remove('hidden');
        
        const profileName = document.getElementById('profile-name');
        if (profileName) profileName.innerText = profile.username;
        
        updateUIBalances();
        updateUIAvatars();
    } else {
        // Se não tiver perfil, desloga por segurança ou força a criar
        state.user = null;
    }
}

async function loadMatches() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('matches')
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }); // Ordenar para manter a árvore fixa
        
    if (data) {
        state.matches = data;
    }
}

async function loadBets() {
    if (!supabaseClient || !state.user) return;
    const { data, error } = await supabaseClient
        .from('bets')
        .select(`
            *,
            matches (
                player1_name,
                player2_name
            )
        `)
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: false });
        
    if (data) {
        state.bets = data;
    }
}

async function loadLeaderboard() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('username, coin_balance')
        .order('coin_balance', { ascending: false })
        .limit(3);

    const leaderboardEl = document.getElementById('leaderboard');
    if (!leaderboardEl) return;

    if (error || !data || data.length === 0) {
        leaderboardEl.innerHTML = '<p class="text-sm text-slate-500 text-center py-2">Nenhum dado disponível.</p>';
        return;
    }

    leaderboardEl.innerHTML = data.map((profile, index) => {
        let badgeColor = 'bg-slate-100 text-slate-500';
        if (index === 0) badgeColor = 'bg-amber-100 text-amber-600';
        else if (index === 1) badgeColor = 'bg-slate-200 text-slate-600';
        else if (index === 2) badgeColor = 'bg-orange-100 text-orange-600';

        return `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full ${badgeColor} flex items-center justify-center text-sm font-bold">${index + 1}</div>
                <span class="font-medium text-sm capitalize">${profile.username}</span>
            </div>
            <span class="text-brand-600 font-bold text-sm">${profile.coin_balance.toLocaleString()} CPC</span>
        </div>
        `;
    }).join('');
}

async function handleLogin(e) {
    e.preventDefault();
    if (!supabaseClient) {
        alert("O Supabase não está configurado. Insira sua URL e KEY no script.js!");
        return;
    }
    const username = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    
    if (!username || !pass) {
        alert("Preencha o usuário e a senha.");
        return;
    }
    
    // Converte o usuário para um e-mail fake nos bastidores para o Supabase Auth
    const email = username.toLowerCase().replace(/\s+/g, '') + "@cobracup.com";
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: pass
    });
    
    if (error) {
        alert("Erro no login: " + error.message);
    } else {
        await loadUserProfile(data.user);
        await loadBets();
        renderProfileHistory();
        
        // Esconde modal de login
        const loginModal = document.getElementById('login-modal');
        loginModal.classList.remove('flex');
        loginModal.classList.add('hidden');
        
        // Aplica recompensa diária de +15 CPC
        await giveLoginReward();
    }
}

window.handleSignUp = async function() {
    if (!supabaseClient) {
        alert("O Supabase não está configurado. Insira sua URL e KEY no script.js!");
        return;
    }
    const username = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    
    if (!username || !pass) {
        alert("Preencha o usuário e a senha nos campos acima para se cadastrar.");
        return;
    }
    
    // Converte o usuário para um e-mail fake nos bastidores
    const email = username.toLowerCase().replace(/\s+/g, '') + "@cobracup.com";
    
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: pass
    });
    
    if (error) {
        alert("Erro no cadastro: " + error.message);
    } else {
        alert("Cadastro realizado com sucesso! Você já pode fazer o Login.");
    }
}

window.skipLogin = function() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.classList.remove('flex');
        loginModal.classList.add('hidden');
    }
}

async function giveLoginReward() {
    if (!state.user) return;
    
    const rewardKey = `welcome_bonus_received_${state.user.id}`;
    if (localStorage.getItem(rewardKey)) {
        return; // Usuário já recebeu a recompensa do primeiro login
    }
    
    // Atualiza saldo no Supabase
    const newBalance = state.profile.coin_balance + 15;
    const { error } = await supabaseClient
        .from('profiles')
        .update({ coin_balance: newBalance })
        .eq('id', state.user.id);
        
    if (!error) {
        state.profile.coin_balance = newBalance;
        updateUIBalances();
        
        localStorage.setItem(rewardKey, 'true'); // Marca que já recebeu
        
        // Exibe modal de recompensa
        const rewardModal = document.getElementById('reward-modal');
        const rewardContent = document.getElementById('reward-content');
        
        rewardModal.classList.remove('hidden');
        rewardModal.classList.add('flex');
        
        // Animação de entrada
        setTimeout(() => {
            rewardContent.classList.remove('scale-0');
            rewardContent.classList.add('scale-100');
        }, 50);
    }
}

window.closeRewardModal = function() {
    const rewardModal = document.getElementById('reward-modal');
    const rewardContent = document.getElementById('reward-content');
    
    rewardContent.classList.remove('scale-100');
    rewardContent.classList.add('scale-0');
    
    setTimeout(() => {
        rewardModal.classList.remove('flex');
        rewardModal.classList.add('hidden');
        
        // Abre modal de avatar se usuário ainda não tiver foto
        if (state.user && !state.profile.avatar_url) {
            window.openAvatarModal();
        }
    }, 500);
}

// ====================== AVATAR LOGIC ======================
window.openAvatarModal = function() {
    if (!state.user) return;
    
    const grid = document.getElementById('avatar-grid');
    grid.innerHTML = AVATARS.map((file, idx) => `
        <div onclick="selectAvatar('${file}')" id="avatar-item-${idx}" class="avatar-item cursor-pointer rounded-full overflow-hidden border-4 border-transparent hover:border-brand-300 transition-all aspect-square relative group">
            <img src="perfil/${file}" alt="Craque" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-brand-500/50 hidden items-center justify-center avatar-overlay">
                <i data-lucide="check" class="text-white w-8 h-8"></i>
            </div>
        </div>
    `).join('');
    
    lucide.createIcons();
    document.getElementById('btn-save-avatar').disabled = true;
    
    const modal = document.getElementById('avatar-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
    }, 10);
}

window.closeAvatarModal = function() {
    const modal = document.getElementById('avatar-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

window.selectAvatar = function(fileName) {
    state.selectedAvatarFile = fileName;
    
    document.querySelectorAll('.avatar-item').forEach(item => {
        item.classList.remove('border-brand-500');
        item.classList.add('border-transparent');
        item.querySelector('.avatar-overlay').classList.remove('flex');
        item.querySelector('.avatar-overlay').classList.add('hidden');
    });
    
    const idx = AVATARS.indexOf(fileName);
    if (idx !== -1) {
        const selected = document.getElementById(`avatar-item-${idx}`);
        selected.classList.remove('border-transparent');
        selected.classList.add('border-brand-500');
        selected.querySelector('.avatar-overlay').classList.remove('hidden');
        selected.querySelector('.avatar-overlay').classList.add('flex');
    }
    
    document.getElementById('btn-save-avatar').disabled = false;
}

window.saveSelectedAvatar = async function() {
    if (!state.user || !state.selectedAvatarFile) return;
    
    const btn = document.getElementById('btn-save-avatar');
    btn.disabled = true;
    btn.innerText = "Salvando...";
    
    const avatarUrl = `perfil/${state.selectedAvatarFile}`;
    
    // Tenta salvar no Supabase
    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', state.user.id);
            
        if (error) {
            console.warn("Coluna avatar_url pode não existir. Salvando localmente.", error);
        }
    }
    
    // Salva também localmente por segurança (fallback)
    localStorage.setItem(`avatar_${state.user.id}`, avatarUrl);
    
    state.profile.avatar_url = avatarUrl;
    updateUIAvatars();
    
    showToast("Foto de perfil atualizada!");
    closeAvatarModal();
    
    btn.innerText = "Salvar Foto";
}

function updateUIAvatars() {
    if (!state.user) return;
    
    const url = state.profile.avatar_url;
    if (url) {
        const topbarImg = document.getElementById('topbar-avatar');
        const topbarIcon = document.getElementById('topbar-avatar-icon');
        if(topbarImg) { topbarImg.src = url; topbarImg.classList.remove('hidden'); }
        if(topbarIcon) topbarIcon.classList.add('hidden');
        
        const profileImg = document.getElementById('profile-page-avatar');
        const profileIcon = document.getElementById('profile-page-avatar-icon');
        if(profileImg) { profileImg.src = url; profileImg.classList.remove('hidden'); }
        if(profileIcon) profileIcon.classList.add('hidden');
    }
}
// ==========================================================

// Navegação (SPA)
function nav(pageId) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.dock-item').forEach(btn => {
        btn.classList.remove('active-nav');
    });

    const page = document.getElementById(`page-${pageId}`);
    if (page) {
        page.classList.remove('hidden');
        page.classList.add('fade-in');
    }

    const btn = document.getElementById(`btn-${pageId}`);
    if (btn) {
        btn.classList.add('active-nav');
    }

    const titles = { 'home': 'Dashboard', 'bracket': 'Chaveamento', 'bets': 'Apostas Abertas', 'rules': 'Regras do Torneio', 'profile': 'Meu Perfil' };
    document.getElementById('page-title').innerText = titles[pageId] || '';
    
    if (pageId === 'profile') renderProfileHistory();
    if (pageId === 'bets') renderBetMatches();
}

// Atualizar Saldos na UI
function updateUIBalances() {
    const bal = state.profile ? state.profile.coin_balance.toLocaleString() : '0';
    document.getElementById('coin-balance').innerText = bal;
    document.getElementById('card-balance').innerText = bal;
    
    const profileBal = document.getElementById('profile-balance');
    if (profileBal) profileBal.innerText = bal;
}

// Renderizar Home
function renderHomeMatches() {
    const container = document.getElementById('matches-list');
    if(!container) return;
    container.innerHTML = '';
    
    if (state.matches.length === 0) {
        container.innerHTML = '<div class="col-span-2 text-slate-500 text-sm">Nenhuma partida cadastrada no Supabase ainda.</div>';
        return;
    }
    
    const nextMatches = state.matches.filter(m => m.status === 'pending').slice(0, 4);
    
    nextMatches.forEach(match => {
        container.innerHTML += `
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md flex items-center gap-1">
                        <i data-lucide="clock" class="w-3 h-3"></i> Pendente
                    </span>
                    <span class="text-xs font-bold text-amber-500 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">1x2</span>
                </div>
                <div class="flex justify-between items-center px-2">
                    <div class="text-center font-bold text-slate-800 text-lg flex-1">${match.player1_name}</div>
                    <div class="text-xs font-bold text-slate-400 px-3">VS</div>
                    <div class="text-center font-bold text-slate-800 text-lg flex-1">${match.player2_name}</div>
                </div>
                <div class="mt-5 text-center opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-0 left-0 right-0 bg-white p-2">
                    <button onclick="openBetModal('${match.id}')" class="text-sm text-brand-600 font-bold hover:underline w-full">Apostar nesta partida</button>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

// Renderizar Bracket
function renderBracket() {
    const container = document.getElementById('bracket-container');
    if(!container) return;
    
    if (state.matches.length < 15) {
        container.innerHTML = '<p class="text-center text-slate-500 w-full mt-4">Chaveamento ainda não foi gerado. O admin precisa acessar o painel para inicializar as 15 partidas.</p>';
        return;
    }
    
    const generateMatchHTML = (m, extraClass = '') => {
        const isFinished = m && m.status === 'finished';
        const betButton = isFinished 
            ? `<span class="text-sm text-slate-400 font-bold w-full block"><i data-lucide="lock" class="w-3 h-3 inline"></i> Fechado</span>` 
            : `<button onclick="openBetModal('${m ? m.id : ''}')" class="text-sm text-brand-600 font-bold hover:underline w-full">Fazer Aposta</button>`;
            
        return `
            <div class="match-box ${extraClass} group relative overflow-hidden">
                <div class="match-player">${m && m.player1_name ? m.player1_name : '?'} <span class="score">${m && m.score_p1 !== null ? m.score_p1 : '-'}</span></div>
                <div class="match-player">${m && m.player2_name ? m.player2_name : '?'} <span class="score">${m && m.score_p2 !== null ? m.score_p2 : '-'}</span></div>
                
                <div class="mt-5 text-center opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-0 left-0 right-0 bg-white p-2 border-t border-slate-100">
                    ${m && m.player1_name && m.player2_name ? betButton : ''}
                </div>
            </div>
        `;
    };

    const html = `
        <!-- Left Side: Oitavas -->
        <div class="bracket-round relative">
            <div class="absolute -top-8 w-full text-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">Oitavas</div>
            ${generateMatchHTML(state.matches[0])}
            ${generateMatchHTML(state.matches[1])}
            ${generateMatchHTML(state.matches[2])}
            ${generateMatchHTML(state.matches[3])}
        </div>
        
        <!-- Left Side: Quartas -->
        <div class="bracket-round relative">
            <div class="absolute -top-8 w-full text-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">Quartas</div>
            ${generateMatchHTML(state.matches[8])}
            ${generateMatchHTML(state.matches[9])}
        </div>
        
        <!-- Left Side: Semifinal -->
        <div class="bracket-round relative">
            <div class="absolute -top-8 w-full text-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">Semifinal</div>
            ${generateMatchHTML(state.matches[12])}
        </div>
        
        <!-- Center: FINAL -->
        <div class="bracket-round items-center justify-center px-2 relative min-w-[180px]">
            <div class="flex flex-col items-center justify-center relative w-full gap-4">
                <span class="px-5 py-2 bg-amber-100 text-amber-700 font-black text-sm rounded-xl shadow-sm border border-amber-200 z-10 flex items-center gap-2">
                    <i data-lucide="crown" class="w-4 h-4"></i> FINAL
                </span>
                
                ${generateMatchHTML(state.matches[14], 'border-amber-300 shadow-md')}
                
                <!-- Logo eFootball -->
                <div class="flex flex-col items-center justify-center w-full mt-4 pointer-events-none">
                    <img src="efootball-logo-1.png" alt="eFootball Logo" class="h-24 object-contain opacity-80" onerror="this.style.display='none'">
                </div>
            </div>
            
            <!-- Título Cobra Cup (Rodapé) -->
            <div class="absolute -bottom-20 flex items-center justify-center gap-3 w-[400px] pointer-events-none">
                <h3 class="text-3xl font-black text-slate-800 tracking-wider flex items-center gap-3">
                    COBRA CUP <img src="cobra-logo.png" alt="Cobra Cup Logo" class="h-10 object-contain" onerror="this.style.display='none'">
                </h3>
            </div>
        </div>
        
        <!-- Right Side: Semifinal -->
        <div class="bracket-round relative">
            <div class="absolute -top-8 w-full text-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">Semifinal</div>
            ${generateMatchHTML(state.matches[13])}
        </div>
        
        <!-- Right Side: Quartas -->
        <div class="bracket-round relative">
            <div class="absolute -top-8 w-full text-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">Quartas</div>
            ${generateMatchHTML(state.matches[10])}
            ${generateMatchHTML(state.matches[11])}
        </div>
        
        <!-- Right Side: Oitavas -->
        <div class="bracket-round relative">
            <div class="absolute -top-8 w-full text-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">Oitavas</div>
            ${generateMatchHTML(state.matches[4])}
            ${generateMatchHTML(state.matches[5])}
            ${generateMatchHTML(state.matches[6])}
            ${generateMatchHTML(state.matches[7])}
        </div>
    `;

    container.innerHTML = html;
    lucide.createIcons();
}

// Renderizar Apostas Abertas
function renderBetMatches() {
    const container = document.getElementById('bet-matches-list');
    if(!container) return;
    container.innerHTML = '';
    
    const openMatches = state.matches.filter(m => m.status === 'pending');
    if (openMatches.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-500">Nenhuma partida aberta para apostas no momento.</div>';
    }
    
    openMatches.forEach(match => {
        container.innerHTML += `
            <div class="p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div class="flex items-center gap-4 flex-1 w-full">
                    <div class="bg-slate-100 p-3 rounded-xl">
                        <i data-lucide="gamepad-2" class="text-slate-500"></i>
                    </div>
                    <div>
                        <div class="font-bold text-slate-900">${match.player1_name} vs ${match.player2_name}</div>
                        <div class="text-xs text-slate-500 font-medium">Oitavas de Final</div>
                    </div>
                </div>
                <button onclick="openBetModal('${match.id}')" class="w-full md:w-auto px-6 py-2 bg-white border-2 border-brand-500 text-brand-600 font-bold rounded-xl hover:bg-brand-50 transition-colors shadow-sm whitespace-nowrap">
                    Apostar (2.0x)
                </button>
            </div>
        `;
    });
    lucide.createIcons();
}

// Lógica de Modal de Apostas (Mercados)
window.openBetModal = function(matchId) {
    if (!state.user) {
        alert("Você precisa estar logado para apostar! Vá na aba 'Meu Perfil'.");
        nav('profile');
        return;
    }

    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;
    
    document.getElementById('bet-modal-match-title').innerHTML = `<strong>${match.player1_name}</strong> vs <strong>${match.player2_name}</strong>`;
    
    const marketsContainer = document.getElementById('bet-modal-markets');
    
    const markets = [
        {
            key: 'winner',
            name: 'Vencedor da Partida',
            options: [
                { key: match.player1_name, name: match.player1_name, odd: 2.00 },
                { key: match.player2_name, name: match.player2_name, odd: 2.00 }
            ]
        },
        {
            key: 'goals_2_5',
            name: 'Total de Gols (Acima/Abaixo 2.5)',
            options: [
                { key: 'over', name: 'Mais de 2.5', odd: 1.80 },
                { key: 'under', name: 'Menos de 2.5', odd: 1.80 }
            ]
        },
        {
            key: 'btts',
            name: 'Ambas Equipes Marcam',
            options: [
                { key: 'yes', name: 'Sim', odd: 1.90 },
                { key: 'no', name: 'Não', odd: 1.80 }
            ]
        }
    ];

    let html = '';
    markets.forEach(market => {
        html += `
            <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div class="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-slate-700 text-sm">
                    ${market.name}
                </div>
                <div class="p-3 grid grid-cols-2 gap-2">
                    ${market.options.map(opt => `
                        <button onclick="addToCart('${match.id}', '${match.player1_name} vs ${match.player2_name}', '${market.key}', '${market.name}', '${opt.key}', '${opt.name}', ${opt.odd})" class="flex flex-col items-center justify-center p-3 border-2 border-slate-100 rounded-lg hover:border-brand-500 hover:bg-brand-50 transition-colors">
                            <span class="text-sm font-bold text-slate-700">${opt.name}</span>
                            <span class="text-brand-600 font-black mt-1">${opt.odd.toFixed(2)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    marketsContainer.innerHTML = html;
    document.getElementById('bet-modal').classList.remove('hidden');
    document.getElementById('bet-modal').classList.add('flex');
}

window.closeBetModal = function() {
    document.getElementById('bet-modal').classList.add('hidden');
    document.getElementById('bet-modal').classList.remove('flex');
}

// LÓGICA DO CARRINHO DE APOSTAS
window.toggleCart = function() {
    state.isCartOpen = !state.isCartOpen;
    const cartEl = document.getElementById('bet-cart');
    const fabEl = document.getElementById('cart-fab');
    
    if (state.isCartOpen) {
        cartEl.classList.remove('translate-y-[120%]', 'opacity-0', 'pointer-events-none');
        cartEl.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        if (fabEl) fabEl.classList.add('scale-0'); // Hide FAB when cart is open
    } else {
        cartEl.classList.add('translate-y-[120%]', 'opacity-0', 'pointer-events-none');
        cartEl.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        if (fabEl) fabEl.classList.remove('scale-0'); // Show FAB when cart is closed
    }
}

window.addToCart = function(matchId, matchTitle, marketKey, marketName, selectionKey, selectionName, odd) {
    const existingIndex = state.cart.findIndex(item => item.match_id === matchId && item.market_key === marketKey);
    const item = { match_id: matchId, match_title: matchTitle, market_key: marketKey, market_name: marketName, selection_key: selectionKey, selection_name: selectionName, odd: odd };
    if (existingIndex > -1) { state.cart[existingIndex] = item; } else { state.cart.push(item); }
    showToast(`Adicionado ao cupom: ${selectionName}`);
    renderCart();
    closeBetModal();
    if(!state.isCartOpen) toggleCart();
}

window.removeFromCart = function(index) {
    state.cart.splice(index, 1);
    renderCart();
}

window.renderCart = function() {
    const badge = document.getElementById('cart-badge');
    const badgeFab = document.getElementById('cart-badge-fab');
    const emptyState = document.getElementById('cart-empty');
    const itemsContainer = document.getElementById('cart-items');
    const checkoutArea = document.getElementById('cart-checkout');
    const typeBadge = document.getElementById('cart-type-badge');
    
    if (badge) badge.innerText = state.cart.length;
    if (badgeFab) badgeFab.innerText = state.cart.length;
    
    if (state.cart.length === 0) {
        emptyState.classList.remove('hidden');
        itemsContainer.classList.add('hidden');
        checkoutArea.classList.add('hidden');
        typeBadge.innerText = 'Vazio';
        typeBadge.className = 'bg-slate-700 px-2 py-1 rounded text-xs font-bold text-slate-400';
    } else {
        emptyState.classList.add('hidden');
        itemsContainer.classList.remove('hidden');
        checkoutArea.classList.remove('hidden');
        typeBadge.innerText = state.cart.length > 1 ? 'Múltipla' : 'Simples';
        typeBadge.className = state.cart.length > 1 ? 'bg-amber-500 px-2 py-1 rounded text-xs font-bold text-slate-900 shadow-sm' : 'bg-brand-500 px-2 py-1 rounded text-xs font-bold text-white shadow-sm';
        
        let html = '';
        let totalOdd = 1.0;
        state.cart.forEach((item, index) => {
            totalOdd *= item.odd;
            html += `
                <div class="bg-white p-3 rounded-xl border border-slate-200 relative">
                    <button onclick="removeFromCart(${index})" class="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    <div class="text-xs text-slate-500 font-bold mb-1">${item.match_title}</div>
                    <div class="text-sm font-bold text-slate-800">${item.market_name}</div>
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-sm font-black text-brand-600">${item.selection_name}</span>
                        <span class="text-sm font-black bg-slate-100 px-2 py-1 rounded border border-slate-200">${item.odd.toFixed(2)}</span>
                    </div>
                </div>
            `;
        });
        itemsContainer.innerHTML = html;
        document.getElementById('cart-total-odds').innerText = totalOdd.toFixed(2);
        lucide.createIcons();
        updateCartPotential();
    }
}

window.updateCartPotential = function() {
    const amount = parseInt(document.getElementById('cart-amount').value) || 0;
    if (state.cart.length === 0) {
        document.getElementById('cart-potential').innerText = '0';
        return;
    }
    let totalOdd = 1.0;
    state.cart.forEach(item => totalOdd *= item.odd);
    document.getElementById('cart-potential').innerText = Math.floor(amount * totalOdd);
}

window.placeCartBet = async function() {
    if (!state.user) { alert("Você precisa estar logado!"); return; }
    if (state.cart.length === 0) { alert("Seu cupom está vazio."); return; }
    const amount = parseInt(document.getElementById('cart-amount').value);
    if (isNaN(amount) || amount <= 0) { alert("Insira um valor válido para a aposta."); return; }
    if (!state.profile || state.profile.coin_balance < amount) { alert("Saldo insuficiente!"); return; }

    try {
        let totalOdd = 1.0;
        state.cart.forEach(item => totalOdd *= item.odd);
        const type = state.cart.length > 1 ? 'multiple' : 'single';

        const { error } = await supabaseClient.from('bets').insert({
            user_id: state.user.id,
            amount: amount,
            type: type,
            predictions: state.cart,
            potential_payout: Math.floor(amount * totalOdd),
            status: 'pending'
        });

        if (error) throw error;
        
        const newBalance = state.profile.coin_balance - amount;
        await supabaseClient.from('profiles').update({ coin_balance: newBalance }).eq('id', state.user.id);
        
        state.profile.coin_balance = newBalance;
        updateUIBalances();
        showToast("Aposta realizada com sucesso!");
        
        state.cart = [];
        document.getElementById('cart-amount').value = '';
        renderCart();
        toggleCart();
        if (state.user) {
            await loadBets();
            renderProfileHistory();
        }
    } catch (err) {
        alert("Erro ao realizar aposta: " + err.message);
    }
}

// Histórico de Apostas
function renderProfileHistory() {
    const emptyState = document.getElementById('bet-history-empty');
    const list = document.getElementById('bet-history-list');
    
    if (state.bets.length === 0) {
        if(emptyState) emptyState.classList.remove('hidden');
        if(list) list.classList.add('hidden');
        return;
    }
    
    if(emptyState) emptyState.classList.add('hidden');
    if(list) list.classList.remove('hidden');
    
    list.innerHTML = state.bets.map(bet => {
        let statusBadge = '<span class="bg-amber-100 border border-amber-200 text-amber-700 text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider">Pendente</span>';
        let statusIcon = '<i data-lucide="clock" class="w-4 h-4 text-amber-500"></i>';
        if (bet.status === 'won') {
            statusBadge = '<span class="bg-brand-100 border border-brand-200 text-brand-700 text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider">Ganha</span>';
            statusIcon = '<i data-lucide="check-circle-2" class="w-4 h-4 text-brand-500"></i>';
        }
        if (bet.status === 'lost') {
            statusBadge = '<span class="bg-red-100 border border-red-200 text-red-700 text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider">Perdida</span>';
            statusIcon = '<i data-lucide="x-circle" class="w-4 h-4 text-red-500"></i>';
        }

        const title = (bet.type === 'multiple' && bet.predictions) ? `${bet.predictions.length}-seleções` : 'Aposta Simples';
        const payout = bet.potential_payout ? bet.potential_payout : (bet.amount * 2);

        let legsHTML = '';
        if (bet.predictions && bet.predictions.length > 0) {
            legsHTML = bet.predictions.map(p => `
                <div class="p-3 bg-white">
                    <div class="flex justify-between items-start mb-1">
                        <div class="flex items-center gap-2">
                            <i data-lucide="target" class="w-4 h-4 text-brand-600"></i>
                            <span class="font-bold text-slate-800 text-sm">${p.market_name}</span>
                            ${statusIcon}
                        </div>
                        <span class="font-bold text-slate-700 text-sm">${p.odd ? p.odd.toFixed(2) : '-'}</span>
                    </div>
                    <div class="pl-6">
                        <div class="font-bold text-slate-700 text-sm">${p.selection_name}</div>
                        <div class="text-xs text-slate-400 mt-0.5">${p.match_title}</div>
                    </div>
                </div>
            `).join('<div class="h-px bg-slate-100 mx-3"></div>');
        } else {
            legsHTML = `
                <div class="p-3 bg-white">
                    <div class="flex items-center gap-2 mb-1">
                        <i data-lucide="trophy" class="w-4 h-4 text-amber-500"></i>
                        <span class="font-bold text-slate-800 text-sm">Vencedor da Partida</span>
                    </div>
                    <div class="pl-6">
                        <div class="font-bold text-slate-700 text-sm">${bet.predicted_winner}</div>
                        <div class="text-xs text-slate-400 mt-0.5">Aposta Legada</div>
                    </div>
                </div>
            `;
        }

        return `
            <details class="group bg-white border border-slate-200 rounded-xl mb-3 shadow-sm overflow-hidden" open>
                <summary class="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors list-none [&::-webkit-details-marker]:hidden">
                    <div class="flex flex-col">
                        <div class="font-black text-slate-800 text-sm mb-1 flex items-center gap-2">
                            ${title}
                            <span class="text-xs text-slate-500 font-medium">Valor: ${bet.amount} <img src="cup-coin.png" class="w-3 h-3 object-contain inline-block align-middle mb-0.5"></span>
                        </div>
                        <div class="text-xs text-slate-600 font-bold">
                            Retorno Potencial: <span class="text-brand-600">${payout} <img src="cup-coin.png" class="w-3 h-3 object-contain inline-block align-middle mb-0.5"></span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        ${statusBadge}
                        <i data-lucide="chevron-down" class="w-5 h-5 text-slate-400 group-open:-rotate-180 transition-transform duration-300"></i>
                    </div>
                </summary>
                <div class="bg-slate-50 flex flex-col">
                    ${legsHTML}
                </div>
            </details>
        `;
    }).join('');
    
    lucide.createIcons();
}

// UI Helpers
function showToast(message) {
    const toast = document.getElementById('toast');
    if(!toast) return;
    document.getElementById('toast-message').innerText = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
}

/* ---------------------------------
   MAC OS DOCK LOGIC
---------------------------------- */
function initDock() {
    const dockPanel = document.getElementById('dock-panel');
    if (!dockPanel) return;

    const items = dockPanel.querySelectorAll('.dock-item');
    const baseItemSize = 44;
    const magnification = 60;
    const maxDistance = 200; // max distance to affect the icon

    // Mouse tracking on the whole window
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX;
        
        // If mouse is too far vertically from dock, reset sizes to base
        const dockRect = dockPanel.getBoundingClientRect();
        const mouseY = e.clientY;
        const isNearDockVertically = mouseY >= (dockRect.top - 100) && mouseY <= (dockRect.bottom + 100);

        items.forEach(item => {
            if (!isNearDockVertically) {
                item.style.width = `${baseItemSize}px`;
                item.style.height = `${baseItemSize}px`;
                return;
            }

            const itemRect = item.getBoundingClientRect();
            // Calculate center of the item
            const itemCenterX = itemRect.left + (baseItemSize / 2); // use base size for stable center
            
            // Calculate distance from mouse to item center
            const distance = Math.abs(mouseX - itemCenterX);
            
            // Map distance to size (Linear interpolation with slight curve)
            if (distance < maxDistance) {
                const factor = 1 - (distance / maxDistance);
                const curvedFactor = Math.pow(factor, 1.2); 
                const newSize = baseItemSize + (magnification - baseItemSize) * curvedFactor;
                item.style.width = `${newSize}px`;
                item.style.height = `${newSize}px`;
            } else {
                item.style.width = `${baseItemSize}px`;
                item.style.height = `${baseItemSize}px`;
            }
        });
    });

    // Reset when mouse leaves the window entirely
    document.addEventListener('mouseleave', () => {
        items.forEach(item => {
            item.style.width = `${baseItemSize}px`;
            item.style.height = `${baseItemSize}px`;
        });
    });
}

// UPDATE MODAL LOGIC
window.openUpdateModal = function() {
    const modal = document.getElementById('update-modal');
    const content = document.getElementById('update-modal-content');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    const claimed = localStorage.getItem('update_v2_claimed') === 'true';
    if (claimed) {
        document.getElementById('reward-container').classList.add('hidden');
        document.getElementById('close-container').classList.remove('hidden');
    } else {
        document.getElementById('reward-container').classList.remove('hidden');
        document.getElementById('close-container').classList.add('hidden');
    }

    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

window.closeUpdateModal = function() {
    const modal = document.getElementById('update-modal');
    const content = document.getElementById('update-modal-content');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        localStorage.setItem('update_v2_seen', 'true');
    }, 300);
}

window.claimUpdateReward = async function() {
    if (!state.user || !state.user.id || !state.profile) {
        showToast("Você precisa logar primeiro!");
        closeUpdateModal();
        return;
    }
    
    const btn = event.currentTarget;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Resgatando...';
    btn.disabled = true;
    
    const newBalance = (state.profile.coin_balance || 0) + 150;
    
    const { error } = await supabaseClient
        .from('profiles')
        .update({ coin_balance: newBalance })
        .eq('id', state.user.id);
        
    if (error) {
        showToast("Erro ao resgatar moedas.");
        btn.innerHTML = '<i data-lucide="gift" class="w-5 h-5"></i> Resgatar 150 CPC Grátis!';
        btn.disabled = false;
        lucide.createIcons();
        return;
    }
    
    state.profile.coin_balance = newBalance;
    
    // Atualizar UI
    const bal = newBalance.toLocaleString();
    const topBal = document.getElementById('coin-balance');
    const cardBal = document.getElementById('card-balance');
    const profBal = document.getElementById('profile-balance');
    if (topBal) topBal.innerText = bal;
    if (cardBal) cardBal.innerText = bal;
    if (profBal) profBal.innerText = bal;

    localStorage.setItem('update_v2_claimed', 'true');
    localStorage.setItem('update_v2_seen', 'true');
    showToast("150 CPC resgatadas com sucesso! 🎉");
    closeUpdateModal();
}

document.addEventListener('DOMContentLoaded', () => {
    initDock();
    setTimeout(() => {
        if (localStorage.getItem('update_v2_seen') !== 'true') {
            openUpdateModal();
        }
    }, 1500);
});
