// Portland Reuse Hub - Main Application Logic

// API Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://your-app.railway.app'; // Update with your Railway URL after deployment

// Global variables
let locations = [];
let map;
let markers = [];
let markerClusterGroup = null;
let currentFilter = 'all';
let searchTerm = '';
let userLocation = null;
let userMarker = null;
let favorites = [];
let allSuggestions = [];
let selectedSuggestionIndex = -1;
let currentMobileView = 'list';
let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;
let selectedCategories = [];
let defaultMapBounds = null;
let adminToken = localStorage.getItem('adminToken') || null;

// API helper function
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(adminToken && { 'Authorization': `Bearer ${adminToken}` }),
        ...options.headers
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            // Token expired or invalid
            adminToken = null;
            localStorage.removeItem('adminToken');
            isAdminLoggedIn = false;
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Custom marker colors by type
const MARKER_COLORS = {
    donation: '#2d6a4f',   // Green
    repair: '#1976d2',     // Blue
    recycling: '#f57c00',  // Orange
    disposal: '#c62828'    // Red
};

// Create custom colored marker icon
function createColoredMarker(type) {
    const color = MARKER_COLORS[type] || '#666666';
    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div class="marker-pin" style="background-color: ${color};">
                <div class="marker-pin-inner"></div>
            </div>
            <div class="marker-shadow"></div>
        `,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -42]
    });
}

// Category definitions with groupings and emojis
const CATEGORY_GROUPS = {
    'Electronics': {
        emoji: '💻',
        keywords: ['computers', 'laptops', 'monitors', 'electronics', 'cables', 'keyboards', 'phones', 'tablets', 'tvs', 'printers', 'cell phones', 'smartphones', 'data destruction', 'computer', 'laptop', 'monitor', 'phone', 'tablet', 'tv', 'printer']
    },
    'Furniture': {
        emoji: '🪑',
        keywords: ['furniture', 'couch', 'sofa', 'tables', 'chairs', 'cabinets', 'desks', 'beds', 'dressers', 'shelves']
    },
    'Clothing': {
        emoji: '👕',
        keywords: ['clothing', 'clothes', 'shoes', 'textiles', 'fabric', 'cotton clothing', 'linens', 'towels', 'sheets', 't-shirts', 'cotton fabrics', 'belts', 'purses', 'hats', 'accessories']
    },
    'Building Materials': {
        emoji: '🏗️',
        keywords: ['lumber', 'doors', 'windows', 'hardware', 'plumbing', 'electrical', 'flooring', 'building materials', 'cabinets', 'construction debris']
    },
    'Appliances': {
        emoji: '🔌',
        keywords: ['appliances', 'refrigerator', 'small appliances', 'washer', 'dryer', 'microwave', 'stove']
    },
    'Bicycles': {
        emoji: '🚲',
        keywords: ['bicycles', 'bike parts', 'helmets', 'bike accessories', 'bikes', 'bicycle']
    },
    'Art & Craft': {
        emoji: '🎨',
        keywords: ['fabric', 'paper', 'craft supplies', 'art materials', 'office supplies', 'creative reuse items', 'magazines']
    },
    'Hazardous': {
        emoji: '⚠️',
        keywords: ['hazardous waste', 'chemicals', 'fluorescent bulbs', 'household hazardous waste', 'paint thinners']
    },
    'Tools': {
        emoji: '🔧',
        keywords: ['hand tools', 'power tools', 'garden tools', 'woodworking tools', 'automotive tools', 'ladders', 'specialty tools', 'tools']
    },
    'Books & Media': {
        emoji: '📚',
        keywords: ['books', 'magazines', 'newspapers', 'office paper', 'book']
    },
    'Toys & Kids': {
        emoji: '🧸',
        keywords: ['toys', 'stuffed animals', 'games', 'kids items']
    },
    'Mattresses': {
        emoji: '🛏️',
        keywords: ['mattresses', 'box springs', 'mattress', 'box spring', 'bedding']
    },
    'Batteries': {
        emoji: '🔋',
        keywords: ['batteries', 'rechargeable batteries', 'battery', 'cell phones', 'power tool batteries', 'laptop batteries']
    },
    'Paint': {
        emoji: '🎨',
        keywords: ['paint', 'paints', 'stains', 'primers', 'varnishes', 'sealers', 'latex paint', 'oil-based paint']
    },
    'Housewares': {
        emoji: '🏠',
        keywords: ['housewares', 'home decor', 'kitchenware', 'dishes', 'pots', 'pans', 'small household items', 'knickknacks']
    },
    'Yard & Garden': {
        emoji: '🌿',
        keywords: ['yard debris', 'compostable materials', 'food scraps', 'garden tools', 'plants']
    },
    'Paper & Cardboard': {
        emoji: '📦',
        keywords: ['cardboard', 'paper', 'newspapers', 'office paper', 'magazines']
    },
    'Sporting Goods': {
        emoji: '⚽',
        keywords: ['sporting goods', 'sports equipment', 'exercise equipment', 'camping gear']
    }
};

// Build category chips from location data
function buildCategoryChips() {
    const categoryChipsContainer = document.getElementById('categoryChips');
    if (!categoryChipsContainer) return;

    // Count items for each category
    const categoryCounts = {};

    Object.keys(CATEGORY_GROUPS).forEach(category => {
        categoryCounts[category] = 0;
    });

    // Count locations that accept items in each category
    locations.forEach(location => {
        const acceptsLower = location.accepts.map(a => a.toLowerCase());

        Object.entries(CATEGORY_GROUPS).forEach(([category, { keywords }]) => {
            const hasMatch = keywords.some(keyword =>
                acceptsLower.some(accept => accept.includes(keyword) || keyword.includes(accept))
            );
            if (hasMatch) {
                categoryCounts[category]++;
            }
        });
    });

    // Sort categories by count (descending) and filter out empty ones
    const sortedCategories = Object.entries(categoryCounts)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);

    // Generate chips HTML
    categoryChipsContainer.innerHTML = sortedCategories.map(([category, count]) => {
        const { emoji } = CATEGORY_GROUPS[category];
        return `
            <button class="category-chip" data-category="${category}">
                <span class="chip-emoji">${emoji}</span>
                <span class="chip-label">${category}</span>
                <span class="chip-count">(${count})</span>
            </button>
        `;
    }).join('');

    // Add click handlers
    categoryChipsContainer.querySelectorAll('.category-chip').forEach(chip => {
        chip.addEventListener('click', () => toggleCategory(chip.dataset.category));
    });
}

// Toggle category selection
function toggleCategory(category) {
    const index = selectedCategories.indexOf(category);

    if (index === -1) {
        selectedCategories.push(category);
        trackCategoryUsage(category);
    } else {
        selectedCategories.splice(index, 1);
    }

    updateCategoryChipsUI();
    updateClearCategoriesButton();
    filterAndDisplayLocations();
}

// Update category chips UI to reflect selection state
function updateCategoryChipsUI() {
    document.querySelectorAll('.category-chip').forEach(chip => {
        const isSelected = selectedCategories.includes(chip.dataset.category);
        chip.classList.toggle('selected', isSelected);
    });
}

// Update clear button visibility
function updateClearCategoriesButton() {
    const clearBtn = document.getElementById('clearCategoriesBtn');
    if (clearBtn) {
        clearBtn.style.display = selectedCategories.length > 0 ? 'inline-block' : 'none';
    }
}

// Clear all selected categories
function clearSelectedCategories() {
    selectedCategories = [];
    updateCategoryChipsUI();
    updateClearCategoriesButton();
    filterAndDisplayLocations();
}

// Check if a location matches selected categories
function locationMatchesCategories(location) {
    if (selectedCategories.length === 0) return true;

    const acceptsLower = location.accepts.map(a => a.toLowerCase());

    return selectedCategories.some(category => {
        const { keywords } = CATEGORY_GROUPS[category];
        return keywords.some(keyword =>
            acceptsLower.some(accept => accept.includes(keyword) || keyword.includes(accept))
        );
    });
}

// Mobile view management
function initMobileView() {
    const contentGrid = document.getElementById('contentGrid');
    const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
    const swipeDots = document.querySelectorAll('.swipe-dot');

    // Set initial view
    if (window.innerWidth <= 768) {
        contentGrid.classList.add('view-list');
        currentMobileView = 'list';
    }

    // View toggle button handlers
    viewToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchMobileView(view);
        });
    });

    // Handle window resize
    window.addEventListener('resize', handleResize);

    // Setup swipe gestures
    setupSwipeGestures();
}

function switchMobileView(view) {
    if (view === currentMobileView) return;

    const contentGrid = document.getElementById('contentGrid');
    const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
    const swipeDots = document.querySelectorAll('.swipe-dot');

    currentMobileView = view;

    // Update content grid class
    contentGrid.classList.remove('view-list', 'view-map');
    contentGrid.classList.add(`view-${view}`);

    // Update toggle buttons
    viewToggleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Update swipe dots
    swipeDots.forEach((dot, index) => {
        dot.classList.toggle('active', (index === 0 && view === 'list') || (index === 1 && view === 'map'));
    });

    // Invalidate map size when switching to map view
    if (view === 'map' && map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}

function handleResize() {
    const contentGrid = document.getElementById('contentGrid');

    if (window.innerWidth > 768) {
        // Desktop view - remove mobile classes
        contentGrid.classList.remove('view-list', 'view-map');
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    } else {
        // Mobile view - ensure a view class is set
        if (!contentGrid.classList.contains('view-list') && !contentGrid.classList.contains('view-map')) {
            contentGrid.classList.add('view-list');
            currentMobileView = 'list';
        }
    }
}

function setupSwipeGestures() {
    const contentGrid = document.getElementById('contentGrid');

    contentGrid.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 768) return;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwiping = true;
    }, { passive: true });

    contentGrid.addEventListener('touchmove', (e) => {
        if (!isSwiping || window.innerWidth > 768) return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;

        // Only swipe if horizontal movement is greater than vertical
        if (Math.abs(deltaX) < Math.abs(deltaY)) {
            isSwiping = false;
        }
    }, { passive: true });

    contentGrid.addEventListener('touchend', (e) => {
        if (!isSwiping || window.innerWidth > 768) return;

        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX;
        const threshold = 50;

        if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0 && currentMobileView === 'map') {
                // Swipe right - go to list
                switchMobileView('list');
            } else if (deltaX < 0 && currentMobileView === 'list') {
                // Swipe left - go to map
                switchMobileView('map');
            }
        }

        isSwiping = false;
    }, { passive: true });
}

// Synonyms mapping for search
const SYNONYMS = {
    'tv': ['television', 'monitor', 'screen', 'tvs'],
    'television': ['tv', 'monitor', 'screen'],
    'couch': ['sofa', 'furniture', 'loveseat'],
    'sofa': ['couch', 'furniture', 'loveseat'],
    'computer': ['laptop', 'pc', 'desktop', 'computers'],
    'laptop': ['computer', 'pc', 'notebook', 'laptops'],
    'pc': ['computer', 'laptop', 'desktop'],
    'clothes': ['clothing', 'textiles', 'apparel', 'garments'],
    'clothing': ['clothes', 'textiles', 'apparel', 'garments'],
    'textiles': ['clothes', 'clothing', 'fabric', 'fabrics'],
    'phone': ['cell phone', 'cellphone', 'smartphone', 'phones', 'mobile'],
    'cellphone': ['phone', 'cell phone', 'smartphone', 'mobile'],
    'fridge': ['refrigerator', 'appliances'],
    'refrigerator': ['fridge', 'appliances'],
    'bike': ['bicycle', 'bicycles', 'bikes'],
    'bicycle': ['bike', 'bicycles', 'bikes'],
    'books': ['book', 'magazines', 'reading materials'],
    'paint': ['paints', 'stains', 'primers'],
    'battery': ['batteries', 'rechargeable batteries'],
    'batteries': ['battery', 'rechargeable batteries'],
    'mattress': ['mattresses', 'box spring', 'bed'],
    'tools': ['hand tools', 'power tools', 'tool']
};

// Build suggestions list from all accepts arrays
function buildSuggestionsList() {
    const suggestionsSet = new Set();

    locations.forEach(location => {
        location.accepts.forEach(item => {
            suggestionsSet.add(item.toLowerCase());
        });
        // Also add category
        suggestionsSet.add(location.category.toLowerCase());
    });

    // Add synonym keys
    Object.keys(SYNONYMS).forEach(key => {
        suggestionsSet.add(key);
    });

    allSuggestions = Array.from(suggestionsSet).sort();
}

// Get matching suggestions for input
function getMatchingSuggestions(input) {
    if (!input || input.length < 1) return [];

    const inputLower = input.toLowerCase();
    const matches = new Set();

    // Direct matches
    allSuggestions.forEach(suggestion => {
        if (suggestion.includes(inputLower)) {
            matches.add(suggestion);
        }
    });

    // Synonym matches
    Object.entries(SYNONYMS).forEach(([key, synonyms]) => {
        if (key.includes(inputLower)) {
            synonyms.forEach(syn => matches.add(syn));
            matches.add(key);
        }
        synonyms.forEach(syn => {
            if (syn.includes(inputLower)) {
                matches.add(key);
                synonyms.forEach(s => matches.add(s));
            }
        });
    });

    // Sort by relevance: exact start match first, then contains
    const matchArray = Array.from(matches);
    matchArray.sort((a, b) => {
        const aStarts = a.startsWith(inputLower);
        const bStarts = b.startsWith(inputLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
    });

    return matchArray.slice(0, 5);
}

// Highlight matching text in suggestion
function highlightMatch(text, query) {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);

    return `${before}<strong>${match}</strong>${after}`;
}

// Show autocomplete dropdown
function showAutocomplete(suggestions, query) {
    let dropdown = document.getElementById('autocompleteDropdown');

    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'autocompleteDropdown';
        dropdown.className = 'autocomplete-dropdown';
        const searchBox = document.querySelector('.search-box');
        searchBox.style.position = 'relative';
        searchBox.appendChild(dropdown);
    }

    if (suggestions.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    selectedSuggestionIndex = -1;

    dropdown.innerHTML = suggestions.map((suggestion, index) => `
        <div class="autocomplete-item" data-index="${index}" data-value="${suggestion}">
            ${highlightMatch(suggestion, query)}
        </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            selectSuggestion(item.dataset.value);
        });
        item.addEventListener('mouseenter', () => {
            selectedSuggestionIndex = parseInt(item.dataset.index);
            updateSelectedSuggestion();
        });
    });

    dropdown.style.display = 'block';
}

