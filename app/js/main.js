import {Map} from "./map.js"; 
import {RowChart} from "./rowChart.js"; 
import {formatDate, addCommas} from "./shared.js";
import {parseUrlParams, pushFilterState, onPopState, getCurrentFilterState, applyUrlFilters} from "./urlState.js";


export class Main {

    constructor() {
        this.cases = this.getData();
        window.main = this;

        dc.topics = [
            { name: 'Election Administration', field: 'electionAdministration' },
            { name: 'Felony Disenfranchisement', field: 'felonyDisenfranchisement' },
            { name: 'In-Person Voting', field: 'inPersonVoting' },
            { name: 'Post-Election Litigation', field: 'postElectionLitigation' },
            { name: 'Redistricting Litigation', field: 'redistrictingLitigation' },
            { name: 'Registration', field: 'registration' },
            { name: 'Trump Accountability', field: 'trumpAccountability' },
            { name: 'Vote by Mail', field: 'voteByMail' }
        ];
    }

    async getData() {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Add cache-busting parameter to force fresh data
        // Using current date so it caches for the day but refreshes daily
        const cacheBuster = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        
        const csvUrl = isLocalhost 
            ? `/app/data/cases.csv?v=${cacheBuster}` 
            : `https://smckissock.github.io/democracy-docket-cases/app/data/cases.csv?v=${cacheBuster}`;
        
        const [cases] = await Promise.all([
            d3.csv(csvUrl)
        ]);
        
        cases.forEach(aCase => {
            aCase.count = 1;
            aCase.dateFiled = new Date(aCase.dateFiled);
            aCase.dateDecided = new Date(aCase.dateDecided);
            aCase.month = (aCase.dateFiled.getFullYear() - 2000) * 12 + aCase.dateFiled.getMonth();
            aCase.monthName = `${aCase.dateFiled.toLocaleString('en', { month: 'short' })} ${aCase.dateFiled.getFullYear()}`; 

            // Set activityDate to the later of dateDecided and dateFiled
            // Use dateFiled if dateDecided is invalid
            aCase.activityDate = (!isNaN(aCase.dateDecided) && aCase.dateDecided > aCase.dateFiled) 
                ? aCase.dateDecided 
                : aCase.dateFiled;

            // Convert strings to Bools
            dc.topics.forEach(topic => {
                aCase[topic.field] = aCase[topic.field] === "true" ? true : false;
            }) 
        });

        // Shouldn't happen - bug in importer
        cases.forEach(d => {
            if (d.caseStatus === "undefined") 
                d.caseStatus = "Decided"
        });
        this.cases = cases;   

        this.facts = crossfilter(this.cases);
        dc.facts = this.facts;

        this.setupCharts();
        dc.renderAll();
        this.applyUrlFilters();  // Apply filters from URL after initial render
        dc.redrawAll();
        this.refresh(true);  // Initial render - use replaceState
        this.setupPopStateHandler();
    }

    applyUrlFilters() {
        const urlState = parseUrlParams();
        applyUrlFilters(urlState, dc);
    }

    setupPopStateHandler() {
        onPopState((urlState) => {
            // Clear all filters first
            dc.filterAll();
            if (dc.states) {
                dc.states.forEach(s => s.checked = false);
            }
            if (dc.map) {
                dc.map.dim.filter(null);
            }
            if (dc.topics) {
                dc.topics.forEach(topic => {
                    topic.checked = false;
                    topic.dimension.filterAll();
                });
            }
            
            // Re-apply filters from URL
            applyUrlFilters(urlState, dc);
            
            if (dc.map) dc.map.update();
            dc.redrawAll();
            this.refresh(true);  // Use replaceState since we're responding to popstate
        });
    }

    setupCharts() {
        this.addCheckboxes();    
        dc.map = new Map(d3.select("#chart-state"), this.cases, this.facts.dimension(dc.pluck("state")), this.refresh);
        new RowChart(this.facts, "caseStatus", 170, 6, this.refresh, null, true);
        this.addMonthChart();
        this.listCases();
    }


