// ==========================================
// SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://kiudufbqyfzknarfrkcm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdWR1ZmJxeWZ6a25hcmZya2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzk1NzEsImV4cCI6MjA4NDk1NTU3MX0.b4ZhGAS7BrNYhTqUMr73xC7VpO0783oPO8x1Yi7Wkuw';

// Create a single client and store it globally to avoid redeclaration
if (!window.supabaseClient) {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Use this in your app instead of 'supabase'
const supabaseClient = window.supabaseClient;

// ==========================================
// CONSTANTS
// ==========================================
const SHIPS = ['Klance', 'Merthur', 'Hollanov', 'Drarry'];
const RATINGS = ['Terrible', 'Bad', 'Fine', 'Good', 'Great', 'Amazing', 'Favorite'];
const STATUSES = ['To Read', 'Reading', 'Paused', 'Read', 'DNF'];
const DEFAULT_TAGS = [
    'Angst', 'Fluff', 'Hurt/Comfort', 'Slow Burn', 'Enemies to Lovers',
    'Friends to Lovers', 'Canon Divergence', 'AU', 'Fix-It', 'Crack',
    'Smut', 'Pining', 'Mutual Pining', 'Happy Ending', 'Sad Ending'
];

// ==========================================
// STATE
// ==========================================
let currentShip = 'dashboard';
let editingFicId = null;
let sortBy = 'title';
let sortDir = 'asc';
let filters = {};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    renderTagsInModal();
    setDefaultDate();
    loadDashboard();
});

function initializeEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = e.target.dataset.page;
            navigateToPage(page);
        });
    });

    // Add buttons
    document.getElementById('add-fic-btn').addEventListener('click', () => openModal());
    document.getElementById('add-ship-fic-btn').addEventListener('click', () => openModal(currentShip));

    // Modal
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeModal();
    });

    // Form
    document.getElementById('fic-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('fetch-ao3-btn').addEventListener('click', fetchFromAO3);

    // Filters
    document.getElementById('search-input').addEventListener('input', applyFilters);
    document.getElementById('status-filter').addEventListener('change', applyFilters);
    document.getElementById('rating-filter').addEventListener('change', applyFilters);
    document.getElementById('explicit-filter').addEventListener('change', applyFilters);
    document.getElementById('sort-by').addEventListener('change', (e) => {
        sortBy = e.target.value;
        applyFilters();
    });
    document.getElementById('sort-dir-btn').addEventListener('click', toggleSortDir);
}

// ==========================================
// NAVIGATION
// ==========================================
function navigateToPage(page) {
    currentShip = page;
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Show/hide pages
    if (page === 'dashboard') {
        document.getElementById('dashboard-page').classList.add('active');
        document.getElementById('ship-page').classList.remove('active');
        loadDashboard();
    } else {
        document.getElementById('dashboard-page').classList.remove('active');
        document.getElementById('ship-page').classList.add('active');
        document.getElementById('ship-title').textContent = page;
        resetFilters();
        loadShipFics(page);
    }
}

// ==========================================
// DASHBOARD
// ==========================================
async function loadDashboard() {
    try {
        const { data: fics, error } = await supabaseClient
            .from('fanfics')
            .select('*');

        if (error) throw error;

        const stats = {
            total: fics.length,
            read: fics.filter(f => f.status === 'Read').length,
            reading: fics.filter(f => f.status === 'Reading').length,
            toRead: fics.filter(f => f.status === 'To Read').length,
            paused: fics.filter(f => f.status === 'Paused').length,
            dnf: fics.filter(f => f.status === 'DNF').length,
            // UPDATED LOGIC BELOW
            totalWords: fics.reduce((sum, f) => {
                const words = f.word_count || 0;
                const rereadCount = (f.rereads && f.rereads.length) ? f.rereads.length : 0;
                
                // Only count words if the status is "Read"
                // This adds the initial read (1) + any rereads
                if (f.status === 'Read') {
                    return sum + (words * (1 + rereadCount));
                }
                return sum;
            }, 0),
            favorites: fics.filter(f => f.rating === 'Favorite').length
        };

        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-read').textContent = stats.read;
        document.getElementById('stat-reading').textContent = stats.reading;
        document.getElementById('stat-toread').textContent = stats.toRead;
        document.getElementById('stat-paused').textContent = stats.paused;
        document.getElementById('stat-dnf').textContent = stats.dnf;
        document.getElementById('stat-words').textContent = stats.totalWords.toLocaleString();
        document.getElementById('stat-favorites').textContent = stats.favorites;
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Error loading dashboard. Check console for details.');
    }
}
// ==========================================
// SHIP PAGE
// ==========================================
async function loadShipFics(ship) {
    try {
        const { data: fics, error } = await supabaseClient
            .from('fanfics')
            .select('*')
            .eq('ship', ship);

        if (error) throw error;

        renderFics(fics || []);
    } catch (error) {
        console.error('Error loading fics:', error);
        alert('Error loading fanfics. Check console for details.');
    }
}