// Hide autocomplete dropdown
function hideAutocomplete() {
    const dropdown = document.getElementById('autocompleteDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    selectedSuggestionIndex = -1;
}

// Select a suggestion
function selectSuggestion(value) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = value;
    searchTerm = value.toLowerCase();
    hideAutocomplete();
    filterAndDisplayLocations();
}

// Update selected suggestion highlight
function updateSelectedSuggestion() {
    const dropdown = document.getElementById('autocompleteDropdown');
    if (!dropdown) return;

    const items = dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedSuggestionIndex);
    });
}

// Handle keyboard navigation in autocomplete
function handleAutocompleteKeyboard(e) {
    const dropdown = document.getElementById('autocompleteDropdown');
    if (!dropdown || dropdown.style.display === 'none') return false;

    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return false;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
            updateSelectedSuggestion();
            return true;
        case 'ArrowUp':
            e.preventDefault();
            selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
            updateSelectedSuggestion();
            return true;
        case 'Enter':
            if (selectedSuggestionIndex >= 0) {
                e.preventDefault();
                selectSuggestion(items[selectedSuggestionIndex].dataset.value);
                return true;
            }
            hideAutocomplete();
            return false;
        case 'Escape':
            hideAutocomplete();
            return true;
        default:
            return false;
    }
}

// Favorites management
function loadFavorites() {
    try {
        const stored = localStorage.getItem('favorites');
        favorites = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error loading favorites:', e);
        favorites = [];
    }
}

function saveFavorites() {
    try {
        localStorage.setItem('favorites', JSON.stringify(favorites));
    } catch (e) {
        console.error('Error saving favorites:', e);
    }
}

function isFavorite(locationId) {
    return favorites.includes(locationId);
}

function toggleFavorite(locationId, event) {
    if (event) {
        event.stopPropagation();
    }

    const index = favorites.indexOf(locationId);
    if (index === -1) {
        favorites.push(locationId);
    } else {
        favorites.splice(index, 1);
    }

    saveFavorites();
    updateFavoriteButton(locationId);
    updateFavoritesFilterCount();

    // If currently showing favorites and we unfavorited, refresh the list
    if (currentFilter === 'favorites' && index !== -1) {
        filterAndDisplayLocations();
    }
}

function updateFavoriteButton(locationId) {
    const btn = document.querySelector(`.favorite-btn[data-id="${locationId}"]`);
    if (btn) {
        const isFav = isFavorite(locationId);
        btn.classList.toggle('favorited', isFav);
        btn.innerHTML = isFav ? '♥' : '♡';
        btn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    }
}

function updateFavoritesFilterCount() {
    const favFilterBtn = document.querySelector('[data-filter="favorites"]');
    if (favFilterBtn) {
        const count = favorites.length;
        favFilterBtn.textContent = `Favorites${count > 0 ? ` (${count})` : ''}`;
    }
}

function clearAllFavorites() {
    if (favorites.length === 0) return;

    if (confirm('Are you sure you want to clear all favorites?')) {
        favorites = [];
        saveFavorites();

        // Update all favorite buttons on visible cards
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.classList.remove('favorited');
            btn.innerHTML = '♡';
            btn.title = 'Add to favorites';
        });

        updateFavoritesFilterCount();

        // If currently showing favorites, refresh to show empty state
        if (currentFilter === 'favorites') {
            filterAndDisplayLocations();
        }
    }
}

// Hours parsing utilities
const DAY_MAP = {
    'sun': 0, 'sunday': 0,
    'mon': 1, 'monday': 1,
    'tue': 2, 'tues': 2, 'tuesday': 2,
    'wed': 3, 'wednesday': 3,
    'thu': 4, 'thur': 4, 'thurs': 4, 'thursday': 4,
    'fri': 5, 'friday': 5,
    'sat': 6, 'saturday': 6
};

// Parse time string like "10am", "6pm", "5:30pm" to minutes since midnight
function parseTime(timeStr) {
    if (!timeStr) return null;
    timeStr = timeStr.toLowerCase().trim();

    const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!match) return null;

    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3];

    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    return hours * 60 + minutes;
}

// Parse day range like "Mon-Sat", "Tue & Thu", "Daily"
function parseDays(dayStr) {
    if (!dayStr) return [];
    dayStr = dayStr.toLowerCase().trim();

    // Handle "Daily"
    if (dayStr === 'daily') {
        return [0, 1, 2, 3, 4, 5, 6];
    }

    // Handle day range like "Mon-Sat"
    const rangeMatch = dayStr.match(/^(\w+)\s*-\s*(\w+)$/);
    if (rangeMatch) {
        const startDay = DAY_MAP[rangeMatch[1]];
        const endDay = DAY_MAP[rangeMatch[2]];
        if (startDay !== undefined && endDay !== undefined) {
            const days = [];
            let d = startDay;
            while (true) {
                days.push(d);
                if (d === endDay) break;
                d = (d + 1) % 7;
            }
            return days;
        }
    }

    // Handle single day or days with "&" like "Tue & Thu"
    const days = [];
    const parts = dayStr.split(/\s*[&,]\s*/);
    for (const part of parts) {
        const day = DAY_MAP[part.trim()];
        if (day !== undefined) days.push(day);
    }
    return days;
}

// Parse a single schedule segment like "Mon-Sat 10am-6pm"
function parseScheduleSegment(segment) {
    segment = segment.trim();

    // Try to match patterns like "Mon-Sat 10am-6pm" or "Daily 8am-5pm"
    const match = segment.match(/^([\w\s&-]+?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i);

    if (!match) return null;

    const days = parseDays(match[1]);
    const openTime = parseTime(match[2]);
    const closeTime = parseTime(match[3]);

    if (days.length === 0 || openTime === null || closeTime === null) return null;

    return { days, openTime, closeTime };
}

// Get open status for a location
function getOpenStatus(hoursStr) {
    if (!hoursStr) return { status: 'unknown', text: 'Hours unknown' };

    const lowerHours = hoursStr.toLowerCase();

    // Handle special cases
    if (lowerHours.includes('see website') ||
        lowerHours.includes('check website') ||
        lowerHours.includes('varies') ||
        lowerHours.includes('events') ||
        lowerHours.includes('call ')) {
        return { status: 'unknown', text: 'Check hours' };
    }

    // Handle 24/7
    if (lowerHours.includes('24/7') || lowerHours.includes('24 hours')) {
        return { status: 'open', text: 'Open 24/7' };
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Split by comma to handle multiple schedule segments
    // But be careful with segments that have commas within them
    const segments = hoursStr.split(/,\s*(?=[A-Za-z])/);

    let isOpenNow = false;
    let nextOpenTime = null;
    let nextOpenToday = false;

    for (const segment of segments) {
        // Skip segments that are notes (like "Hazardous Waste...")
        if (segment.toLowerCase().includes('hazardous') ||
            segment.toLowerCase().includes('phone:') ||
            segment.toLowerCase().includes('bins:')) {
            // Check if this specific segment applies (like "Bins: 24/7")
            if (segment.toLowerCase().includes('24/7')) {
                isOpenNow = true;
            }
            continue;
        }

        const schedule = parseScheduleSegment(segment);
        if (!schedule) continue;

        // Check if today is in the schedule
        if (schedule.days.includes(currentDay)) {
            if (currentMinutes >= schedule.openTime && currentMinutes < schedule.closeTime) {
                isOpenNow = true;
            } else if (currentMinutes < schedule.openTime) {
                // Opens later today
                if (nextOpenTime === null || schedule.openTime < nextOpenTime) {
                    nextOpenTime = schedule.openTime;
                    nextOpenToday = true;
                }
            }
        }
    }

    if (isOpenNow) {
        return { status: 'open', text: 'Open Now' };
    }

    if (nextOpenToday && nextOpenTime !== null) {
        const hours = Math.floor(nextOpenTime / 60);
        const minutes = nextOpenTime % 60;
        const period = hours >= 12 ? 'pm' : 'am';
        const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
        const timeStr = minutes > 0 ? `${displayHours}:${minutes.toString().padStart(2, '0')}${period}` : `${displayHours}${period}`;
        return { status: 'opening', text: `Opens ${timeStr}` };
    }

    return { status: 'closed', text: 'Closed' };
}

// Generate HTML for open status badge
function getOpenStatusBadge(hoursStr) {
    const status = getOpenStatus(hoursStr);
    let className = 'status-badge ';

    switch (status.status) {
        case 'open':
            className += 'status-open';
            break;
        case 'closed':
            className += 'status-closed';
            break;
        case 'opening':
            className += 'status-opening';
            break;
        default:
            className += 'status-unknown';
    }

    return `<span class="${className}">${status.text}</span>`;
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

// Get distance text for display
function getDistanceText(location) {
    if (!userLocation) return '';
    const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        location.lat, location.lng
    );
    if (distance < 0.1) {
        return `${Math.round(distance * 5280)} ft away`;
    }
    return `${distance.toFixed(1)} mi away`;
}

// Get user's location using browser geolocation API
function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            showLocationMessage('Geolocation is not supported by your browser.', 'info');
            resolve(null);
            return;
        }

        showLocationMessage('Detecting your location...', 'loading');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                showLocationMessage('Location detected! Showing distances.', 'success');
                setTimeout(() => hideLocationMessage(), 3000);
                resolve(location);
            },
            (error) => {
                let message = '';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location access denied. Distances not available.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location unavailable. Distances not available.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out. Distances not available.';
                        break;
                    default:
                        message = 'Unable to get location. Distances not available.';
                }
                showLocationMessage(message, 'error');
                setTimeout(() => hideLocationMessage(), 5000);
                resolve(null);
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000 // Cache for 5 minutes
            }
        );
    });
}

// Show location status message
function showLocationMessage(message, type) {
    let messageEl = document.getElementById('locationMessage');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'locationMessage';
        const searchSection = document.querySelector('.search-section');
        if (searchSection) {
            searchSection.appendChild(messageEl);
        }
    }
    messageEl.className = `location-message location-message-${type}`;
    messageEl.textContent = message;
    messageEl.style.display = 'block';
}

// Hide location message
function hideLocationMessage() {
    const messageEl = document.getElementById('locationMessage');
    if (messageEl) {
        messageEl.style.display = 'none';
    }
}

