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
const RATINGS = ['Favorite', 'Amazing', 'Great', 'Good', 'Fine', 'Bad', 'Terrible'];
const STATUSES = ['Read', 'To Read', 'Reading', 'Paused', 'DNF'];
const DEFAULT_TAGS = [
    'Angst', 'Fluff', 'Hurt/Comfort', 'Slow Burn', 'Enemies to Lovers'
];

const RATING_ORDER = {
    'Favorite': 7,
    'Amazing': 6,
    'Great': 5,
    'Good': 4,
    'Fine': 3,
    'Bad': 2,
    'Terrible': 1
};

let tagsPool = [...DEFAULT_TAGS]; // will grow as new tags are created


// ==========================================
// STATE
// ==========================================
let currentShip = 'dashboard';
let editingFicId = null;
let sortBy = 'title';
let sortDir = 'asc';
let filters = {};
let tagFilterSelected = []; // currently selected tags for filtering


// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadTagsFromFics();      // Load all tags from your fics
    initializeEventListeners();     // Set up buttons, inputs, etc.
    renderTagsInModal();            // Render tag buttons in modal
    setDefaultDate();               // Set default date for forms
    loadDashboard();                // Load the dashboard fics
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
    document.getElementById('parse-html-btn').addEventListener('click', parseFromPastedHTML);
    document.getElementById('open-AO3-Page-btn').addEventListener('click', openAO3Page);
    document.getElementById('tag-search-input').addEventListener('input', (e) => {
        renderTagsInModal(e.target.value);
    });
    document.getElementById('tag-filter-input').addEventListener('input', applyFilters);


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

    // Multi-tag filter
    if (tagFilterSelected.length > 0) {
        filtered = filtered.filter(fic => 
            tagFilterSelected.every(tag => (fic.tags || []).includes(tag))
        );
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

    } else if (sortBy === 'rating') {
        aVal = RATING_ORDER[a.rating] || 0;
        bVal = RATING_ORDER[b.rating] || 0;

    } else {
        aVal = (a[sortBy] || '').toString().toLowerCase();
        bVal = (b[sortBy] || '').toString().toLowerCase();
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
            <button class="btn-reread" data-id="${fic.id}">
            ↪️ Reread
            </button>


                <div class="reread-count">
                    <strong>${totalReads}</strong> reads total
                    ${lastReread ? `<span class="last-read">(Last: ${lastReread})</span>` : ''}
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

function renderTagsInModal(filter = '') {
    const container = document.getElementById('tags-container');
    const search = filter.toLowerCase();

    const filteredTags = tagsPool.filter(tag => tag.toLowerCase().includes(search));

    container.innerHTML = filteredTags.map(tag => 
        `<button type="button" class="tag-btn inactive" data-tag="${tag}">${tag}</button>`
    ).join('');

    container.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            e.target.classList.toggle('inactive');
        });
    });

    // If user typed a new tag that doesn't exist, show "Create" button
    if (search && !tagsPool.some(t => t.toLowerCase() === search)) {
        const createBtn = document.createElement('button');
        createBtn.type = 'button';
        createBtn.className = 'tag-btn create';
        createBtn.textContent = `+ Create "${filter}"`;
        createBtn.onclick = () => {
            tagsPool.push(filter);
            renderTagsInModal(); // re-render
            setSelectedTags([filter]);
            document.getElementById('tag-search-input').value = '';
        };
        container.appendChild(createBtn);
    }
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
        rereads: updatedRereads
    };
    
    const dateValue = document.getElementById('form-date').value;
    if (dateValue) {
        formData.date_read = dateValue;
    }
    
    

    // 🔥 THIS is the reread sync
    if (editingFicId) {
        const rereads = Array.from(
            document.querySelectorAll('#rereads-list input[type="date"]')
        ).map(input => input.value);

        formData.rereads = rereads;
    }

    try {
        if (editingFicId) {
            await supabaseClient
                .from('fanfics')
                .update(formData)
                .eq('id', editingFicId);
        } else {
            await supabaseClient
                .from('fanfics')
                .insert([{ ...formData, rereads: [] }]);
        }

        closeModal();
        loadShipFics(currentShip);

    } catch (error) {
        console.error('Error saving fic:', error);
        alert('Error saving fanfic.');
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

        // ----- Basic modal setup -----
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

        // ----- REREADS -----
        const rereadsSection = document.getElementById('rereads-section');
        const rereadsList = document.getElementById('rereads-list');
        const addRereadBtn = document.getElementById('add-reread-btn');

        let rereads = [...(fic.rereads || [])];

        rereadsSection.style.display = 'block';

        function renderRereads() {
            rereadsList.innerHTML = rereads.map((date, index) => `
                <div class="reread-row">
                    <input type="date" value="${date}" data-index="${index}">
                    <button type="button" class="btn-delete-reread" data-index="${index}">
                        ✕
                    </button>
                </div>
            `).join('');
        }

        renderRereads();

        // Add reread (defaults to today)
        addRereadBtn.onclick = () => {
            rereads.push(new Date().toISOString().split('T')[0]);
            renderRereads();
        };

        // Delete reread
        rereadsList.onclick = (e) => {
            if (!e.target.classList.contains('btn-delete-reread')) return;
            const index = Number(e.target.dataset.index);
            rereads.splice(index, 1);
            renderRereads();
        };

        // ----- Override submit to include rereads -----
        const form = document.getElementById('fic-form');
        const originalSubmit = form.onsubmit;

        form.onsubmit = async (e) => {
            e.preventDefault();

            const updatedRereads = Array.from(
                document.querySelectorAll('#rereads-list input[type="date"]')
            ).map(input => input.value);

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
                rereads: updatedRereads
            };

            const { error } = await supabaseClient
                .from('fanfics')
                .update(formData)
                .eq('id', editingFicId);

            if (error) {
                console.error(error);
                alert('Error updating fanfic');
                return;
            }

            closeModal();
            loadShipFics(currentShip);

            form.onsubmit = originalSubmit; // restore
        };

        document.getElementById('modal').classList.add('active');

    } catch (error) {
        console.error('Error loading fic:', error);
        alert('Error loading fanfic.');
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
        const { data: fic, error } = await supabaseClient
            .from('fanfics')
            .select('rereads')
            .eq('id', id)
            .single();

        if (error) throw error;

        const today = new Date().toISOString().split('T')[0];
        const updatedRereads = [...(fic.rereads || []), today];

        await supabaseClient
            .from('fanfics')
            .update({ rereads: updatedRereads })
            .eq('id', id);

        loadShipFics(currentShip);
    } catch (err) {
        console.error(err);
        alert('Could not add reread');
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
    btn.disabled = true;

    // Use a standard fetch if .invoke() continues to fail
    try {
        const functionUrl = `${SUPABASE_URL}/functions/v1/fetch-ao3?url=${encodeURIComponent(link)}`;
        
        const response = await fetch(functionUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Network response was not ok');
        }

        const html = await response.text();
        const success = parseAO3Data(html);
        
        if (!success) alert('Could not parse AO3 page.');

    } catch (err) {
        console.error('Detailed Error:', err);
        alert(`AO3 fetch failed: ${err.message}`);
    } finally {
        btn.textContent = 'Fetch from AO3';
        btn.disabled = false;
    }
}
// Separate Parsing Engine to handle both Proxy and Manual inputs
function parseAO3Data(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Title
    const title = doc.querySelector('.preface .title')?.textContent.trim() || 
                  doc.querySelector('h2.title')?.textContent.trim();

    if (!title || title === "Archive of Our Own") return false;

    // 2. Author
    const author = doc.querySelector('a[rel="author"]')?.textContent.trim() || "Anonymous";

    // 3. Summary
    const summaryBlock = doc.querySelector('.summary blockquote.userstuff');
    const summary = summaryBlock ? summaryBlock.textContent.trim() : "";

    // 4. Word Count (Check multiple possible locations)
    let wordCount = "0";
    const wordsDD = doc.querySelector('dd.words');
    if (wordsDD) {
        // Remove commas and extract numbers
        wordCount = wordsDD.textContent.replace(/,/g, '').match(/\d+/)?.[0] || "0";
    }

    // --- Fill the Form ---
    document.getElementById('form-title').value = title;
    document.getElementById('form-author').value = author;
    document.getElementById('form-summary').value = summary;
    document.getElementById('form-wordcount').value = wordCount;

    return true; // Success
}