function renderFics(fics) {
    const container = document.getElementById('fics-container');
    
    if (fics.length === 0) {
        container.innerHTML = '<div class="empty-state">No fanfics found. Add one to get started!</div>';
        return;
    }

    // Apply filters
    let filtered = fics;
    
    const searchText = document.getElementById('search-input').value.toLowerCase();
    if (searchText) {
        filtered = filtered.filter(f => 
            f.title.toLowerCase().includes(searchText) || 
            f.author.toLowerCase().includes(searchText)
        );
    }

    const statusFilter = document.getElementById('status-filter').value;
    if (statusFilter) {
        filtered = filtered.filter(f => f.status === statusFilter);
    }

    const ratingFilter = document.getElementById('rating-filter').value;
    if (ratingFilter) {
        filtered = filtered.filter(f => f.rating === ratingFilter);
    }

    const explicitFilter = document.getElementById('explicit-filter').value;
    if (explicitFilter) {
        filtered = filtered.filter(f => f.explicit === (explicitFilter === 'true'));
    }

    // Sort
    filtered.sort((a, b) => {
        let aVal, bVal;
        
        if (sortBy === 'word_count') {
            aVal = a.word_count || 0;
            bVal = b.word_count || 0;
        } else if (sortBy === 'rereads') {
            aVal = a.rereads ? a.rereads.length : 0;
            bVal = b.rereads ? b.rereads.length : 0;
        } else {
            aVal = (a[sortBy] || '').toString();
            bVal = (b[sortBy] || '').toString();
        }

        const dir = sortDir === 'asc' ? 1 : -1;
        
        if (typeof aVal === 'number') {
            return (aVal - bVal) * dir;
        }
        return aVal.localeCompare(bVal) * dir;
    });

    // Render
    container.innerHTML = filtered.map(fic => createFicCard(fic)).join('');

    // Add event listeners
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteFic(btn.dataset.id));
    });

    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editFic(btn.dataset.id));
    });

    container.querySelectorAll('.btn-reread').forEach(btn => {
        btn.addEventListener('click', () => addReread(btn.dataset.id));
    });

    container.querySelectorAll('.btn-manage-rereads').forEach(btn => {
        btn.addEventListener('click', () => manageRereads(btn.dataset.id));
    });
}

function createFicCard(fic) {
    const tags = fic.tags || [];
    const rereads = fic.rereads || [];
    const totalReads = rereads.length + 1;
    const lastReread = rereads.length > 0 ? rereads[rereads.length - 1] : null;

    return `
        <div class="fic-card">
            <div class="fic-header">
                <div class="fic-title-section">
                    <div class="fic-title-row">
                        <h3 class="fic-title">${fic.title}</h3>
                        ${fic.explicit ? '<span class="explicit-badge">E</span>' : ''}
                    </div>
                    <p class="fic-author">by ${fic.author}</p>
                </div>
                <div class="fic-actions">
                    <a href="${fic.link}" target="_blank" rel="noopener noreferrer">🔗</a>
                    <button class="btn-edit" data-id="${fic.id}">Edit</button>
                    <button class="btn-delete" data-id="${fic.id}">✕</button>
                </div>
            </div>

            ${fic.summary ? `<p class="fic-summary">${fic.summary}</p>` : ''}

            <div class="fic-tags">
                ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>

            <div class="fic-details">
                <div><span>Words:</span> ${(fic.word_count || 0).toLocaleString()}</div>
                <div><span>Rating:</span> ${fic.rating}</div>
                <div><span>Status:</span> ${fic.status}</div>
                <div><span>Read:</span> ${fic.date_read || 'N/A'}</div>
            </div>

            <div class="fic-reread-section">
                <button class="btn-reread" data-id="${fic.id}">🔄 Reread</button>
                <div class="reread-count">
                    <strong>${totalReads}</strong> reads total
                    ${lastReread ? `<span class="last-read">(Last: ${lastReread})</span>` : ''}
                    ${rereads.length > 0 ? `<button class="btn-manage-rereads" data-id="${fic.id}">✏️ Manage</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// MODAL
// ==========================================
function openModal(ship = null) {
    editingFicId = null;
    document.getElementById('modal-title').textContent = 'Add Fanfic';
    document.getElementById('fic-form').reset();
    setDefaultDate();
    
    if (ship) {
        document.getElementById('form-ship').value = ship;
    }
    
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
    editingFicId = null;
}

function renderTagsInModal() {
    const container = document.getElementById('tags-container');
    container.innerHTML = DEFAULT_TAGS.map(tag => 
        `<button type="button" class="tag-btn inactive" data-tag="${tag}">${tag}</button>`
    ).join('');

    container.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            e.target.classList.toggle('inactive');
        });
    });
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('form-date').value = today;
}