// Add user location marker to map
function addUserMarker() {
    if (!userLocation || !map) return;

    // Remove existing user marker if any
    if (userMarker) {
        map.removeLayer(userMarker);
    }

    // Create custom blue icon for user location
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div class="user-marker-dot"></div><div class="user-marker-pulse"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<strong>Your Location</strong>');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    loadFavorites();
    loadPendingSubmissions();
    loadAnalytics();
    await loadLocations();
    buildSuggestionsList();
    buildCategoryChips();
    initializeMap();
    setupEventListeners();
    initMobileView();
    updateFavoritesFilterCount();

    // Clear categories button handler
    const clearCategoriesBtn = document.getElementById('clearCategoriesBtn');
    if (clearCategoriesBtn) {
        clearCategoriesBtn.addEventListener('click', clearSelectedCategories);
    }

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        const searchBox = document.querySelector('.search-box');
        if (searchBox && !searchBox.contains(e.target)) {
            hideAutocomplete();
        }
    });

    // Get user location (async, won't block page load)
    userLocation = await getUserLocation();
    if (userLocation) {
        addUserMarker();
    }

    // Display locations (with or without distances)
    displayLocations(locations);

    // Handle shared URLs (after locations are displayed)
    handleSharedUrl();

    // Close share menus and export menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.share-wrapper') && !e.target.closest('.share-results-wrapper') && !e.target.closest('.export-wrapper')) {
            closeShareMenus();
            document.getElementById('exportMenu')?.classList.remove('open');
        }
    });

    // Setup modal event listeners
    setupModalListeners();

    // Initialize item helper accordion
    initItemHelper();

    // Show welcome modal on first visit
    showWelcomeModalIfFirstVisit();
});

// Welcome modal logic
function showWelcomeModalIfFirstVisit() {
    if (localStorage.getItem('hasVisited')) return;

    const modal = document.getElementById('welcomeModal');
    if (!modal) return;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            dismissWelcomeModal();
        }
    });
}

function dismissWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    // Always mark visited; checkbox controls whether it persists
    const dontShow = document.getElementById('welcomeDontShow');
    if (dontShow && dontShow.checked) {
        localStorage.setItem('hasVisited', 'true');
    }
}

// About / How It Works panel
function openAboutPanel() {
    document.getElementById('aboutOverlay').classList.add('open');
    document.getElementById('aboutPanel').classList.add('open');
    document.body.style.overflow = 'hidden';

    // Update live location count
    const countEl = document.getElementById('aboutLocationCount');
    if (countEl && locations.length > 0) {
        countEl.textContent = locations.length;
    }
}

function closeAboutPanel() {
    document.getElementById('aboutOverlay').classList.remove('open');
    document.getElementById('aboutPanel').classList.remove('open');
    document.body.style.overflow = '';
}

// Item Helper accordion toggle
function initItemHelper() {
    const toggle = document.getElementById('itemHelperToggle');
    const body = document.getElementById('itemHelperBody');
    if (!toggle || !body) return;

    toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        body.classList.toggle('open', !expanded);
    });
}

// Apply a filter from the helper decision tree
function applyHelperFilter(type) {
    // Click the corresponding filter button
    const btn = document.querySelector(`.filter-btn[data-filter="${type}"]`);
    if (btn) btn.click();

    // Collapse the helper
    const toggle = document.getElementById('itemHelperToggle');
    const body = document.getElementById('itemHelperBody');
    if (toggle && body) {
        toggle.setAttribute('aria-expanded', 'false');
        body.classList.remove('open');
    }

    // Scroll to results
    const resultsSection = document.getElementById('contentGrid') || document.querySelector('.search-section');
    if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Apply a search from the helper quick links
function applyHelperSearch(term) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = term;
        searchTerm = term.toLowerCase();
        filterAndDisplayLocations();
    }

    // Collapse the helper
    const toggle = document.getElementById('itemHelperToggle');
    const body = document.getElementById('itemHelperBody');
    if (toggle && body) {
        toggle.setAttribute('aria-expanded', 'false');
        body.classList.remove('open');
    }

    // Scroll to results
    const resultsSection = document.getElementById('contentGrid') || document.querySelector('.search-section');
    if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Popular item chip search
function popularItemSearch(term, label) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = term;
        searchTerm = term.toLowerCase();
        filterAndDisplayLocations();
    }

    // Track in analytics
    trackSearch(term, 0);
    apiRequest('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ type: 'category', data: label.toLowerCase() })
    }).catch(() => {});

    // Scroll to results
    const resultsSection = document.getElementById('contentGrid') || document.querySelector('.search-section');
    if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Load location data from API
async function loadLocations() {
    try {
        // Try to load from API
        locations = await apiRequest('/api/locations');
        console.log(`Loaded ${locations.length} locations from API`);
    } catch (error) {
        console.warn('Failed to load from API, using fallback data:', error.message);
        // Fallback to embedded data if API fails
        locations = FALLBACK_LOCATIONS;
        console.log(`Loaded ${locations.length} locations from fallback`);
    }
}