function parseFromPastedHTML() {
    const html = document.getElementById('form-html-source').value.trim();

    if (!html) {
        alert('Please paste the AO3 page source first.');
        return;
    }

    const success = parseAO3Data(html);

    if (!success) {
        alert('Could not extract data from pasted HTML.');
        return;
    }

    // --- Extract work ID and build link ---
    const formLink = document.getElementById('form-link');
    // Regex to find /works/NUMBER anywhere in the HTML
    const match = html.match(/\/works\/(\d+)/);
    if (match) {
        const workId = match[1];
        const ao3Link = `https://archiveofourown.org/works/${workId}`;
        formLink.value = ao3Link; // ALWAYS set it
    } else {
        console.warn('No AO3 work ID found in pasted HTML.');
        formLink.value = ''; // clear if not found
    }
}



function openAO3Page() {
    const link = document.getElementById('form-link').value.trim();
    if (!link || !link.includes('archiveofourown.org')) {
        alert('Please enter a valid AO3 link.');
        return;
    }
    window.open(link, '_blank'); // normal AO3 page
}

function resetTagFilter() {
    tagFilterSelected = [];
    renderTagsInInput(); // use the pill renderer
    document.getElementById('tag-filter-input').value = '';
    applyFilters();
}

document.addEventListener('DOMContentLoaded', () => {
    const tagInput = document.getElementById('tag-filter-input');
    const suggestionContainer = document.getElementById('tag-filter-suggestions');
    const wrapper = document.getElementById('tag-filter-wrapper');

    // Input typing for suggestions
    tagInput.addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase().trim();
        if (!search) {
            suggestionContainer.style.display = 'none';
            return;
        }

        const matches = tagsPool.filter(tag => 
            tag.toLowerCase().includes(search) && !tagFilterSelected.includes(tag)
        );

        suggestionContainer.innerHTML = matches.map(tag => `
            <button type="button" data-tag="${tag}">${tag}</button>
        `).join('');

        suggestionContainer.style.display = matches.length > 0 ? 'block' : 'none';

        suggestionContainer.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                if (!tagFilterSelected.includes(btn.dataset.tag)) {
                    tagFilterSelected.push(btn.dataset.tag);
                    renderTagsInInput();
                    tagInput.value = '';
                    suggestionContainer.style.display = 'none';
                    applyFilters();
                }
            };
        });
    });
});