    refresh(isInitialOrPopState = false) {  
        const filterTypes = [];

        // State filter
        const state = dc.states.find(d => d.checked);
        if (state) {
            filterTypes.push({
                name: 'State',
                filters: [state.name]
            });
        }
        
        // Status (row chart) filters - exclude date charts
        dc.chartRegistry.list().forEach(chart => {
            if (chart === dc.monthChart || chart === dc.closeChart) return; // Skip date charts
            const chartFilters = chart.filters();
            if (chartFilters.length > 0) {
                filterTypes.push({
                    name: 'Status',
                    filters: chartFilters
                });
            }
        });

        // Topic (checkbox) filters
        const topicFilters = dc.topics.reduce((list, topic) => {
            if (topic.checked)
                list.push(topic.name);
            return list;
        }, []);
        if (topicFilters.length > 0) {
            filterTypes.push({
                name: 'Topic',
                filters: topicFilters
            });
        }

        // Date Filed (open chart) filter
        if (dc.monthDimension) {
            const rng = dc.monthDimension.currentFilter();
            if (rng && rng[0] && rng[1]) {
                const fmt = d3.timeFormat('%b %Y');
                const label = `${fmt(rng[0])} – ${fmt(rng[1])}`;
                filterTypes.push({
                    name: 'Date Filed',
                    filters: [label]
                });
            }
        }

        // Date Decided (close chart) filter
        if (dc.closeDimension) {
            const rng = dc.closeDimension.currentFilter();
            if (rng && rng[0] && rng[1]) {
                const fmt = d3.timeFormat('%b %Y');
                const label = `${fmt(rng[0])} – ${fmt(rng[1])}`;
                filterTypes.push({
                    name: 'Date Decided',
                    filters: [label]
                });
            }
        }

        d3.select("#chart-topic")
            .selectAll("label")
            .html(d => {
                return `<input type="checkbox" ${d.checked ? "checked" : ""} id="${d.field}">${d.group.all()[1].value} ${d.name}`;
            });

        d3.selectAll("input")
            .on("change", d3.updateCheck);    
        
        // Build filter boxes HTML
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


        d3.select("#filter-boxes")
            .html(`<div class="filter-boxes-container">${filterBoxes}</div>`);

        // Click handler to remove individual filter values
        d3.selectAll('.filter-value-badge').on('click', function(event) {
            event.stopPropagation();
            const filterName = d3.select(this).attr('data-filter-name');
            const filterValue = d3.select(this).attr('data-filter-value');
            
            if (filterName === 'State') {
                const stateObj = dc.states.find(d => d.checked);
                if (stateObj) stateObj.checked = false;
                dc.map.dim.filter(null);
                dc.map.update();
            } else if (filterName === 'Status') {
                dc.chartRegistry.list().forEach(chart => {
                    if (chart.filters().includes(filterValue)) {
                        chart.filter(filterValue); // Toggle off
                    }
                });
            } else if (filterName === 'Topic') {
                const topic = dc.topics.find(t => t.name === filterValue);
                if (topic) {
                    topic.checked = false;
                    topic.dimension.filterAll();
                }
            } else if (filterName === 'Date Filed' && dc.monthChart) {
                dc.monthChart.filterAll();
            } else if (filterName === 'Date Decided' && dc.closeChart) {
                dc.closeChart.filterAll();
            }
            
            dc.redrawAll();
            window.main.refresh();
        });

        dc.redrawAll();
        dc.map.update();    
        window.main.listCases();
        
        // Update URL with current filter state
        pushFilterState(getCurrentFilterState(dc), isInitialOrPopState);
    }


    listCases() {
        const topicsAndStatus = d => {
            let tags = dc.topics.reduce((tags, topic) => {
                if (d[topic.field])
                    tags.push(topic.name.toUpperCase());
                return tags;
            }, []);

            tags.push(d.caseStatus.toUpperCase());

            if (d.victory)
                tags.push("VICTORY");

            return tags.join('&nbsp;&nbsp;|&nbsp;&nbsp;');
        }

        const date = (name, val) => {
            return (!isNaN(val)) ? `<span class="case-date">${name}: ${formatDate(val)}</span>` : '';
        };

        let filtered = this.facts.allFiltered();
        
        // Sort by most recent activity (activityDate desc), then by state (asc)
        filtered.sort((a, b) => {
            if (b.activityDate - a.activityDate !== 0) {
                return b.activityDate - a.activityDate;
            }
            return a.state.localeCompare(b.state);
        });
        
        let html = `<div class="case-count">${addCommas(filtered.length)} cases</div>`;
        filtered.forEach(d => {
            html += `
            <div class="case"> 
                <div>
                    <img class="state-img" "width="40" height="40" src="${d.stateImg}" class="attachment-rwd-rect-sm size-rwd-rect-sm" alt="State of Texas">
                </div>
                <div>
                    <span class="case-topics-and-status">${topicsAndStatus(d)}</span><br>
                    <span><b><a class="case-title" href="${d.href}">${d.title}</a></b><br></span>
                    <span class="case-parties">${d.parties}</span>
                    <p class="case-excerpt"><span>${d.excerpt}</span></p>
                    <p class="case-date">
                        ${date("Filed", d.dateFiled)}
                        ${date("Decided", d.dateDecided)}
                    </p>
                </div>
                <br>
            </div>
            `;
        });

        d3.select("#chart-list")
            .html(html);
    }

    addCheckboxes() {  
        let makeGroup = (divId, types) => {
            types.forEach(d => {
                d.dimension = this.facts.dimension(dc.pluck(d.field));
                d.group = d.dimension.group();
                d.checked = false;
            });

            d3.select(divId)
                .selectAll("input")
                .data(types)
                .enter()
                .append('label')
                    .html(d => {
                        return `<input type="checkbox" id="${d.field}">${d.group.all()[1].value} ${d.name}`;
                });

            d3.selectAll("input")
                .on("change", update);
        };

        const update = (event) => {
            let check = window.checks.find(d => event.target.id === d.field);
            if (!check) return;
            check.checked = !check.checked;
            if (check.checked)
                check.dimension.filter(true);
            else 
                check.dimension.filterAll();
            
            //console.log("After Check: " +  this.facts.allFiltered().length);
            this.refresh();
            dc.redrawAll();
        }
        window.checks = dc.topics;
        window.checks.forEach(d => d.checked = false);

        d3.updateCheck = update

        makeGroup("#chart-topic", dc.topics);
    }