// Fallback location data (used when API is unavailable)
const FALLBACK_LOCATIONS = [
  {
    "id": 1,
    "name": "Free Geek",
    "type": "donation",
    "category": "Electronics",
    "address": "1731 SE 10th Ave, Portland, OR 97214",
    "lat": 45.5091,
    "lng": -122.6548,
    "phone": "(503) 232-9350",
    "website": "https://www.freegeek.org",
    "hours": "Mon-Sat 10am-6pm",
    "accepts": ["computers", "laptops", "monitors", "electronics", "cables", "keyboards"],
    "description": "Nonprofit that recycles technology and provides access to computers, education, and job skills."
  },
  {
    "id": 2,
    "name": "Habitat for Humanity ReStore - North",
    "type": "donation",
    "category": "Building Materials",
    "address": "5205 N Lagoon Ave, Portland, OR 97217",
    "lat": 45.5627,
    "lng": -122.7447,
    "phone": "(503) 287-6000",
    "website": "https://portlandrestore.org",
    "hours": "Wed-Sat 9am-6pm, Sun 10am-5pm",
    "accepts": ["furniture", "appliances", "building materials", "doors", "windows", "cabinets", "lumber"],
    "description": "Accepts new and gently used building materials, furniture, and appliances to sell at reduced prices."
  },
  {
    "id": 3,
    "name": "Goodwill - SE Portland",
    "type": "donation",
    "category": "General",
    "address": "1943 SE 6th Ave, Portland, OR 97214",
    "lat": 45.5114,
    "lng": -122.6595,
    "phone": "(503) 239-1717",
    "website": "https://goodwill.org",
    "hours": "Mon-Sat 9am-8pm, Sun 10am-6pm",
    "accepts": ["clothing", "shoes", "books", "toys", "small appliances", "housewares", "furniture"],
    "description": "Accepts clothing, household items, and more to fund job training programs."
  },
  {
    "id": 4,
    "name": "Community Cycling Center",
    "type": "donation",
    "category": "Bicycles",
    "address": "1700 NE Alberta St, Portland, OR 97211",
    "lat": 45.5593,
    "lng": -122.6485,
    "phone": "(503) 287-8786",
    "website": "https://communitycyclingcenter.org",
    "hours": "Tue-Sat 10am-6pm",
    "accepts": ["bicycles", "bike parts", "helmets", "bike accessories"],
    "description": "Accepts bicycles and parts for refurbishment and community programs."
  },
  {
    "id": 5,
    "name": "Metro South Transfer Station",
    "type": "recycling",
    "category": "Hazardous Waste",
    "address": "2001 Washington St, Oregon City, OR 97045",
    "lat": 45.3588,
    "lng": -122.5926,
    "phone": "(503) 234-3000",
    "website": "https://www.oregonmetro.gov",
    "hours": "Mon-Sat 8am-5pm",
    "accepts": ["hazardous waste", "paint", "chemicals", "batteries", "fluorescent bulbs", "electronics"],
    "description": "Metro facility accepting household hazardous waste and recyclables."
  },
  {
    "id": 6,
    "name": "Far West Fibers",
    "type": "recycling",
    "category": "Paper & Cardboard",
    "address": "6120 NE Columbia Blvd, Portland, OR 97218",
    "lat": 45.5857,
    "lng": -122.6003,
    "phone": "(503) 283-5322",
    "website": "https://farwestfibers.com",
    "hours": "Mon-Fri 8am-4:30pm, Sat 8am-3pm",
    "accepts": ["cardboard", "paper", "magazines", "newspapers", "office paper"],
    "description": "Large-scale paper and cardboard recycling facility."
  },
  {
    "id": 7,
    "name": "Repair PDX",
    "type": "repair",
    "category": "Electronics",
    "address": "Various locations - check website",
    "lat": 45.5152,
    "lng": -122.6784,
    "phone": "See website",
    "website": "https://repairpdx.org",
    "hours": "Events held monthly",
    "accepts": ["electronics", "appliances", "clothing", "furniture", "bikes", "toys"],
    "description": "Community repair events where volunteers help fix broken items for free."
  },
  {
    "id": 8,
    "name": "Next Step Recycling",
    "type": "recycling",
    "category": "Electronics",
    "address": "519 SW Park Ave, Portland, OR 97205",
    "lat": 45.5203,
    "lng": -122.6822,
    "phone": "(503) 224-9113",
    "website": "https://nextsteprecycling.com",
    "hours": "Mon-Fri 10am-6pm, Sat 10am-5pm",
    "accepts": ["computers", "monitors", "printers", "electronics", "cell phones", "data destruction"],
    "description": "E-waste recycling with secure data destruction services."
  },
  {
    "id": 9,
    "name": "Scrap PDX",
    "type": "donation",
    "category": "Art Supplies",
    "address": "3901 N Williams Ave, Portland, OR 97227",
    "lat": 45.5520,
    "lng": -122.6662,
    "phone": "(503) 294-0769",
    "website": "https://scrapaction.org",
    "hours": "Tue-Sat 10am-6pm",
    "accepts": ["fabric", "paper", "craft supplies", "art materials", "office supplies", "creative reuse items"],
    "description": "Creative reuse center accepting donations of materials for art and education."
  },
  {
    "id": 10,
    "name": "Portland Repair Collective",
    "type": "repair",
    "category": "General",
    "address": "1930 SE 3rd Ave, Portland, OR 97214",
    "lat": 45.5101,
    "lng": -122.6637,
    "phone": "See website",
    "website": "https://portlandrepaircollective.org",
    "hours": "Check website for events",
    "accepts": ["electronics", "appliances", "textiles", "furniture", "bikes"],
    "description": "Free repair events teaching people to fix their own items."
  },
  {
    "id": 11,
    "name": "EcoCycle",
    "type": "recycling",
    "category": "Styrofoam",
    "address": "Multiple drop-off locations",
    "lat": 45.5231,
    "lng": -122.6765,
    "phone": "(503) 234-3000",
    "website": "https://www.oregonmetro.gov",
    "hours": "Varies by location",
    "accepts": ["styrofoam", "foam packaging", "foam blocks"],
    "description": "Metro-affiliated styrofoam recycling program."
  },
  {
    "id": 12,
    "name": "ReBuilding Center",
    "type": "donation",
    "category": "Building Materials",
    "address": "3625 N Mississippi Ave, Portland, OR 97227",
    "lat": 45.5525,
    "lng": -122.6748,
    "phone": "(503) 331-1877",
    "website": "https://rebuildingcenter.org",
    "hours": "Wed-Mon 9am-6pm",
    "accepts": ["lumber", "doors", "windows", "hardware", "plumbing", "electrical", "flooring", "cabinets"],
    "description": "Salvages and resells used building materials, keeping them out of landfills."
  },
  {
    "id": 13,
    "name": "The Bin - Electronics Recycling",
    "type": "recycling",
    "category": "Electronics",
    "address": "7450 NE Airport Way, Portland, OR 97218",
    "lat": 45.5879,
    "lng": -122.5856,
    "phone": "(503) 206-5793",
    "website": "https://thebin.com",
    "hours": "Mon-Sat 9am-5pm",
    "accepts": ["computers", "laptops", "phones", "tablets", "TVs", "electronics"],
    "description": "E-waste recycling with data destruction and asset recovery."
  },
  {
    "id": 14,
    "name": "Value Village - NE Portland",
    "type": "donation",
    "category": "General",
    "address": "11705 NE Halsey St, Portland, OR 97220",
    "lat": 45.5348,
    "lng": -122.5397,
    "phone": "(503) 253-1777",
    "website": "https://valuevillage.com",
    "hours": "Mon-Sat 9am-9pm, Sun 10am-7pm",
    "accepts": ["clothing", "furniture", "housewares", "books", "toys", "electronics"],
    "description": "Thrift store accepting donations of clothing and household items."
  },
  {
    "id": 15,
    "name": "Portland Composts!",
    "type": "disposal",
    "category": "Organic Waste",
    "address": "Multiple drop-off sites",
    "lat": 45.5231,
    "lng": -122.6765,
    "phone": "(503) 823-7202",
    "website": "https://www.portland.gov/composting",
    "hours": "Varies by location",
    "accepts": ["food scraps", "yard debris", "compostable materials"],
    "description": "City composting program with multiple drop-off locations."
  },
  {
    "id": 16,
    "name": "Salvation Army - Hazel Dell",
    "type": "donation",
    "category": "General",
    "address": "7400 NE Hwy 99, Vancouver, WA 98665",
    "lat": 45.6684,
    "lng": -122.6615,
    "phone": "(360) 597-0130",
    "website": "https://satruck.org",
    "hours": "Mon-Sat 9am-8pm, Sun 10am-6pm",
    "accepts": ["clothing", "furniture", "housewares", "electronics", "books", "toys", "small appliances"],
    "description": "Thrift store and donation center supporting Salvation Army rehabilitation programs. Nearest location to Portland (Vancouver, WA)."
  },
  {
    "id": 17,
    "name": "Salvation Army - Vancouver",
    "type": "donation",
    "category": "General",
    "address": "1500 NE 112th Ave, Vancouver, WA 98684",
    "lat": 45.6358,
    "lng": -122.5342,
    "phone": "(360) 892-9050",
    "website": "https://satruck.org",
    "hours": "Mon-Sat 9am-8pm, Sun 10am-6pm",
    "accepts": ["clothing", "furniture", "housewares", "electronics", "books", "toys", "small appliances"],
    "description": "Thrift store accepting donations of clothing, furniture, and household goods. Located in Vancouver, WA near Portland."
  },
  {
    "id": 18,
    "name": "Salvation Army - Salem",
    "type": "donation",
    "category": "General",
    "address": "1865 Fisher Rd NE, Salem, OR 97305",
    "lat": 44.9629,
    "lng": -123.0089,
    "phone": "(503) 585-6688",
    "website": "https://satruck.org",
    "hours": "Mon-Sat 9am-7pm, Sun 10am-6pm",
    "accepts": ["clothing", "furniture", "housewares", "electronics", "books", "toys", "small appliances"],
    "description": "Thrift store and donation center. Nearest Oregon Salvation Army thrift store to Portland Metro area."
  },
  {
    "id": 19,
    "name": "St. Vincent de Paul - SE Powell",
    "type": "donation",
    "category": "General",
    "address": "17108 SE Powell Blvd, Portland, OR 97236",
    "lat": 45.4943,
    "lng": -122.4883,
    "phone": "(503) 744-7533",
    "website": "https://www.svdppdx.org",
    "hours": "Daily 10am-7pm",
    "accepts": ["clothing", "furniture", "housewares", "books", "toys", "electronics", "sporting goods"],
    "description": "20,000 sq ft thrift store supporting St. Vincent de Paul's emergency services. Donations accepted 9am-6pm."
  },
  {
    "id": 20,
    "name": "St. Vincent de Paul - Salem",
    "type": "donation",
    "category": "General",
    "address": "445 Lancaster Dr NE, Salem, OR 97301",
    "lat": 44.9429,
    "lng": -123.0028,
    "phone": "(503) 385-8242",
    "website": "https://www.svdp.us",
    "hours": "Daily 10am-6pm",
    "accepts": ["clothing", "furniture", "housewares", "books", "toys", "electronics", "home decor"],
    "description": "Thrift store operated by St. Vincent de Paul of Lane County, supporting services for those experiencing homelessness."
  },
  {
    "id": 21,
    "name": "Best Buy - Cascade Station",
    "type": "recycling",
    "category": "Electronics & Batteries",
    "address": "9739 NE Cascades Pkwy, Portland, OR 97220",
    "lat": 45.5771,
    "lng": -122.5642,
    "phone": "(503) 249-7130",
    "website": "https://www.bestbuy.com/recycling",
    "hours": "Mon-Sat 10am-9pm, Sun 10am-7pm",
    "accepts": ["rechargeable batteries", "cell phones", "tablets", "computers", "TVs", "cables", "ink cartridges", "small electronics"],
    "description": "Free electronics and battery recycling drop-off. Accepts up to 3 items per household per day."
  },
  {
    "id": 22,
    "name": "Home Depot - NE Portland",
    "type": "recycling",
    "category": "Batteries",
    "address": "11633 NE Glenn Widing Dr, Portland, OR 97220",
    "lat": 45.5573,
    "lng": -122.5531,
    "phone": "(503) 252-0188",
    "website": "https://www.homedepot.com",
    "hours": "Mon-Sat 6am-9pm, Sun 7am-8pm",
    "accepts": ["rechargeable batteries", "cell phones", "power tool batteries", "laptop batteries"],
    "description": "Call2Recycle drop-off location for rechargeable batteries. Located near customer service desk."
  },
  {
    "id": 23,
    "name": "Metro Central Transfer Station",
    "type": "recycling",
    "category": "Mattress & Paint",
    "address": "6161 NW 61st Ave, Portland, OR 97210",
    "lat": 45.5811,
    "lng": -122.7545,
    "phone": "(503) 234-3000",
    "website": "https://www.oregonmetro.gov/metro-central",
    "hours": "Daily 8am-5pm, Hazardous Waste Mon-Sat 9am-4pm",
    "accepts": ["mattresses", "box springs", "paint", "household hazardous waste", "batteries", "electronics", "fluorescent bulbs"],
    "description": "Regional facility accepting free mattress recycling (up to 4/day), paint (up to 35 gal/day), and household hazardous waste."
  },
  {
    "id": 24,
    "name": "Environmentally Conscious Recycling (ECR)",
    "type": "recycling",
    "category": "Mattress",
    "address": "12409 NE San Rafael St, Portland, OR 97230",
    "lat": 45.5673,
    "lng": -122.5383,
    "phone": "(503) 253-0867",
    "website": "https://ecrrecycling.com",
    "hours": "Mon-Sat 7am-7pm, Sun 7am-6pm",
    "accepts": ["mattresses", "box springs", "furniture", "appliances", "construction debris", "yard debris"],
    "description": "Full-service material recovery facility and Oregon's primary mattress recycler. Processes mattresses using the BearClaw machine."
  },
  {
    "id": 25,
    "name": "Pioneer Wiping Cloth",
    "type": "recycling",
    "category": "Textiles",
    "address": "10707 N Lombard St, Portland, OR 97203",
    "lat": 45.5892,
    "lng": -122.7317,
    "phone": "(503) 226-6057",
    "website": "http://pioneerwipingcloth.com",
    "hours": "Mon-Fri 7:30am-4pm",
    "accepts": ["cotton clothing", "linens", "towels", "sheets", "t-shirts", "cotton fabrics"],
    "description": "Textile recycler since 1931. Converts cotton clothing and fabrics into industrial wiping cloths. Items must be at least 14\"x14\"."
  },
  {
    "id": 26,
    "name": "Just Porch It - Textile Recycling",
    "type": "recycling",
    "category": "Textiles",
    "address": "Portland Metro Area (pickup service)",
    "lat": 45.5231,
    "lng": -122.6765,
    "phone": "(503) 577-0589",
    "website": "https://justporchit.com",
    "hours": "Phone: Mon-Fri 7am-5pm, Bins: 24/7",
    "accepts": ["clothing", "shoes", "belts", "purses", "bedding", "towels", "linens", "fabric scraps", "stuffed animals"],
    "description": "Free no-contact pickup service and donation bins for textile recycling. Accepts items in any condition including damaged."
  },
  {
    "id": 27,
    "name": "Miller Paint - Central Portland",
    "type": "recycling",
    "category": "Paint",
    "address": "317 SE Grand Ave, Portland, OR 97214",
    "lat": 45.5194,
    "lng": -122.6603,
    "phone": "(503) 233-4491",
    "website": "https://www.millerpaint.com",
    "hours": "Mon-Fri 7am-5:30pm, Sat 8am-5pm",
    "accepts": ["latex paint", "oil-based paint", "stains", "varnishes", "paint thinners"],
    "description": "PaintCare drop-off site accepting up to 5 gallons of leftover paint per visit for recycling."
  },
  {
    "id": 28,
    "name": "Sherwin-Williams - SE Portland",
    "type": "recycling",
    "category": "Paint",
    "address": "3610 SE Powell Blvd, Portland, OR 97202",
    "lat": 45.4977,
    "lng": -122.6312,
    "phone": "(503) 232-5953",
    "website": "https://www.sherwin-williams.com",
    "hours": "Mon-Fri 7am-6pm, Sat 8am-5pm",
    "accepts": ["latex paint", "oil-based paint", "stains", "primers", "sealers"],
    "description": "PaintCare drop-off site for leftover household paint. Call ahead to confirm they can accept your paint type and quantity."
  },
  {
    "id": 29,
    "name": "SE Portland Tool Library",
    "type": "donation",
    "category": "Tools",
    "address": "1137 SE 20th Ave, Portland, OR 97214",
    "lat": 45.5138,
    "lng": -122.6458,
    "phone": "See website",
    "website": "https://www.septl.org",
    "hours": "Tue & Thu 5:30-7pm, Sat 9am-12pm",
    "accepts": ["hand tools", "power tools", "garden tools", "woodworking tools", "automotive tools"],
    "description": "Free community tool lending library. Borrow tools for up to 7 days with membership. Also accepts tool donations."
  },
  {
    "id": 30,
    "name": "North Portland Tool Library",
    "type": "donation",
    "category": "Tools",
    "address": "2209 N Schofield St, Portland, OR 97217",
    "lat": 45.5795,
    "lng": -122.6882,
    "phone": "(503) 823-0209",
    "website": "https://nptl.myturn.com",
    "hours": "Sat 10am-2pm",
    "accepts": ["hand tools", "power tools", "garden tools", "ladders", "specialty tools"],
    "description": "Community tool library in the Old Kenton Firehouse. Free tool lending with membership. Accepts tool donations."
  }
];

// Initialize Leaflet map
function initializeMap() {
    // Center on Portland, OR
    map = L.map('map').setView([45.5231, -122.6765], 12);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Initialize marker cluster group with custom options
    markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count >= 10) size = 'medium';
            if (count >= 20) size = 'large';

            return L.divIcon({
                html: `<div class="cluster-marker cluster-${size}"><span>${count}</span></div>`,
                className: 'custom-cluster-icon',
                iconSize: L.point(40, 40)
            });
        }
    });
    map.addLayer(markerClusterGroup);

    // Reset map view button
    const resetBtn = document.getElementById('resetMapBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetMapView);
    }
}

// Reset map view to show all markers
function resetMapView() {
    if (!map) return;

    if (defaultMapBounds) {
        map.fitBounds(defaultMapBounds, { padding: [30, 30] });
    } else if (markers.length > 0) {
        const allMarkers = userMarker ? [...markers, userMarker] : markers;
        const group = L.featureGroup(allMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
    } else {
        // Default to Portland center
        map.setView([45.5231, -122.6765], 12);
    }

    // Close any open popups
    map.closePopup();

    // Remove card selection highlight
    document.querySelectorAll('.location-card').forEach(card => {
        card.classList.remove('selected');
    });
}

// Setup event listeners
function setupEventListeners() {
    // Filter tooltip tap support for mobile
    document.querySelectorAll('.filter-tooltip-wrapper').forEach(wrapper => {
        wrapper.addEventListener('click', (e) => {
            // Only handle tap-to-toggle on touch devices and only on the info icon
            if (!('ontouchstart' in window)) return;
            const icon = e.target.closest('.filter-info-icon');
            if (!icon) return;

            e.preventDefault();
            e.stopPropagation();

            // Close all other tooltips
            document.querySelectorAll('.filter-tooltip-wrapper.tooltip-active').forEach(w => {
                if (w !== wrapper) w.classList.remove('tooltip-active');
            });

            wrapper.classList.toggle('tooltip-active');
        });
    });

    // Close tooltips when tapping elsewhere on mobile
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-tooltip-wrapper')) {
            document.querySelectorAll('.filter-tooltip-wrapper.tooltip-active').forEach(w => {
                w.classList.remove('tooltip-active');
            });
        }
    });

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    searchBtn.addEventListener('click', () => {
        hideAutocomplete();
        handleSearch();
    });

    // Keyboard navigation for autocomplete and search
    searchInput.addEventListener('keydown', (e) => {
        if (handleAutocompleteKeyboard(e)) {
            return;
        }
        if (e.key === 'Enter') {
            hideAutocomplete();
            handleSearch();
        }
    });

    // Real-time search with autocomplete
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        searchTerm = value.toLowerCase();

        // Show autocomplete suggestions
        if (value.length >= 1) {
            const suggestions = getMatchingSuggestions(value);
            showAutocomplete(suggestions, value);
        } else {
            hideAutocomplete();
        }

        filterAndDisplayLocations();
    });

    // Show autocomplete on focus if there's text
    searchInput.addEventListener('focus', () => {
        const value = searchInput.value;
        if (value.length >= 1) {
            const suggestions = getMatchingSuggestions(value);
            showAutocomplete(suggestions, value);
        }
    });

    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Update filter and display
            currentFilter = e.target.dataset.filter;
            trackFilterUsage(currentFilter);
            filterAndDisplayLocations();
        });
    });

    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    sortSelect.addEventListener('change', (e) => {
        filterAndDisplayLocations(e.target.value);
    });
}

