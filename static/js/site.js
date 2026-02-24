/**
 * Democracy Docket Stories Explorer
 * Filters stories mentioning "Democracy Docket" in the sentence/quote
 */

import { RowChart } from './rowChart.js';
import { formatDate, scrollToTop, biasColors, addCommas } from './shared.js';

export class Site {
    constructor() {
        if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
            document.title = 'Democracy Docket DEV';

        this.stories = this.getData();
        window.site = this;        
    }
   
    async getData() {      
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.replace('loading-hidden', 'loading-visible');

        // Load stories from CSV - use relative path for GitHub Pages compatibility
        let allStories = await d3.csv('../app/data/stories.csv');
        
        // Include all stories
        const stories = allStories;

        stories.forEach(story => {
            story.count = 1;
            story.date = new Date(story.publishDate);
            if (story.title === '') {
                story.title = 'Link to story';
            }
            // Parse comma-separated authorList into array for crossfilter
            story.authorArray = (story.authorList || '')
                .split(',')
                .map(a => a.trim())
                .filter(Boolean);
        });


        this.stories = stories;

        // Display the latest publish date
        const maxDate = d3.max(stories, d => d.date);
        if (maxDate && !isNaN(maxDate)) {
            const formatted = maxDate.toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            });
            document.getElementById('updated-date').textContent = `Updated ${formatted}`;
        }

        this.facts = crossfilter(this.stories);
        dc.facts = this.facts;

        this.setupCharts();
        dc.renderAll();
        this.refresh();
        overlay.classList.replace('loading-visible', 'loading-hidden'); 
    }

    setupCharts() {
        const boundRefresh = () => this.refresh();
        dc.refresh = boundRefresh;
        
        dc.rowCharts = [
            new RowChart(this.facts, 'publication', 180, 10000, boundRefresh, 'Media Outlet', null, '#chart-publication', true),
            new RowChart(this.facts, 'bias', 180, 6, boundRefresh, 'Political Orientation', null, '#chart-bias'),
            new RowChart(this.facts, 'mediaOutletType', 180, 9, boundRefresh, 'Media Type', null, '#chart-mediaOutletType'),
        ];
        
        this.setupMonthChart();
        this.setupAuthorChart();
        this.listStories();
    }

    setupMonthChart() {
        function addYearMarkers(chart) {
            const body = chart.select('g.chart-body');
            const x = chart.x();
            const height = chart.effectiveHeight();
            
            body.selectAll('.year-marker').remove();
            body.selectAll('.year-label').remove();
            
            const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
            
            years.forEach(year => {
                // Position line between Q4 of previous year and Q1 of this year
                // Use Oct 15 of previous year as midpoint between Q4 start (Oct 1) and Q1 start (Jan 1)
                const yearBoundary = new Date(year - 1, 10, 15); // Nov 15 of previous year
                const xPos = x(yearBoundary);
                
                if (xPos >= 0 && xPos <= chart.effectiveWidth()) {
                    body.append('line')
                        .attr('class', 'year-marker')
                        .attr('x1', xPos)
                        .attr('x2', xPos)
                        .attr('y1', 0)
                        .attr('y2', height)
                        .attr('stroke', '#ccc')
                        .attr('stroke-width', 1)
                        .attr('stroke-dasharray', '3,3')
                        .style('pointer-events', 'none');
                    
                    body.append('text')
                        .attr('class', 'year-label')
                        .attr('x', xPos + 3)
                        .attr('y', 11)
                        .attr('font-size', 11)
                        .attr('font-weight', 500)
                        .attr('fill', '#999')
                        .style('pointer-events', 'none')
                        .text(year);
                }
            });
        }

        // Quarter floor function
        const quarterFloor = d => {
            const month = Math.floor(d.getMonth() / 3) * 3;
            return new Date(d.getFullYear(), month, 1);
        };
        this.monthDimension = this.facts.dimension(d => quarterFloor(d.date));
        this.monthGroup = this.monthDimension.group().reduceCount();

        const height = 120;
        const width = 580; 

        // Calculate date range from data
        const dates = this.stories.map(d => d.date);
        const minQuarter = quarterFloor(d3.min(dates));
        const maxQuarter = d3.timeMonth.offset(quarterFloor(d3.max(dates)), 3);

        this.monthChart = new dc.BarChart('#chart-month');
        this.monthChart
            .width(width)
            .height(height)
            .dimension(this.monthDimension)
            .group(this.monthGroup)
            .x(d3.scaleTime().domain([minQuarter, maxQuarter]))
            .xUnits(() => d3.timeMonth.count(minQuarter, maxQuarter) / 3)
            .elasticY(true)
            .centerBar(true)
            .colors(['#6b9fd4'])
            .barPadding(0.1) 
            .brushOn(true)
            .margins({ top: 10, right: 10, bottom: 20, left: 40 })
            .on('filtered', () => this.refresh())
            .on('postRender', chart => { addYearMarkers(chart); })
            .on('postRedraw', chart => { addYearMarkers(chart); });

        this.monthChart.xAxis().tickFormat(() => '').tickSize(0);
        this.monthChart.yAxis().ticks(3);

        dc.monthDimension = this.monthDimension;
        dc.monthChart = this.monthChart;
    }

    setupAuthorChart() {
        const container = d3.select('#chart-authors');
        container.html('');
        
        const titleRow = container.append('div')
            .attr('class', 'chart-title');
        
        titleRow.append('span')
            .attr('class', 'chart-title-text')
            .text('Author');
        
        titleRow.append('span')
            .attr('class', 'chart-title-count')
            .attr('id', 'chart-authors-count');
        
        const ROW_HEIGHT = 22;
        const MARGINS = { top: 0, right: 10, bottom: 20, left: 10 };
        const maxItems = 10000;
        const width = 180;

        this.authorDimension = this.facts.dimension(d => d.authorArray, true);
        this.authorGroup = this.authorDimension.group().reduceCount();

        const removeZeroes = (group) => {
            const keep = d => d.value > 0 && d.key !== '';
            return {
                all: () => group.all().filter(keep),
                top: n => group.top(Infinity).filter(keep).slice(0, n)
            };
        };
        
        const filteredGroup = removeZeroes(this.authorGroup);
        const self = this;
        
        // Add autocomplete search
        const searchContainer = container.append('div')
            .attr('class', 'chart-search-container');
        
        const searchInput = searchContainer.append('input')
            .attr('type', 'text')
            .attr('class', 'chart-search')
            .attr('placeholder', 'Find an author')
            .attr('spellcheck', 'false');
        
        searchContainer.append('span')
            .attr('class', 'chart-search-icon')
            .html('⌕');
        
        const clearBtn = searchContainer.append('button')
            .attr('class', 'chart-search-clear')
            .attr('type', 'button')
            .text('✕');
        
        const dropdown = searchContainer.append('div')
            .attr('class', 'chart-search-dropdown');
        
        let selectedIndex = -1;
        
        const getAllItems = () => filteredGroup.top(Infinity);
        
        const renderDropdown = (searchTerm) => {
            if (!searchTerm) {
                dropdown.style('display', 'none');
                return;
            }
            
            const items = getAllItems();
            const matches = items
                .filter(d => d.key.toLowerCase().includes(searchTerm.toLowerCase()))
                .slice(0, 12);
            
            if (matches.length === 0) {
                dropdown.style('display', 'none');
                return;
            }
            
            dropdown.html('');
            matches.forEach((d, i) => {
                dropdown.append('div')
                    .attr('class', 'chart-search-item' + (i === selectedIndex ? ' selected' : ''))
                    .attr('data-value', d.key)
                    .html(`<span class="item-name">${d.key}</span><span class="item-count">${d.value.toLocaleString()}</span>`);
            });
            
            dropdown.style('display', 'block');
            
            dropdown.selectAll('.chart-search-item').on('mousedown', function(event) {
                event.preventDefault();
                const value = d3.select(this).attr('data-value');
                selectItem(value);
            });
        };
        
        const selectItem = (value) => {
            if (self.authorChart) {
                self.authorChart.filter(value);
                dc.redrawAll();
                self.refresh();
            }
            searchInput.property('value', value);
            searchInput.classed('has-selection', true);
            searchContainer.classed('has-selection', true);
            dropdown.style('display', 'none');
            selectedIndex = -1;
        };
        
        searchInput.on('input', function() {
            if (searchInput.classed('has-selection')) {
                searchInput.classed('has-selection', false);
                searchContainer.classed('has-selection', false);
            }
            selectedIndex = -1;
            renderDropdown(this.value);
        });
        
        searchInput.on('keydown', function(event) {
            const items = dropdown.selectAll('.chart-search-item');
            const count = items.size();
            
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, count - 1);
                items.classed('selected', (d, i) => i === selectedIndex);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                items.classed('selected', (d, i) => i === selectedIndex);
            } else if (event.key === 'Enter' && selectedIndex >= 0) {
                event.preventDefault();
                const selected = items.filter((d, i) => i === selectedIndex);
                if (!selected.empty()) {
                    selectItem(selected.attr('data-value'));
                }
            } else if (event.key === 'Escape') {
                dropdown.style('display', 'none');
                selectedIndex = -1;
            }
        });
        
        searchInput.on('blur', function() {
            setTimeout(() => dropdown.style('display', 'none'), 150);
        });
        
        clearBtn.on('click', function() {
            if (searchInput.classed('has-selection') && self.authorChart) {
                const currentValue = searchInput.property('value');
                self.authorChart.filter(currentValue);
                dc.redrawAll();
                self.refresh();
            }
            searchInput.property('value', '');
            searchInput.classed('has-selection', false);
            searchContainer.classed('has-selection', false);
            dropdown.style('display', 'none');
            selectedIndex = -1;
        });
        
        container.append('div')
            .attr('id', 'chart-authors-content')
            .attr('class', 'chart-scroll');

        this.authorChart = dc.rowChart('#chart-authors-content')
            .dimension(this.authorDimension)
            .group(filteredGroup)
            .data(d => d.top(maxItems))
            .width(width)
            .height(maxItems * ROW_HEIGHT + MARGINS.top + MARGINS.bottom)
            .fixedBarHeight(ROW_HEIGHT)
            .margins(MARGINS)
            .elasticX(true)
            .colors(['#6b9fd4'])
            .label(d => `${d.key}  (${d.value.toLocaleString()})`)
            .labelOffsetX(5)
            .on('pretransition', chart => {
                chart.selectAll('g.axis').remove();
                chart.selectAll('path.domain').remove();
                chart.selectAll('.grid-line').remove();
                
                const filters = chart.filters();
                chart.selectAll('g.row rect').each(function(d) {
                    const rect = d3.select(this);
                    const isSelected = filters.includes(d.key);
                    if (isSelected) {
                        rect.attr('stroke', '#1a365d').attr('stroke-width', 2);
                    } else {
                        rect.attr('stroke', null).attr('stroke-width', null);
                    }
                });
            })
            .on('filtered', () => this.refresh());

        this.authorChart.xAxis().ticks(0).tickSize(0).tickFormat(() => '');

        const adjustHeight = () => {
            const visibleData = removeZeroes(this.authorGroup).top(maxItems);
            const visible = visibleData.length;
            this.authorChart.height(Math.max(1, visible) * (ROW_HEIGHT + 2) + MARGINS.top + MARGINS.bottom);
        };
        this.authorChart.on('preRender', adjustHeight);
        this.authorChart.on('preRedraw', adjustHeight);
        
        const countEl = d3.select('#chart-authors-count');
        const updateCount = () => {
            const filters = this.authorChart.filters();
            if (filters && filters.length > 0) {
                countEl.text(filters.length.toLocaleString());
            } else {
                const visibleData = removeZeroes(this.authorGroup).top(maxItems);
                const count = visibleData.length;
                countEl.text(count.toLocaleString());
            }
        };
        this.authorChart.on('postRender', updateCount);
        this.authorChart.on('postRedraw', updateCount);

        dc.authorChart = this.authorChart;
        dc.authorDimension = this.authorDimension;
    }

    collectFilters() {
        const filterTypes = [];

        // Row chart filters
        dc.rowCharts.forEach(rc => {
            const chartFilters = rc.chart.filters();
            if (chartFilters.length > 0) {
                filterTypes.push({
                    name: rc.title,
                    filters: chartFilters
                });
            }
        });

        // Month filter
        if (dc.monthDimension) {
            const rng = dc.monthDimension.currentFilter();
            if (rng && rng[0] && rng[1]) {
                const fmt = d3.timeFormat('%b %Y');
                const label = `${fmt(rng[0])} – ${fmt(rng[1])}`;
                filterTypes.push({
                    name: 'Date',
                    filters: [label]
                });
            }
        }

        // Author filter
        if (dc.authorChart) {
            const authorFilters = dc.authorChart.filters() || [];
            if (authorFilters.length > 0) {
                filterTypes.push({
                    name: 'Author',
                    filters: authorFilters
                });
            }
        }

        return filterTypes;
    }

    refresh() {          
        const filterTypes = this.collectFilters();
        const hasActiveFilters = filterTypes.length > 0;
        const filteredStories = dc.facts.allFiltered();
        const storyCount = filteredStories.length;
        const publicationCount = new Set(filteredStories.map(s => s.publication)).size;

        // Render menu info
        let menuHtml = `<span class="story-count">${storyCount.toLocaleString()} stories</span>`;
        if (hasActiveFilters) {
            menuHtml += `<button class="clear-button">Show All</button>`;
        }
        menuHtml += `<span class="story-filters">${publicationCount} publications</span>`;
        d3.select('#menu-info').html(menuHtml);

        // Render filter boxes
        if (filterTypes.length > 0) {
            const filterBoxes = filterTypes.map(filterType => {
                const valueBadges = filterType.filters.map(value => `
                    <span class="filter-value-badge" data-filter-name="${filterType.name}" data-filter-value="${value}">
                        ${value} <span class="filter-value-close">✕</span>
                    </span>
                `).join('');
                return `
                    <div class="filter-box">
                        <div class="filter-box-title">${filterType.name}</div>
                        <div class="filter-box-values">${valueBadges}</div>
                    </div>
                `;
            }).join('');
            d3.select('#filters').html(`<div class="filter-boxes-container">${filterBoxes}</div>`);
        } else {
            d3.select('#filters').html('');
        }

        // Helper to clear search input
        const clearSearchInput = (containerSelector) => {
            const container = d3.select(containerSelector);
            const input = container.select('.chart-search');
            if (!input.empty()) {
                input.property('value', '');
                input.classed('has-selection', false);
            }
            const searchContainer = container.select('.chart-search-container');
            if (!searchContainer.empty()) {
                searchContainer.classed('has-selection', false);
            }
        };

        // Filter badge click handlers
        d3.selectAll('.filter-value-badge').on('click', (event) => {
            event.stopPropagation();
            const badge = d3.select(event.currentTarget);
            const filterName = badge.attr('data-filter-name');
            const filterValue = badge.attr('data-filter-value');
            
            if (filterName === 'Date' && dc.monthChart) {
                dc.monthChart.filterAll();
            } else if (filterName === 'Author' && dc.authorChart) {
                dc.authorChart.filter(filterValue);
                clearSearchInput('#chart-authors');
            } else {
                const rowChart = dc.rowCharts.find(rc => rc.title === filterName);
                if (rowChart) {
                    rowChart.chart.filter(filterValue);
                    if (filterName === 'Media Outlet') {
                        clearSearchInput('#chart-publication');
                    }
                }
            }
            
            dc.redrawAll();
            this.refresh();
        });

        // Clear all button
        d3.select('.clear-button').on('click', () => {
            dc.filterAll();
            clearSearchInput('#chart-publication');
            clearSearchInput('#chart-authors');
            dc.redrawAll();
            this.refresh();
        });

        // CSV download button
        d3.select('#download-csv').on('click', () => {
            const stories = dc.facts.allFiltered();
            this.downloadCsv(stories);
        });

        dc.redrawAll();
        scrollToTop('#chart-publication');
        scrollToTop('#chart-authors');
        scrollToTop('#chart-list');
        this.listStories();
    }

    listStories() {
        const stories = this.facts.allFiltered();
        
        // Sort by date descending and limit
        const sortedStories = [...stories]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 60);

        let html;
        if (sortedStories.length === 0) {
            html = `<div style="padding:20px;color:#666;">No stories found for the selected filters.</div>`;
        } else {
            html = sortedStories.map(story => this.renderStoryCard(story)).join('');
        }

        d3.select('#chart-list').html(html);
    }

    renderStoryCard(story) {
        const authorLine = story.authorList 
            ? `<div class="story-authors">by ${story.authorList}</div>` 
            : '';

        // Bias indicator
        let biasHtml = '';
        if (story.bias && story.bias !== 'Unspecified') {
            const biasClass = story.bias.toLowerCase().replace(/\s+/g, '-');
            biasHtml = `<div class="story-bias bias-${biasClass}">${story.bias}</div>`;
        }

        // Highlight "Democracy Docket" in the sentence
        const highlightedSentence = this.highlightDemocracyDocket(story.sentence || '');

        return `
            <div class="story" onclick="window.open('${story.url}', '_blank', 'noopener')">
                <img
                    class="story-image"
                    src="${story.image}"
                    onload="this.classList.add('loaded')"
                    onerror="this.style.display='none'"
                    height="90"
                    width="120"
                >
                <div class="story-body">
                    <div class="story-meta">
                        <span class="story-publication">${story.publication}</span>
                    </div>
                    <h3 class="story-title">${story.title}</h3>
                    <div class="story-date">${formatDate(story.date)}</div>
                    ${authorLine}
                    ${highlightedSentence ? `<blockquote class="story-quote">${highlightedSentence}</blockquote>` : ''}
                </div>
                ${biasHtml}
            </div>
        `;
    }

    highlightDemocracyDocket(text) {
        return text.replace(
            /democracy docket/gi,
            `<span class="highlight-dd">Democracy Docket</span>`
        );
    }

    downloadCsv(stories) {
        const columns = ['publishDate', 'title', 'url', 'publication', 'authorList', 'bias', 'mediaOutletType', 'sentence'];
        
        const escapeField = (field) => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const header = columns.join(',');
        const rows = stories.map(story => 
            columns.map(col => escapeField(story[col])).join(',')
        );
        
        const csvContent = [header, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `democracy-docket-stories-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

const site = new Site();