function getSelectedTags() {
    const activeTags = document.querySelectorAll('.tag-btn.active');
    return Array.from(activeTags).map(btn => btn.dataset.tag);
}

function setSelectedTags(tags) {
    document.querySelectorAll('.tag-btn').forEach(btn => {
        if (tags.includes(btn.dataset.tag)) {
            btn.classList.add('active');
            btn.classList.remove('inactive');
        } else {
            btn.classList.remove('active');
            btn.classList.add('inactive');
        }
    });
}

// ==========================================
// FORM HANDLING
// ==========================================
async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        ship: document.getElementById('form-ship').value,
        title: document.getElementById('form-title').value,
        link: document.getElementById('form-link').value,
        author: document.getElementById('form-author').value,
        summary: document.getElementById('form-summary').value,
        word_count: parseInt(document.getElementById('form-wordcount').value) || 0,
        explicit: document.getElementById('form-explicit').checked,
        tags: getSelectedTags(),
        rating: document.getElementById('form-rating').value,
        status: document.getElementById('form-status').value,
        date_read: document.getElementById('form-date').value,
        rereads: editingFicId ? undefined : []
    };

    try {
        if (editingFicId) {
            const { error } = await supabaseClient
                .from('fanfics')
                .update(formData)
                .eq('id', editingFicId);

            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('fanfics')
                .insert([formData]);

            if (error) throw error;
        }

        closeModal();
        
        if (currentShip === 'dashboard') {
            loadDashboard();
        } else {
            loadShipFics(currentShip);
        }
    } catch (error) {
        console.error('Error saving fic:', error);
        alert('Error saving fanfic. Check console for details.');
    }
}

async function editFic(id) {
    try {
        const { data: fic, error } = await supabaseClient
            .from('fanfics')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        editingFicId = id;
        document.getElementById('modal-title').textContent = 'Edit Fanfic';
        
        document.getElementById('form-ship').value = fic.ship;
        document.getElementById('form-title').value = fic.title;
        document.getElementById('form-link').value = fic.link;
        document.getElementById('form-author').value = fic.author;
        document.getElementById('form-summary').value = fic.summary || '';
        document.getElementById('form-wordcount').value = fic.word_count || '';
        document.getElementById('form-explicit').checked = fic.explicit;
        document.getElementById('form-rating').value = fic.rating;
        document.getElementById('form-status').value = fic.status;
        document.getElementById('form-date').value = fic.date_read || '';
        
        setSelectedTags(fic.tags || []);
        
        document.getElementById('modal').classList.add('active');
    } catch (error) {
        console.error('Error loading fic:', error);
        alert('Error loading fanfic. Check console for details.');
    }
}

async function deleteFic(id) {
    if (!confirm('Are you sure you want to delete this fanfic?')) return;

    try {
        const { error } = await supabaseClient
            .from('fanfics')
            .delete()
            .eq('id', id);

        if (error) throw error;

        loadShipFics(currentShip);
    } catch (error) {
        console.error('Error deleting fic:', error);
        alert('Error deleting fanfic. Check console for details.');
    }
}

async function addReread(id) {
    try {
        const { data: fic, error: fetchError } = await supabaseClient
            .from('fanfics')
            .select('rereads')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const today = new Date().toISOString().split('T')[0];
        const updatedRereads = [...(fic.rereads || []), today];

        const { error: updateError } = await supabaseClient
            .from('fanfics')
            .update({ rereads: updatedRereads })
            .eq('id', id);

        if (updateError) throw updateError;

        loadShipFics(currentShip);
    } catch (error) {
        console.error('Error adding reread:', error);
        alert('Error adding reread. Check console for details.');
    }
}

// ==========================================
// FILTERS & SORTING
// ==========================================
function applyFilters() {
    loadShipFics(currentShip);
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('rating-filter').value = '';
    document.getElementById('explicit-filter').value = '';
    sortBy = 'title';
    sortDir = 'asc';
    document.getElementById('sort-by').value = 'title';
    updateSortDirButton();
}

function toggleSortDir() {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    updateSortDirButton();
    applyFilters();
}

function updateSortDirButton() {
    const btn = document.getElementById('sort-dir-btn');
    btn.textContent = sortDir === 'asc' ? '↑ Ascending' : '↓ Descending';
}