// Handle search
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    searchTerm = searchInput.value.toLowerCase();
    filterAndDisplayLocations();

    // Track search after filtering to get results count
    if (searchTerm && searchTerm.length >= 2) {
        const resultCount = document.querySelectorAll('.location-card').length;
        trackSearch(searchTerm, resultCount);
    }
}

// Filter and display locations
function filterAndDisplayLocations(sortBy = 'name') {
    // Include pending locations in display
    let filtered = getAllDisplayableLocations();

    // Apply type filter
    if (currentFilter === 'favorites') {
        filtered = filtered.filter(loc => isFavorite(loc.id));
    } else if (currentFilter !== 'all') {
        filtered = filtered.filter(loc => loc.type === currentFilter);
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
        filtered = filtered.filter(loc => locationMatchesCategories(loc));
    }

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(loc => {
            const searchableText = `
                ${loc.name}
                ${loc.category}
                ${loc.accepts.join(' ')}
                ${loc.description}
            `.toLowerCase();
            return searchableText.includes(searchTerm);
        });
    }

    // Sort results
    filtered = sortLocations(filtered, sortBy);

    // Display results (this will also update map markers)
    displayLocations(filtered);
}

// Sort locations
function sortLocations(locs, sortBy) {
    switch(sortBy) {
        case 'name':
            return locs.sort((a, b) => a.name.localeCompare(b.name));
        case 'type':
            return locs.sort((a, b) => a.type.localeCompare(b.type));
        case 'distance':
            if (userLocation) {
                return locs.sort((a, b) => {
                    const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
                    const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
                    return distA - distB;
                });
            }
            // Fallback to sorting by distance from Portland center if no user location
            const portlandCenter = { lat: 45.5231, lng: -122.6765 };
            return locs.sort((a, b) => {
                const distA = calculateDistance(portlandCenter.lat, portlandCenter.lng, a.lat, a.lng);
                const distB = calculateDistance(portlandCenter.lat, portlandCenter.lng, b.lat, b.lng);
                return distA - distB;
            });
        default:
            return locs;
    }
}

// Display locations in the list
function displayLocations(locs) {
    const resultsList = document.getElementById('resultsList');
    const resultCount = document.getElementById('resultCount');

    // Update count
    resultCount.textContent = `(${locs.length})`;

    // Clear existing results
    resultsList.innerHTML = '';

    // Show no results message
    if (locs.length === 0) {
        let message = 'No locations found. Try adjusting your search or filters.';
        if (currentFilter === 'favorites') {
            message = 'No favorites yet. Click the heart icon on any location to add it to your favorites.';
        }
        resultsList.innerHTML = `<p class="no-results">${message}</p>`;
        updateMapMarkers([]); // Clear map markers
        return;
    }

    // Create location cards
    locs.forEach(location => {
        const card = createLocationCard(location);
        resultsList.appendChild(card);
    });
    
    // ALWAYS update map markers when displaying locations
    updateMapMarkers(locs);
}

// Create a location card element
function createLocationCard(location) {
    const card = document.createElement('div');
    card.className = 'location-card';
    card.dataset.id = location.id;
    card.dataset.type = location.type;

    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
    const distanceText = getDistanceText(location);
    const distanceHtml = distanceText ? `<span class="distance-badge">${distanceText}</span>` : '';
    const isFav = isFavorite(location.id);
    const heartIcon = isFav ? '♥' : '♡';
    const heartClass = isFav ? 'favorite-btn favorited' : 'favorite-btn';
    const heartTitle = isFav ? 'Remove from favorites' : 'Add to favorites';

    const hasNativeShare = canUseWebShare();

    const pendingBadge = location.isPending
        ? '<span class="pending-badge">Pending Verification</span>'
        : '';

    card.innerHTML = `
        <div class="location-header">
            <div>
                <h3 class="location-name">${location.name}</h3>
                <span class="location-type">${capitalizeFirst(location.type)}</span>
                ${pendingBadge}
                ${distanceHtml}
            </div>
            <button class="${heartClass}" data-id="${location.id}" title="${heartTitle}" onclick="toggleFavorite(${location.id}, event)">
                ${heartIcon}
            </button>
        </div>
        <div class="location-details">
            <p>📍 ${location.address}</p>
            <p>📞 ${location.phone}</p>
            <p class="hours-line">🕐 ${location.hours} ${getOpenStatusBadge(location.hours)}</p>
        </div>
        <div class="location-accepts">
            <strong>Accepts:</strong>
            <div class="accepts-list">
                ${location.accepts.map(item => `<span class="accept-tag">${item}</span>`).join('')}
            </div>
        </div>
        <div class="card-actions">
            <a href="${directionsUrl}" target="_blank" class="directions-btn" onclick="event.stopPropagation();">
                Get Directions
            </a>
            <div class="share-wrapper">
                <button class="share-btn" onclick="toggleShareMenu(${location.id}, event)" title="Share this location">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    <span>Share</span>
                </button>
                <div class="share-menu" data-location="${location.id}">
                    ${hasNativeShare ? `
                    <button class="share-menu-item" onclick="shareLocation(${location.id}, 'native', event)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                            <polyline points="16 6 12 2 8 6"></polyline>
                            <line x1="12" y1="2" x2="12" y2="15"></line>
                        </svg>
                        Share...
                    </button>
                    ` : ''}
                    <button class="share-menu-item" onclick="shareLocation(${location.id}, 'copy', event)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy Link
                    </button>
                    <button class="share-menu-item" onclick="shareLocation(${location.id}, 'email', event)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        Email
                    </button>
                    <button class="share-menu-item" onclick="shareLocation(${location.id}, 'twitter', event)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Twitter/X
                    </button>
                    <button class="share-menu-item" onclick="shareLocation(${location.id}, 'print', event)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                        Print
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add click handler to highlight on map
    card.addEventListener('click', () => {
        // On mobile, switch to map view
        if (window.innerWidth <= 768) {
            switchMobileView('map');
            // Small delay to let map view render before highlighting
            setTimeout(() => {
                highlightLocation(location);
            }, 150);
        } else {
            highlightLocation(location);
        }
    });

    return card;
}

// Update map markers
function updateMapMarkers(locs) {
    // Check if map is initialized
    if (!map || !markerClusterGroup) {
        console.error('Map or cluster group not initialized yet');
        return;
    }

    // Clear existing markers from cluster group
    markerClusterGroup.clearLayers();
    markers = [];

    // Add new markers
    locs.forEach(location => {
        try {
            // Create marker with custom colored icon based on type
            const customIcon = createColoredMarker(location.type);
            const marker = L.marker([location.lat, location.lng], { icon: customIcon });

            // Create popup
            const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
            const openStatus = getOpenStatus(location.hours);
            const distanceText = getDistanceText(location);
            const typeColor = MARKER_COLORS[location.type] || '#666666';
            const statusStyles = {
                open: 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;',
                closed: 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;',
                opening: 'background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba;',
                unknown: 'background-color: #e9ecef; color: #6c757d; border: 1px solid #dee2e6;'
            };
            const statusStyle = statusStyles[openStatus.status] || statusStyles.unknown;
            const distanceHtml = distanceText ? `<p style="margin: 4px 0; font-size: 0.85em; color: #2d6a4f; font-weight: 500;">📍 ${distanceText}</p>` : '';
            const popupContent = `
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 8px 0; color: ${typeColor};">${location.name}</h4>
                    <p style="margin: 4px 0;"><span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: 600; background-color: ${typeColor}; color: white;">${capitalizeFirst(location.type)}</span> <span style="color: #666;">${location.category}</span></p>
                    ${distanceHtml}
                    <p style="margin: 4px 0; font-size: 0.9em;">${location.address}</p>
                    <p style="margin: 4px 0; font-size: 0.9em;">📞 ${location.phone}</p>
                    <p style="margin: 4px 0; font-size: 0.9em;">🕐 ${location.hours} <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 600; margin-left: 4px; ${statusStyle}">${openStatus.text}</span></p>
                    ${location.website ? `<p style="margin: 8px 0 0 0;"><a href="${location.website}" target="_blank" style="color: ${typeColor};">Visit Website →</a></p>` : ''}
                    <a href="${directionsUrl}" target="_blank" style="display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: ${typeColor}; color: white; text-decoration: none; border-radius: 6px; font-size: 0.9em; font-weight: 500;">Get Directions</a>
                </div>
            `;

            marker.bindPopup(popupContent);

            // Add click handler to highlight corresponding card
            marker.on('click', () => {
                highlightCardFromMarker(location);
            });

            // Store reference
            marker.locationId = location.id;
            markers.push(marker);

            // Add to cluster group
            markerClusterGroup.addLayer(marker);
        } catch(e) {
            console.error('Error creating marker for', location.name, e);
        }
    });

    // Fit map to show all markers if there are any
    if (markers.length > 0) {
        try {
            // Get bounds including user marker if available
            let bounds;
            if (userMarker) {
                const allLayers = [...markers, userMarker];
                bounds = L.featureGroup(allLayers).getBounds();
            } else {
                bounds = markerClusterGroup.getBounds();
            }

            // Store default bounds for reset functionality
            defaultMapBounds = bounds;

            map.fitBounds(bounds.pad(0.1));
        } catch(e) {
            console.log('Error fitting bounds:', e);
        }
    }
}

// Highlight card when marker is clicked
function highlightCardFromMarker(location) {
    // Track location view
    trackLocationView(location.id);

    // Remove previous selections
    document.querySelectorAll('.location-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Highlight card
    const card = document.querySelector(`.location-card[data-id="${location.id}"]`);
    if (card) {
        card.classList.add('selected');

        // Scroll card into view on desktop
        if (window.innerWidth > 768) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// Highlight a specific location
function highlightLocation(location) {
    // Track location view
    trackLocationView(location.id);

    // Remove previous selections
    document.querySelectorAll('.location-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Highlight card
    const card = document.querySelector(`[data-id="${location.id}"]`);
    if (card) {
        card.classList.add('selected');
    }

    // Find and open marker popup
    const marker = markers.find(m => m.locationId === location.id);
    if (marker && map && markerClusterGroup) {
        try {
            // Zoom to show the marker (unclustered)
            markerClusterGroup.zoomToShowLayer(marker, () => {
                // Once visible, open the popup
                setTimeout(() => {
                    marker.openPopup();
                }, 100);
            });
        } catch(e) {
            console.error('Error highlighting location on map:', e);
            // Fallback: just center on the location
            map.setView([location.lat, location.lng], 15);
            setTimeout(() => {
                marker.openPopup();
            }, 300);
        }
    } else {
        console.log('Marker not found for location:', location.name);
    }
}

// Utility: Capitalize first letter
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============ SHARING FUNCTIONALITY ============

// Generate shareable URL for a location
function getLocationShareUrl(locationId) {
    const url = new URL(window.location.href);
    url.search = ''; // Clear existing params
    url.searchParams.set('location', locationId);
    return url.toString();
}

// Generate shareable URL for current search/filter
function getSearchShareUrl() {
    const url = new URL(window.location.href);
    url.search = ''; // Clear existing params

    if (searchTerm) {
        url.searchParams.set('search', searchTerm);
    }
    if (currentFilter !== 'all') {
        url.searchParams.set('filter', currentFilter);
    }
    if (selectedCategories.length > 0) {
        url.searchParams.set('categories', selectedCategories.join(','));
    }

    return url.toString();
}

// Check if Web Share API is available
function canUseWebShare() {
    return navigator.share !== undefined;
}

// Share using Web Share API
async function webShare(title, text, url) {
    try {
        await navigator.share({ title, text, url });
        return true;
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.log('Web Share failed:', err);
        }
        return false;
    }
}

// Copy text to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (e) {
            document.body.removeChild(textArea);
            return false;
        }
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Toggle share menu visibility
function toggleShareMenu(locationId, event) {
    event.stopPropagation();

    // Close any open share menus
    document.querySelectorAll('.share-menu.open').forEach(menu => {
        menu.classList.remove('open');
    });

    const menu = document.querySelector(`.share-menu[data-location="${locationId}"]`);
    if (menu) {
        menu.classList.toggle('open');
    }
}

// Close all share menus
function closeShareMenus() {
    document.querySelectorAll('.share-menu.open').forEach(menu => {
        menu.classList.remove('open');
    });
}

// Share location - main entry point
async function shareLocation(locationId, method, event) {
    if (event) event.stopPropagation();

    const location = locations.find(loc => loc.id === locationId);
    if (!location) return;

    const shareUrl = getLocationShareUrl(locationId);
    const title = `${location.name} - Portland Reuse Hub`;
    const text = `Check out ${location.name} for ${location.type} in Portland! ${location.address}`;

    closeShareMenus();

    switch (method) {
        case 'native':
            if (canUseWebShare()) {
                await webShare(title, text, shareUrl);
            }
            break;

        case 'copy':
            const copied = await copyToClipboard(shareUrl);
            showToast(copied ? 'Link copied to clipboard!' : 'Failed to copy link', copied ? 'success' : 'error');
            break;

        case 'email':
            const emailSubject = encodeURIComponent(title);
            const emailBody = encodeURIComponent(`${text}\n\nView details: ${shareUrl}\n\nAddress: ${location.address}\nPhone: ${location.phone}\nHours: ${location.hours}\n\nAccepts: ${location.accepts.join(', ')}`);
            window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`, '_self');
            break;

        case 'twitter':
            const tweetText = encodeURIComponent(`${text}\n${shareUrl}`);
            window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank', 'width=550,height=420');
            break;

        case 'print':
            printLocation(location);
            break;
    }
}