// Renders selected tags as pills inside the input wrapper
function renderTagsInInput() {
    const wrapper = document.getElementById('tag-filter-wrapper');
    const input = document.getElementById('tag-filter-input');

    // Remove existing pills but keep input
    wrapper.querySelectorAll('.tag-pill').forEach(pill => pill.remove());

    tagFilterSelected.forEach(tag => {
        const pill = document.createElement('span');
        pill.className = 'tag-pill';
        pill.textContent = tag;

        const removeBtn = document.createElement('span');
        removeBtn.textContent = '×';
        removeBtn.style.marginLeft = '4px';
        removeBtn.style.cursor = 'pointer';
        removeBtn.addEventListener('click', () => {
            tagFilterSelected = tagFilterSelected.filter(t => t !== tag);
            renderTagsInInput();
            applyFilters();
        });

        pill.appendChild(removeBtn);
        pill.style.background = '#fee';
        pill.style.color = '#991b1b';
        pill.style.padding = '2px 6px';
        pill.style.borderRadius = '12px';
        pill.style.fontSize = '0.85rem';
        pill.style.display = 'inline-flex';
        pill.style.alignItems = 'center';

        wrapper.insertBefore(pill, input);
    });
}

async function loadTagsFromFics() {
    try {
        const { data: fics, error } = await supabaseClient
            .from('fanfics')
            .select('tags');

        if (error) throw error;

        // Flatten all tags from all fics
        const allTags = fics.flatMap(f => f.tags || []);

        // Combine with default tags, remove duplicates
        tagsPool = Array.from(new Set([...DEFAULT_TAGS, ...allTags]));
    } catch (err) {
        console.error('Error loading tags:', err);
    }
}
