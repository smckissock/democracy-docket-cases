// URL State Management for Democracy Docket Cases

/**
 * Parse URL parameters into a state object
 */
export function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const state = {};
    
    // State (map) filter
    if (params.has('state')) {
        state.state = params.get('state');
    }
    
    // Status filter (can be multiple)
    if (params.has('status')) {
        state.status = params.get('status').split(',');
    }
    
    // Topic filters (can be multiple)
    if (params.has('topics')) {
        state.topics = params.get('topics').split(',');
    }
    
    // Date Filed range
    if (params.has('filed_start') && params.has('filed_end')) {
        state.filedStart = params.get('filed_start');
        state.filedEnd = params.get('filed_end');
    }
    
    // Date Decided range
    if (params.has('decided_start') && params.has('decided_end')) {
        state.decidedStart = params.get('decided_start');
        state.decidedEnd = params.get('decided_end');
    }
    
    return state;
}

/**
 * Build URL search string from state object
 */
function buildUrlParams(state) {
    const params = new URLSearchParams();
    
    if (state.state) {
        params.set('state', state.state);
    }
    
    if (state.status && state.status.length > 0) {
        params.set('status', state.status.join(','));
    }
    
    if (state.topics && state.topics.length > 0) {
        params.set('topics', state.topics.join(','));
    }
    
    if (state.filedStart && state.filedEnd) {
        params.set('filed_start', state.filedStart);
        params.set('filed_end', state.filedEnd);
    }
    
    if (state.decidedStart && state.decidedEnd) {
        params.set('decided_start', state.decidedStart);
        params.set('decided_end', state.decidedEnd);
    }
    
    return params.toString();
}

/**
 * Push or replace the current filter state to URL
 */
export function pushFilterState(state, useReplaceState = false) {
    const paramString = buildUrlParams(state);
    const newUrl = paramString ? `?${paramString}` : window.location.pathname;
    
    if (useReplaceState) {
        window.history.replaceState(state, '', newUrl);
    } else {
        // Only push if URL actually changed
        if (window.location.search !== (paramString ? `?${paramString}` : '')) {
            window.history.pushState(state, '', newUrl);
        }
    }
}

/**
 * Set up popstate handler for browser back/forward
 */
export function onPopState(callback) {
    window.addEventListener('popstate', (event) => {
        const urlState = parseUrlParams();
        callback(urlState);
    });
}

/**
 * Get current filter state from all dimensions
 */
export function getCurrentFilterState(dc) {
    const state = {};
    
    // State (map) filter
    if (dc.states) {
        const checkedState = dc.states.find(d => d.checked);
        if (checkedState) {
            state.state = checkedState.name;
        }
    }
    
    // Status (row chart) filters
    dc.chartRegistry.list().forEach(chart => {
        if (chart === dc.monthChart || chart === dc.closeChart) return;
        const filters = chart.filters();
        if (filters.length > 0) {
            state.status = filters;
        }
    });
    
    // Topic filters
    if (dc.topics) {
        const checkedTopics = dc.topics.filter(t => t.checked).map(t => t.field);
        if (checkedTopics.length > 0) {
            state.topics = checkedTopics;
        }
    }
    
    // Date Filed range
    if (dc.monthDimension) {
        const rng = dc.monthDimension.currentFilter();
        if (rng && rng[0] && rng[1]) {
            state.filedStart = rng[0].toISOString().split('T')[0];
            state.filedEnd = rng[1].toISOString().split('T')[0];
        }
    }
    
    // Date Decided range
    if (dc.closeDimension) {
        const rng = dc.closeDimension.currentFilter();
        if (rng && rng[0] && rng[1]) {
            state.decidedStart = rng[0].toISOString().split('T')[0];
            state.decidedEnd = rng[1].toISOString().split('T')[0];
        }
    }
    
    return state;
}

/**
 * Apply URL state to all filters
 */
export function applyUrlFilters(urlState, dc) {
    if (Object.keys(urlState).length === 0) return;
    
    // Apply state (map) filter
    if (urlState.state && dc.states && dc.map) {
        const stateObj = dc.states.find(s => s.name === urlState.state);
        if (stateObj) {
            dc.states.forEach(s => s.checked = false);
            stateObj.checked = true;
            dc.map.dim.filter(urlState.state);
        }
    }
    
    // Apply status filter
    if (urlState.status) {
        dc.chartRegistry.list().forEach(chart => {
            if (chart === dc.monthChart || chart === dc.closeChart) return;
            urlState.status.forEach(status => {
                chart.filter(status);
            });
        });
    }
    
    // Apply topic filters
    if (urlState.topics && dc.topics) {
        urlState.topics.forEach(field => {
            const topic = dc.topics.find(t => t.field === field);
            if (topic) {
                topic.checked = true;
                topic.dimension.filter(true);
            }
        });
    }
    
    // Apply Date Filed range
    if (urlState.filedStart && urlState.filedEnd && dc.monthChart) {
        const start = new Date(urlState.filedStart);
        const end = new Date(urlState.filedEnd);
        dc.monthChart.filter(dc.filters.RangedFilter(start, end));
    }
    
    // Apply Date Decided range
    if (urlState.decidedStart && urlState.decidedEnd && dc.closeChart) {
        const start = new Date(urlState.decidedStart);
        const end = new Date(urlState.decidedEnd);
        dc.closeChart.filter(dc.filters.RangedFilter(start, end));
    }
}