// ==========================================
// FETCH FROM AO3
// ==========================================
async function fetchFromAO3() {
    let link = document.getElementById('form-link').value.trim();
    if (!link.includes('archiveofourown.org')) return alert('Please enter a valid AO3 link.');

    const btn = document.getElementById('fetch-ao3-btn');
    btn.textContent = 'Fetching...';

    // 1. CLEAN URL
    if (link.includes('/chapters/')) link = link.split('/chapters/')[0];
    const urlObj = new URL(link);
    urlObj.searchParams.set('view_adult', 'true');
    urlObj.searchParams.set('view_full_work', 'true');

    try {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const response = await fetch(proxyUrl + encodeURIComponent(urlObj.toString()));
        const html = await response.text();
        
        // Try to parse the results from the proxy
        const success = parseAO3Data(html);
        
        if (!success) {
            throw new Error("Proxy returned empty or restricted content.");
        }
    } catch (error) {
        console.log("Automatic fetch blocked. Switching to manual mode.");
        
        // 2. FALLBACK: MANUAL HTML PASTE
        const manualHTML = prompt(
            "AO3 is blocking the automatic fetcher.\n\n" +
            "To fix this:\n" +
            "1. Go to the AO3 page.\n" +
            "2. Right-click and select 'View Page Source' (or Ctrl+U).\n" +
            "3. Copy everything (Ctrl+A, Ctrl+C) and paste it here:"
        );

        if (manualHTML) {
            const manualSuccess = parseAO3Data(manualHTML);
            if (!manualSuccess) alert("Could not parse the pasted HTML. Make sure you copied the whole Page Source.");
        }
    } finally {
        btn.textContent = 'Fetch from AO3';
    }
}

// Separate Parsing Engine to handle both Proxy and Manual inputs
function parseAO3Data(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Title: Check for the work title first to avoid "Chapter X" clutter
    const title = doc.querySelector('#workskin .preface .title')?.innerText.trim() || 
                  doc.querySelector('h2.title')?.innerText.trim();

    if (!title || title === "Archive of Our Own") return false;

    // Author
    const author = doc.querySelector('a[rel="author"]')?.innerText.trim() || "Anonymous";

    // Summary: Grabs the work summary even in Chapter view
    const summaryBlock = doc.querySelector('.preface .summary blockquote.userstuff') || 
                         doc.querySelector('.summary.module blockquote.userstuff') ||
                         doc.querySelector('.summary blockquote.userstuff');
    const summary = summaryBlock ? summaryBlock.innerText.trim() : "";

    // Word Count
    const wordsDD = doc.querySelector('dd.words');
    const wordCount = wordsDD ? wordsDD.innerText.replace(/,/g, '').match(/\d+/)[0] : "0";

    // --- Fill the Form ---
    document.getElementById('form-title').value = title;
    document.getElementById('form-author').value = author;
    document.getElementById('form-summary').value = summary;
    document.getElementById('form-wordcount').value = wordCount;

    alert(`✅ Data Extracted: ${title}`);
    return true;
}
// ==========================================
// MANAGE REREADS
// ==========================================
async function manageRereads(id) {
    try {
        const { data: fic, error } = await supabaseClient
            .from('fanfics')
            .select('title, rereads')
            .eq('id', id)
            .single();

        if (error) throw error;

        const rereads = fic.rereads || [];
        
        if (rereads.length === 0) {
            alert('No rereads to manage');
            return;
        }

        let message = `Manage rereads for "${fic.title}"\n\n`;
        rereads.forEach((date, index) => {
            message += `${index + 1}. ${date}\n`;
        });
        message += '\nEnter the number(s) of rereads to DELETE (comma-separated), or click Cancel to keep all:';

        const input = prompt(message);
        
        if (input === null) return; // User cancelled
        
        if (input.trim() === '') {
            alert('No changes made');
            return;
        }

        const numbersToDelete = input.split(',')
            .map(n => parseInt(n.trim()) - 1)
            .filter(n => !isNaN(n) && n >= 0 && n < rereads.length);

        if (numbersToDelete.length === 0) {
            alert('No valid numbers entered');
            return;
        }

        const updatedRereads = rereads.filter((_, index) => !numbersToDelete.includes(index));

        const { error: updateError } = await supabaseClient
            .from('fanfics')
            .update({ rereads: updatedRereads })
            .eq('id', id);

        if (updateError) throw updateError;

        alert(`Deleted ${numbersToDelete.length} reread(s)`);
        loadShipFics(currentShip);
    } catch (error) {
        console.error('Error managing rereads:', error);
        alert('Error managing rereads. Check console for details.');
    }
}