    addMonthChart() {
        // Fixed start date: January 1, 2018
        const minQuarter = new Date(2018, 0, 1);
        
        // Helper to get quarter start date
        const getQuarter = (date) => {
            const month = date.getMonth();
            const quarterMonth = Math.floor(month / 3) * 3;
            return new Date(date.getFullYear(), quarterMonth, 1);
        };
        
        // Calculate max date from valid dates (considering both filed and decided)
        const validFiledCases = this.cases.filter(d => d.dateFiled && !isNaN(d.dateFiled.getTime()));
        const validDecidedCases = this.cases.filter(d => d.dateDecided && !isNaN(d.dateDecided.getTime()));
        
        if (validFiledCases.length === 0) return;
        
        const maxFiledDate = d3.max(validFiledCases, d => d.dateFiled);
        const maxDecidedDate = validDecidedCases.length > 0 ? d3.max(validDecidedCases, d => d.dateDecided) : maxFiledDate;
        const maxDate = d3.max([maxFiledDate, maxDecidedDate]);
        const maxQuarter = new Date(maxDate.getFullYear(), Math.floor(maxDate.getMonth() / 3) * 3 + 3, 1);

        // Custom xUnits for quarters (3 months each)
        const quarterUnits = (start, end) => {
            return Math.round((end - start) / (1000 * 60 * 60 * 24 * 91));
        };

        // Shared x-scale for both charts
        const xScale = d3.scaleTime().domain([minQuarter, maxQuarter]);

        // Helper to add year markers with dotted lines (matching stories page style)
        const addYearMarkers = (chart) => {
            const body = chart.select('g.chart-body');
            const x = chart.x();
            const height = chart.effectiveHeight();
            
            body.selectAll('.year-marker').remove();
            body.selectAll('.year-label').remove();
            
            const years = [];
            for (let y = minQuarter.getFullYear() + 1; y <= maxQuarter.getFullYear(); y++) {
                years.push(y);
            }
            
            years.forEach(year => {
                // Position line between Q4 of previous year and Q1 of this year
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
        };

        // ===== CHART 1: Cases Filed (Open) =====
        this.openDimension = this.facts.dimension(d => {
            if (!d.dateFiled || isNaN(d.dateFiled.getTime())) {
                return minQuarter;
            }
            return getQuarter(d.dateFiled);
        });
        this.openGroup = this.openDimension.group().reduceCount();

        this.openChart = dc.barChart("#chart-qtr-filed")
            .width(440)
            .height(110)
            .dimension(this.openDimension)
            .group(this.openGroup)
            .x(xScale)
            .xUnits(quarterUnits)
            .elasticY(true)
            .centerBar(true)
            .colors(['#6baed6'])
            .barPadding(0.1)
            .brushOn(true)
            .margins({ top: 10, right: 10, bottom: 20, left: 35 })
            .on('filtered', () => this.refresh());

        this.openChart.xAxis().tickFormat(() => '').tickSize(0);
        this.openChart.yAxis().ticks(4);
        this.openChart.on('renderlet', (chart) => addYearMarkers(chart));

        // ===== CHART 2: Cases Decided (Close) =====
        this.closeDimension = this.facts.dimension(d => {
            if (!d.dateDecided || isNaN(d.dateDecided.getTime())) {
                return null;
            }
            return getQuarter(d.dateDecided);
        });
        
        // Create filtered group that excludes null keys
        const closeGroupRaw = this.closeDimension.group().reduceCount();
        this.closeGroup = {
            all: () => closeGroupRaw.all().filter(d => d.key !== null),
            top: (n) => closeGroupRaw.top(n).filter(d => d.key !== null)
        };

        this.closeChart = dc.barChart("#chart-qtr-decided")
            .width(440)
            .height(110)
            .dimension(this.closeDimension)
            .group(this.closeGroup)
            .x(xScale)
            .xUnits(quarterUnits)
            .elasticY(true)
            .centerBar(true)
            .colors(['#fdae6b'])
            .barPadding(0.1)
            .brushOn(true)
            .margins({ top: 10, right: 10, bottom: 20, left: 35 })
            .on('filtered', () => this.refresh());
        
        this.closeChart.xAxis().tickFormat(() => '').tickSize(0);
        this.closeChart.yAxis().ticks(4);
        this.closeChart.on('renderlet', (chart) => addYearMarkers(chart));

        // Store references
        dc.monthDimension = this.openDimension;
        dc.monthChart = this.openChart;
        dc.closeDimension = this.closeDimension;
        dc.closeChart = this.closeChart;
    }
}

const main = new Main();