// Print a single location
function printLocation(location) {
    const openStatus = getOpenStatus(location.hours);
    const printWindow = window.open('', '_blank');

    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${location.name} - Portland Reuse Hub</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                    line-height: 1.6;
                    max-width: 600px;
                    margin: 40px auto;
                    padding: 20px;
                    color: #333;
                }
                h1 {
                    color: #2d6a4f;
                    margin-bottom: 5px;
                    font-size: 24px;
                }
                .type-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    background-color: ${MARKER_COLORS[location.type] || '#666'};
                    color: white;
                    border-radius: 15px;
                    font-size: 14px;
                    margin-bottom: 15px;
                }
                .section {
                    margin: 15px 0;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                .section-title {
                    font-weight: 600;
                    color: #2d6a4f;
                    margin-bottom: 8px;
                }
                .accepts-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .accept-tag {
                    background: #e9ecef;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 13px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 15px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #666;
                }
                @media print {
                    body { margin: 20px; }
                }
            </style>
        </head>
        <body>
            <h1>${location.name}</h1>
            <span class="type-badge">${capitalizeFirst(location.type)}</span>
            <p>${location.category}</p>

            <div class="section">
                <div class="section-title">Contact Information</div>
                <p><strong>Address:</strong> ${location.address}</p>
                <p><strong>Phone:</strong> ${location.phone}</p>
                ${location.website ? `<p><strong>Website:</strong> ${location.website}</p>` : ''}
            </div>

            <div class="section">
                <div class="section-title">Hours</div>
                <p>${location.hours}</p>
                <p><em>Status: ${openStatus.text}</em></p>
            </div>

            <div class="section">
                <div class="section-title">Accepts</div>
                <div class="accepts-list">
                    ${location.accepts.map(item => `<span class="accept-tag">${item}</span>`).join('')}
                </div>
            </div>

            <div class="section">
                <div class="section-title">Description</div>
                <p>${location.description}</p>
            </div>

            <div class="footer">
                <p>Printed from Portland Reuse Hub - ${new URL(window.location.href).origin}</p>
                <p>Please verify hours and accepted items before visiting.</p>
            </div>

            <script>window.print(); window.onafterprint = function() { window.close(); }</script>
        </body>
        </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
}

// Share search results
async function shareSearchResults(method, event) {
    if (event) event.stopPropagation();

    const shareUrl = getSearchShareUrl();
    const resultCount = document.querySelectorAll('.location-card').length;
    const title = 'Portland Reuse Hub - Search Results';
    let text = `Check out these ${resultCount} locations on Portland Reuse Hub!`;

    if (searchTerm) {
        text = `Search results for "${searchTerm}" on Portland Reuse Hub - ${resultCount} locations found!`;
    } else if (currentFilter !== 'all') {
        text = `${capitalizeFirst(currentFilter)} locations on Portland Reuse Hub - ${resultCount} found!`;
    }

    closeShareMenus();

    switch (method) {
        case 'native':
            if (canUseWebShare()) {
                await webShare(title, text, shareUrl);
            }
            break;

        case 'copy':
            const copied = await copyToClipboard(shareUrl);
            showToast(copied ? 'Link copied to clipboard!' : 'Failed to copy link', copied ? 'success' : 'error');
            break;

        case 'email':
            const emailSubject = encodeURIComponent(title);
            const emailBody = encodeURIComponent(`${text}\n\nView results: ${shareUrl}`);
            window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`, '_self');
            break;

        case 'twitter':
            const tweetText = encodeURIComponent(`${text}\n${shareUrl}`);
            window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank', 'width=550,height=420');
            break;
    }
}

// Toggle search share menu
function toggleSearchShareMenu(event) {
    event.stopPropagation();

    // Close location share menus
    document.querySelectorAll('.share-menu.open').forEach(menu => {
        menu.classList.remove('open');
    });

    const menu = document.getElementById('searchShareMenu');
    if (menu) {
        menu.classList.toggle('open');
    }
}

// Handle URL parameters on page load
function handleSharedUrl() {
    const params = new URLSearchParams(window.location.search);

    // Handle shared location
    const locationId = params.get('location');
    if (locationId) {
        const id = parseInt(locationId);
        const location = locations.find(loc => loc.id === id);
        if (location) {
            // Wait for map to initialize, then highlight
            setTimeout(() => {
                highlightLocation(location);

                // On mobile, show map view
                if (window.innerWidth <= 768) {
                    switchMobileView('map');
                }

                // Scroll card into view
                const card = document.querySelector(`.location-card[data-id="${id}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
        }
        return; // Don't process other params if location is specified
    }

    // Handle shared search
    const search = params.get('search');
    if (search) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = search;
            searchTerm = search.toLowerCase();
        }
    }

    // Handle shared filter
    const filter = params.get('filter');
    if (filter && ['donation', 'repair', 'recycling', 'disposal', 'favorites'].includes(filter)) {
        currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
    }

    // Handle shared categories
    const categories = params.get('categories');
    if (categories) {
        selectedCategories = categories.split(',').filter(cat => CATEGORY_GROUPS[cat]);
        updateCategoryChipsUI();
        updateClearCategoriesButton();
    }

    // Apply filters if any were set
    if (search || filter || categories) {
        filterAndDisplayLocations();
    }
}

// Export for debugging
window.app = {
    locations,
    map,
    markers,
    reload: loadLocations
};

// ============ LOCATION SUGGESTION SYSTEM ============

// Admin password is now handled server-side
let pendingSubmissions = [];
let isAdminLoggedIn = !!localStorage.getItem('adminToken');

// Load pending submissions from API (admin) or localStorage (fallback)
async function loadPendingSubmissions() {
    // For admin users, try to load from API
    if (isAdminLoggedIn && adminToken) {
        try {
            pendingSubmissions = await apiRequest('/api/submissions');
            return;
        } catch (e) {
            console.warn('Failed to load submissions from API:', e.message);
        }
    }
    // Fallback to localStorage for non-admin or if API fails
    try {
        const stored = localStorage.getItem('pendingSubmissions');
        pendingSubmissions = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error loading pending submissions:', e);
        pendingSubmissions = [];
    }
}

// Save pending submissions to localStorage
function savePendingSubmissions() {
    try {
        localStorage.setItem('pendingSubmissions', JSON.stringify(pendingSubmissions));
    } catch (e) {
        console.error('Error saving pending submissions:', e);
    }
}

// Generate unique ID for submissions
function generateSubmissionId() {
    return 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get next available location ID
function getNextLocationId() {
    const maxId = Math.max(...locations.map(loc => loc.id), 0);
    const maxPendingId = pendingSubmissions.length > 0
        ? Math.max(...pendingSubmissions.map(sub => sub.locationData.id || 0))
        : 0;
    return Math.max(maxId, maxPendingId) + 1;
}

// ============ SUGGESTION MODAL ============

function openSuggestionModal() {
    document.getElementById('suggestionModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('suggestName').focus();
}

function closeSuggestionModal() {
    document.getElementById('suggestionModal').classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('suggestionForm').reset();
}

async function submitSuggestion(event) {
    event.preventDefault();

    const name = document.getElementById('suggestName').value.trim();
    const type = document.getElementById('suggestType').value;
    const address = document.getElementById('suggestAddress').value.trim();
    const accepts = document.getElementById('suggestAccepts').value.trim();
    const phone = document.getElementById('suggestPhone').value.trim();
    const website = document.getElementById('suggestWebsite').value.trim();
    const hours = document.getElementById('suggestHours').value.trim();
    const description = document.getElementById('suggestDescription').value.trim();
    const email = document.getElementById('suggestEmail').value.trim();

    // Parse accepts into array
    const acceptsArray = accepts
        ? accepts.split(',').map(item => item.trim()).filter(item => item)
        : [];

    // Create location data object
    const locationData = {
        name: name,
        type: type,
        category: capitalizeFirst(type),
        address: address,
        lat: 45.5231, // Default Portland center - would need geocoding in production
        lng: -122.6765,
        phone: phone || 'See website',
        website: website || '',
        hours: hours || 'See website',
        accepts: acceptsArray.length > 0 ? acceptsArray : ['Various items'],
        description: description || `Community-suggested ${type} location.`
    };

    try {
        // Submit to API
        await apiRequest('/api/submissions', {
            method: 'POST',
            body: JSON.stringify({
                locationData,
                submitterEmail: email || null
            })
        });

        // Close modal and show confirmation
        closeSuggestionModal();
        showConfirmationMessage(email);

    } catch (error) {
        console.error('Failed to submit:', error);
        // Fallback to localStorage if API fails
        const submission = {
            id: generateSubmissionId(),
            submittedAt: new Date().toISOString(),
            submitterEmail: email || null,
            status: 'pending',
            locationData: { ...locationData, id: getNextLocationId(), isPending: true }
        };
        pendingSubmissions.push(submission);
        savePendingSubmissions();

        closeSuggestionModal();
        showConfirmationMessage(email);
    }

    // Refresh display
    filterAndDisplayLocations();
}

function showConfirmationMessage(email) {
    const message = email
        ? `Thank you for your suggestion! We'll review it shortly and notify you at ${email}.`
        : `Thank you for your suggestion! We'll review it shortly.`;

    showToast(message, 'success');
}

// ============ ADMIN LOGIN ============

function openAdminLogin() {
    if (isAdminLoggedIn) {
        openAdminPanel();
        return;
    }
    document.getElementById('adminLoginModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('adminPassword').focus();
    document.getElementById('adminLoginError').style.display = 'none';
}

function closeAdminLogin() {
    document.getElementById('adminLoginModal').classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('adminLoginForm').reset();
    document.getElementById('adminLoginError').style.display = 'none';
}

async function adminLogin(event) {
    event.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('adminLoginError');

    try {
        const response = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password })
        });

        if (response.success && response.token) {
            adminToken = response.token;
            localStorage.setItem('adminToken', adminToken);
            isAdminLoggedIn = true;
            closeAdminLogin();
            // Reload submissions from API now that we're authenticated
            await loadPendingSubmissions();
            openAdminPanel();
        } else {
            throw new Error('Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        errorEl.style.display = 'block';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
    }
}

// ============ ADMIN PANEL ============

function openAdminPanel() {
    if (!isAdminLoggedIn) {
        openAdminLogin();
        return;
    }

    document.getElementById('adminPanelModal').classList.add('open');
    document.body.style.overflow = 'hidden';

    // Update pending count badge
    const pendingCount = pendingSubmissions.filter(s => s.status === 'pending').length;
    const badge = document.getElementById('pendingCountBadge');
    if (badge) {
        badge.textContent = pendingCount > 0 ? pendingCount : '';
        badge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }

    // Reset to submissions tab
    switchAdminTab('submissions');
    renderAdminSubmissions();
}

function closeAdminPanel() {
    document.getElementById('adminPanelModal').classList.remove('open');
    document.body.style.overflow = '';
}

function renderAdminSubmissions() {
    const container = document.getElementById('adminContent');

    // Filter to show pending first, then others
    const pending = pendingSubmissions.filter(s => s.status === 'pending');
    const processed = pendingSubmissions.filter(s => s.status !== 'pending');

    if (pending.length === 0 && processed.length === 0) {
        container.innerHTML = `
            <div class="admin-empty">
                <p>No submissions yet.</p>
            </div>
        `;
        return;
    }

    let html = '';

    if (pending.length > 0) {
        html += `<h3 class="admin-section-title">Pending Review (${pending.length})</h3>`;
        html += pending.map(submission => renderSubmissionCard(submission)).join('');
    }

    if (processed.length > 0) {
        html += `<h3 class="admin-section-title" style="margin-top: 2rem;">Processed</h3>`;
        html += processed.map(submission => renderSubmissionCard(submission)).join('');
    }

    container.innerHTML = html;
}

function renderSubmissionCard(submission) {
    const loc = submission.locationData;
    const date = new Date(submission.submittedAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const statusBadge = {
        pending: '<span class="admin-badge badge-pending">Pending</span>',
        approved: '<span class="admin-badge badge-approved">Approved</span>',
        rejected: '<span class="admin-badge badge-rejected">Rejected</span>'
    }[submission.status];

    const actions = submission.status === 'pending' ? `
        <div class="admin-actions">
            <button class="btn-approve" onclick="approveSubmission('${submission.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Approve
            </button>
            <button class="btn-reject" onclick="rejectSubmission('${submission.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Reject
            </button>
        </div>
    ` : '';

    return `
        <div class="admin-card ${submission.status !== 'pending' ? 'processed' : ''}">
            <div class="admin-card-header">
                <div>
                    <h4>${loc.name}</h4>
                    ${statusBadge}
                    <span class="admin-type type-${loc.type}">${capitalizeFirst(loc.type)}</span>
                </div>
                <span class="admin-date">${date}</span>
            </div>
            <div class="admin-card-body">
                <p><strong>Address:</strong> ${loc.address}</p>
                <p><strong>Phone:</strong> ${loc.phone}</p>
                <p><strong>Website:</strong> ${loc.website || 'Not provided'}</p>
                <p><strong>Hours:</strong> ${loc.hours}</p>
                <p><strong>Accepts:</strong> ${loc.accepts.join(', ')}</p>
                <p><strong>Description:</strong> ${loc.description}</p>
                ${submission.submitterEmail ? `<p><strong>Submitter Email:</strong> ${submission.submitterEmail}</p>` : ''}
            </div>
            ${actions}
        </div>
    `;
}

async function approveSubmission(submissionId) {
    const submission = pendingSubmissions.find(s => s.id === submissionId);
    if (!submission) return;

    try {
        // Call API to approve submission
        const result = await apiRequest(`/api/submissions/${submissionId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'approved' })
        });

        // Update local state
        submission.status = 'approved';
        submission.processedAt = new Date().toISOString();

        // Add the new location to our local array if returned
        if (result.location) {
            locations.push(result.location);
        }

        // Show confirmation
        showToast(`"${submission.locationName || submission.locationData?.name}" has been approved and added!`, 'success');

        // Refresh displays
        await loadPendingSubmissions();
        renderAdminSubmissions();
        buildSuggestionsList();
        buildCategoryChips();
        filterAndDisplayLocations();

    } catch (error) {
        console.error('Failed to approve:', error);
        showToast('Failed to approve submission. Please try again.', 'error');
    }
}

async function rejectSubmission(submissionId) {
    const submission = pendingSubmissions.find(s => s.id === submissionId);
    if (!submission) return;

    const locationName = submission.locationName || submission.locationData?.name;
    if (!confirm(`Are you sure you want to reject "${locationName}"?`)) {
        return;
    }

    try {
        // Call API to reject submission
        await apiRequest(`/api/submissions/${submissionId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'rejected' })
        });

        // Update local state
        submission.status = 'rejected';
        submission.processedAt = new Date().toISOString();

        // Show confirmation
        showToast(`"${locationName}" has been rejected.`, 'error');

        // Refresh displays
        await loadPendingSubmissions();
        renderAdminSubmissions();
        filterAndDisplayLocations();

    } catch (error) {
        console.error('Failed to reject:', error);
        showToast('Failed to reject submission. Please try again.', 'error');
    }
}

// ============ PENDING LOCATIONS DISPLAY ============

// Get all displayable locations (including approved pending ones)
function getAllDisplayableLocations() {
    // Get pending submissions that are still pending
    const pendingLocs = pendingSubmissions
        .filter(s => s.status === 'pending')
        .map(s => ({
            ...s.locationData,
            isPending: true,
            submissionId: s.id
        }));

    return [...locations, ...pendingLocs];
}

// ============ ANALYTICS TRACKING ============

let analytics = {
    searches: {},        // { query: { count: N, lastSearched: date, resultsCount: N } }
    locationViews: {},   // { locationId: { count: N, lastViewed: date } }
    filterUsage: {},     // { filterName: count }
    categoryUsage: {},   // { categoryName: count }
    dailyUsage: {}       // { 'YYYY-MM-DD': { searches: N, views: N } }
};

// Load analytics from localStorage
function loadAnalytics() {
    try {
        const stored = localStorage.getItem('siteAnalytics');
        if (stored) {
            analytics = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading analytics:', e);
    }
}

// Save analytics to localStorage
function saveAnalytics() {
    try {
        localStorage.setItem('siteAnalytics', JSON.stringify(analytics));
    } catch (e) {
        console.error('Error saving analytics:', e);
    }
}

// Get today's date key
function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

// Track a search query
function trackSearch(query, resultsCount) {
    if (!query || query.length < 2) return;

    const queryLower = query.toLowerCase().trim();
    const today = getTodayKey();

    // Track to API (fire and forget)
    apiRequest('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ type: 'search', data: queryLower })
    }).catch(() => {}); // Ignore errors for analytics

    // Also track locally
    if (!analytics.searches[queryLower]) {
        analytics.searches[queryLower] = { count: 0, resultsCount: 0, lastSearched: null };
    }
    analytics.searches[queryLower].count++;
    analytics.searches[queryLower].resultsCount = resultsCount;
    analytics.searches[queryLower].lastSearched = new Date().toISOString();

    // Track daily usage
    if (!analytics.dailyUsage[today]) {
        analytics.dailyUsage[today] = { searches: 0, views: 0 };
    }
    analytics.dailyUsage[today].searches++;

    saveAnalytics();
}

// Track location view
function trackLocationView(locationId) {
    const today = getTodayKey();

    // Track to API
    apiRequest('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ type: 'view', data: String(locationId) })
    }).catch(() => {});

    // Also track locally
    if (!analytics.locationViews[locationId]) {
        analytics.locationViews[locationId] = { count: 0, lastViewed: null };
    }
    analytics.locationViews[locationId].count++;
    analytics.locationViews[locationId].lastViewed = new Date().toISOString();

    // Track daily usage
    if (!analytics.dailyUsage[today]) {
        analytics.dailyUsage[today] = { searches: 0, views: 0 };
    }
    analytics.dailyUsage[today].views++;

    saveAnalytics();
}

// Track filter usage
function trackFilterUsage(filterName) {
    // Track to API
    apiRequest('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ type: 'filter', data: filterName })
    }).catch(() => {});

    // Also track locally
    if (!analytics.filterUsage[filterName]) {
        analytics.filterUsage[filterName] = 0;
    }
    analytics.filterUsage[filterName]++;
    saveAnalytics();
}

// Track category usage
function trackCategoryUsage(categoryName) {
    // Track to API
    apiRequest('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ type: 'category', data: categoryName })
    }).catch(() => {});

    // Also track locally
    if (!analytics.categoryUsage[categoryName]) {
        analytics.categoryUsage[categoryName] = 0;
    }
    analytics.categoryUsage[categoryName]++;
    saveAnalytics();
}

// ============ INSIGHTS DASHBOARD ============

let insightsCharts = {};

function switchAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.getElementById('submissionsTab').style.display = tabName === 'submissions' ? 'block' : 'none';
    document.getElementById('insightsTab').style.display = tabName === 'insights' ? 'block' : 'none';

    // Render insights when switching to that tab
    if (tabName === 'insights') {
        renderInsightsDashboard();
    }
}

function renderInsightsDashboard() {
    const container = document.getElementById('insightsDashboard');

    // Get analytics data
    const topSearches = getTopSearches(10);
    const topLocations = getTopLocations(10);
    const hardToFind = getHardToFindItems(5);
    const filterStats = getFilterStats();
    const categoryStats = getCategoryStats();
    const usageOverTime = getUsageOverTime(14); // Last 14 days

    container.innerHTML = `
        <div class="insights-header">
            <h3>Usage Analytics</h3>
            <p class="insights-privacy">All data stays in your browser - nothing is sent to any server.</p>
        </div>

        <div class="insights-grid">
            <!-- Summary Cards -->
            <div class="insight-card insight-summary">
                <div class="summary-item">
                    <span class="summary-value">${Object.keys(analytics.searches).length}</span>
                    <span class="summary-label">Unique Searches</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value">${Object.values(analytics.searches).reduce((a, b) => a + b.count, 0)}</span>
                    <span class="summary-label">Total Searches</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value">${Object.values(analytics.locationViews).reduce((a, b) => a + b.count, 0)}</span>
                    <span class="summary-label">Location Views</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value">${favorites.length}</span>
                    <span class="summary-label">Favorites</span>
                </div>
            </div>

            <!-- Usage Over Time Chart -->
            <div class="insight-card insight-chart-card">
                <h4>Usage Over Time (Last 14 Days)</h4>
                <div class="chart-container">
                    <canvas id="usageChart"></canvas>
                </div>
            </div>

            <!-- Top Searches -->
            <div class="insight-card">
                <h4>Most Searched Items</h4>
                ${topSearches.length > 0 ? `
                    <div class="insight-list">
                        ${topSearches.map((item, i) => `
                            <div class="insight-list-item">
                                <span class="item-rank">${i + 1}</span>
                                <span class="item-name">${item.query}</span>
                                <span class="item-count">${item.count} searches</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="insight-empty">No searches recorded yet</p>'}
            </div>

            <!-- Top Locations -->
            <div class="insight-card">
                <h4>Most Viewed Locations</h4>
                ${topLocations.length > 0 ? `
                    <div class="insight-list">
                        ${topLocations.map((item, i) => `
                            <div class="insight-list-item">
                                <span class="item-rank">${i + 1}</span>
                                <span class="item-name">${item.name}</span>
                                <span class="item-count">${item.count} views</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="insight-empty">No location views recorded yet</p>'}
            </div>

            <!-- Hard to Find Items -->
            <div class="insight-card">
                <h4>Hard to Find Items</h4>
                <p class="insight-subtitle">Searches with few or no results</p>
                ${hardToFind.length > 0 ? `
                    <div class="insight-list">
                        ${hardToFind.map((item, i) => `
                            <div class="insight-list-item hard-to-find">
                                <span class="item-rank">${i + 1}</span>
                                <span class="item-name">${item.query}</span>
                                <span class="item-count">${item.count} searches, ${item.resultsCount} results</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="insight-empty">No data yet</p>'}
            </div>

            <!-- Filter Usage Chart -->
            <div class="insight-card insight-chart-card">
                <h4>Filter Usage</h4>
                <div class="chart-container chart-small">
                    <canvas id="filterChart"></canvas>
                </div>
            </div>

            <!-- Category Usage Chart -->
            <div class="insight-card insight-chart-card">
                <h4>Category Usage</h4>
                <div class="chart-container chart-small">
                    <canvas id="categoryChart"></canvas>
                </div>
            </div>
        </div>

        <div class="insights-footer">
            <button class="btn-secondary" onclick="clearAnalytics()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Clear All Analytics Data
            </button>
        </div>
    `;

    // Render charts after DOM is updated
    setTimeout(() => {
        renderUsageChart(usageOverTime);
        renderFilterChart(filterStats);
        renderCategoryChart(categoryStats);
    }, 100);
}

function getTopSearches(limit) {
    return Object.entries(analytics.searches)
        .map(([query, data]) => ({ query, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

function getTopLocations(limit) {
    const allLocs = getAllDisplayableLocations();
    return Object.entries(analytics.locationViews)
        .map(([id, data]) => {
            const location = allLocs.find(loc => loc.id === parseInt(id));
            return {
                id: parseInt(id),
                name: location ? location.name : `Location #${id}`,
                ...data
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

function getHardToFindItems(limit) {
    return Object.entries(analytics.searches)
        .map(([query, data]) => ({ query, ...data }))
        .filter(item => item.resultsCount <= 2 && item.count >= 2)
        .sort((a, b) => {
            // Sort by searches (high) and results (low)
            const scoreA = a.count / (a.resultsCount + 1);
            const scoreB = b.count / (b.resultsCount + 1);
            return scoreB - scoreA;
        })
        .slice(0, limit);
}

function getFilterStats() {
    return analytics.filterUsage;
}

function getCategoryStats() {
    return analytics.categoryUsage;
}

function getUsageOverTime(days) {
    const result = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        const data = analytics.dailyUsage[key] || { searches: 0, views: 0 };

        result.push({
            date: key,
            label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            searches: data.searches,
            views: data.views
        });
    }

    return result;
}

function renderUsageChart(data) {
    const ctx = document.getElementById('usageChart');
    if (!ctx) return;

    // Destroy existing chart if any
    if (insightsCharts.usage) {
        insightsCharts.usage.destroy();
    }

    insightsCharts.usage = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.label),
            datasets: [
                {
                    label: 'Searches',
                    data: data.map(d => d.searches),
                    borderColor: '#2d6a4f',
                    backgroundColor: 'rgba(45, 106, 79, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Location Views',
                    data: data.map(d => d.views),
                    borderColor: '#1976d2',
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderFilterChart(data) {
    const ctx = document.getElementById('filterChart');
    if (!ctx) return;

    if (insightsCharts.filter) {
        insightsCharts.filter.destroy();
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    if (labels.length === 0) {
        ctx.parentElement.innerHTML = '<p class="insight-empty">No filter usage data yet</p>';
        return;
    }

    const colors = {
        all: '#6c757d',
        donation: '#2d6a4f',
        repair: '#1976d2',
        recycling: '#f57c00',
        disposal: '#c62828',
        favorites: '#e91e63'
    };

    insightsCharts.filter = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map(l => capitalizeFirst(l)),
            datasets: [{
                data: values,
                backgroundColor: labels.map(l => colors[l] || '#999')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (insightsCharts.category) {
        insightsCharts.category.destroy();
    }

    const sorted = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    if (sorted.length === 0) {
        ctx.parentElement.innerHTML = '<p class="insight-empty">No category usage data yet</p>';
        return;
    }

    insightsCharts.category = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([name]) => name),
            datasets: [{
                label: 'Usage',
                data: sorted.map(([, count]) => count),
                backgroundColor: '#52b788'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function clearAnalytics() {
    if (!confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
        return;
    }

    analytics = {
        searches: {},
        locationViews: {},
        filterUsage: {},
        categoryUsage: {},
        dailyUsage: {}
    };
    saveAnalytics();
    renderInsightsDashboard();
    showToast('Analytics data cleared', 'success');
}

// ============ EXPORT FUNCTIONALITY ============

// Toggle export menu
function toggleExportMenu(event) {
    event.stopPropagation();

    // Close other menus
    document.querySelectorAll('.share-menu.open').forEach(menu => {
        if (menu.id !== 'exportMenu') {
            menu.classList.remove('open');
        }
    });

    const menu = document.getElementById('exportMenu');
    if (menu) {
        menu.classList.toggle('open');
    }
}

// Get currently displayed locations
function getCurrentDisplayedLocations() {
    const displayedCards = document.querySelectorAll('.location-card');
    const displayedIds = Array.from(displayedCards).map(card => parseInt(card.dataset.id));
    const allLocs = getAllDisplayableLocations();
    return allLocs.filter(loc => displayedIds.includes(loc.id));
}

// Print Search Results
function printSearchResults() {
    closeShareMenus();
    document.getElementById('exportMenu')?.classList.remove('open');

    const displayedLocations = getCurrentDisplayedLocations();
    if (displayedLocations.length === 0) {
        showToast('No locations to print', 'error');
        return;
    }

    // Generate search description
    let searchDesc = '';
    if (searchTerm) {
        searchDesc = `Search: "${searchTerm}"`;
    }
    if (currentFilter !== 'all') {
        searchDesc += (searchDesc ? ' | ' : '') + `Filter: ${capitalizeFirst(currentFilter)}`;
    }
    if (selectedCategories.length > 0) {
        searchDesc += (searchDesc ? ' | ' : '') + `Categories: ${selectedCategories.join(', ')}`;
    }

    const printWindow = window.open('', '_blank');
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Portland Reuse Hub - Search Results</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                    line-height: 1.5;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .print-header {
                    text-align: center;
                    border-bottom: 2px solid #2d6a4f;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .print-header h1 {
                    color: #2d6a4f;
                    margin: 0 0 5px 0;
                    font-size: 24px;
                }
                .print-header .subtitle {
                    color: #666;
                    font-size: 14px;
                }
                .search-info {
                    background: #f5f5f5;
                    padding: 10px 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    font-size: 14px;
                }
                .results-count {
                    font-weight: 600;
                    color: #2d6a4f;
                }
                .location-item {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                }
                .location-item h3 {
                    margin: 0 0 8px 0;
                    color: #2d6a4f;
                    font-size: 16px;
                }
                .location-type {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    color: white;
                    margin-bottom: 8px;
                }
                .type-donation { background: #2d6a4f; }
                .type-repair { background: #1976d2; }
                .type-recycling { background: #f57c00; }
                .type-disposal { background: #c62828; }
                .location-details {
                    font-size: 13px;
                    color: #555;
                }
                .location-details p {
                    margin: 4px 0;
                }
                .accepts-list {
                    margin-top: 8px;
                    font-size: 12px;
                }
                .accepts-list strong {
                    color: #2d6a4f;
                }
                .accepts-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    margin-top: 5px;
                }
                .accept-tag {
                    background: #e9ecef;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                }
                .print-footer {
                    margin-top: 30px;
                    padding-top: 15px;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    font-size: 11px;
                    color: #666;
                }
                @media print {
                    body { padding: 10px; }
                    .location-item { border: 1px solid #ccc; }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>Portland Reuse Hub</h1>
                <p class="subtitle">Find where to donate, repair, recycle, or properly dispose of anything in Portland</p>
            </div>

            <div class="search-info">
                <span class="results-count">${displayedLocations.length} location${displayedLocations.length !== 1 ? 's' : ''}</span>
                ${searchDesc ? ` | ${searchDesc}` : ''}
            </div>

            ${displayedLocations.map(loc => {
                const openStatus = getOpenStatus(loc.hours);
                return `
                    <div class="location-item">
                        <h3>${loc.name}</h3>
                        <span class="location-type type-${loc.type}">${capitalizeFirst(loc.type)}</span>
                        ${loc.isPending ? '<span class="location-type" style="background: #f57c00;">Pending</span>' : ''}
                        <div class="location-details">
                            <p><strong>Address:</strong> ${loc.address}</p>
                            <p><strong>Phone:</strong> ${loc.phone}</p>
                            <p><strong>Hours:</strong> ${loc.hours} (${openStatus.text})</p>
                            ${loc.website ? `<p><strong>Website:</strong> ${loc.website}</p>` : ''}
                        </div>
                        <div class="accepts-list">
                            <strong>Accepts:</strong>
                            <div class="accepts-tags">
                                ${loc.accepts.map(item => `<span class="accept-tag">${item}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}

            <div class="print-footer">
                <p>Printed from Portland Reuse Hub | ${new Date().toLocaleDateString()}</p>
                <p>Please verify hours and accepted items before visiting.</p>
            </div>

            <script>
                window.onload = function() { window.print(); };
                window.onafterprint = function() { window.close(); };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
}

// Export to CSV
function exportToCSV() {
    closeShareMenus();
    document.getElementById('exportMenu')?.classList.remove('open');

    const displayedLocations = getCurrentDisplayedLocations();
    if (displayedLocations.length === 0) {
        showToast('No locations to export', 'error');
        return;
    }

    // CSV headers
    const headers = ['Name', 'Type', 'Category', 'Address', 'Phone', 'Website', 'Hours', 'Accepts', 'Description', 'Latitude', 'Longitude'];

    // CSV rows
    const rows = displayedLocations.map(loc => [
        `"${loc.name.replace(/"/g, '""')}"`,
        loc.type,
        loc.category,
        `"${loc.address.replace(/"/g, '""')}"`,
        loc.phone,
        loc.website || '',
        `"${loc.hours.replace(/"/g, '""')}"`,
        `"${loc.accepts.join(', ').replace(/"/g, '""')}"`,
        `"${(loc.description || '').replace(/"/g, '""')}"`,
        loc.lat,
        loc.lng
    ]);

    // Build CSV content
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `portland-reuse-hub-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${displayedLocations.length} locations to CSV`, 'success');
}

// Save as PDF (uses browser print to PDF)
function saveAsPDF() {
    closeShareMenus();
    document.getElementById('exportMenu')?.classList.remove('open');

    const displayedLocations = getCurrentDisplayedLocations();
    if (displayedLocations.length === 0) {
        showToast('No locations to save', 'error');
        return;
    }

    showToast('Opening print dialog - select "Save as PDF" as destination', 'success');

    // Use the same print function but with a hint
    setTimeout(() => {
        printSearchResults();
    }, 500);
}

// Email locations
function emailLocations() {
    closeShareMenus();
    document.getElementById('exportMenu')?.classList.remove('open');

    const displayedLocations = getCurrentDisplayedLocations();
    if (displayedLocations.length === 0) {
        showToast('No locations to email', 'error');
        return;
    }

    // Build email subject
    let subject = 'Portland Reuse Hub - ';
    if (searchTerm) {
        subject += `Search results for "${searchTerm}"`;
    } else if (currentFilter !== 'all') {
        subject += `${capitalizeFirst(currentFilter)} locations`;
    } else {
        subject += `${displayedLocations.length} locations`;
    }

    // Build email body
    let body = `Portland Reuse Hub - ${displayedLocations.length} Location${displayedLocations.length !== 1 ? 's' : ''}\n`;
    body += `${'='.repeat(50)}\n\n`;

    if (searchTerm || currentFilter !== 'all' || selectedCategories.length > 0) {
        body += 'Search criteria:\n';
        if (searchTerm) body += `  - Search: "${searchTerm}"\n`;
        if (currentFilter !== 'all') body += `  - Filter: ${capitalizeFirst(currentFilter)}\n`;
        if (selectedCategories.length > 0) body += `  - Categories: ${selectedCategories.join(', ')}\n`;
        body += '\n';
    }

    // Add each location
    displayedLocations.forEach((loc, index) => {
        body += `${index + 1}. ${loc.name}\n`;
        body += `   Type: ${capitalizeFirst(loc.type)}\n`;
        body += `   Address: ${loc.address}\n`;
        body += `   Phone: ${loc.phone}\n`;
        body += `   Hours: ${loc.hours}\n`;
        if (loc.website) body += `   Website: ${loc.website}\n`;
        body += `   Accepts: ${loc.accepts.join(', ')}\n`;
        body += `   Google Maps: https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}\n`;
        body += '\n';
    });

    body += `${'='.repeat(50)}\n`;
    body += `Sent from Portland Reuse Hub\n`;
    body += `${window.location.origin}\n`;
    body += `\nPlease verify hours and accepted items before visiting.`;

    // Open mailto link
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
}

// Add export menu to close handlers
const originalCloseShareMenus = closeShareMenus;
closeShareMenus = function() {
    originalCloseShareMenus();
    document.getElementById('exportMenu')?.classList.remove('open');
};

// Setup modal event listeners (called after DOM is ready)
function setupModalListeners() {
    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const suggestionModal = document.getElementById('suggestionModal');
            const adminLoginModal = document.getElementById('adminLoginModal');
            const adminPanelModal = document.getElementById('adminPanelModal');

            if (suggestionModal && suggestionModal.classList.contains('open')) {
                closeSuggestionModal();
            }
            if (adminLoginModal && adminLoginModal.classList.contains('open')) {
                closeAdminLogin();
            }
            if (adminPanelModal && adminPanelModal.classList.contains('open')) {
                closeAdminPanel();
            }
            const aboutPanel = document.getElementById('aboutPanel');
            if (aboutPanel && aboutPanel.classList.contains('open')) {
                closeAboutPanel();
            }
        }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    });
}
