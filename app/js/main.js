import {Map} from "./map.js"; 
import {RowChart} from "./rowChart.js"; 
import {formatDate} from "./shared.js";


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
            { name: 'Vote by Mail', field: 'voteByMail' }
        ];
    }

    async getData() {
        const [cases] = await Promise.all([
            //d3.csv("/data/cases.csv")
            d3.csv("https://smckissock.github.io/democracy-docket-cases/app/data/cases.csv")
        ]);
        
        cases.forEach(aCase => {
            aCase.count = 1;
            aCase.dateFiled = new Date(aCase.dateFiled);
            aCase.dateDecided = new Date(aCase.dateDecided);
            aCase.month = (aCase.dateFiled.getFullYear() - 2000) * 12 + aCase.dateFiled.getMonth();
            aCase.monthName = `${aCase.dateFiled.toLocaleString('en', { month: 'short' })} ${aCase.dateFiled.getFullYear()}`; 

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
        this.refresh();        
    }

    setupCharts() {
        this.addCheckboxes();    
        dc.map = new Map(d3.select("#chart-state"), this.cases, this.facts.dimension(dc.pluck("state")), this.refresh);
        new RowChart(this.facts, "caseStatus", 180, 6, this.refresh, null, true);
        //this.addMonthChart();
        this.listCases();
    }


    refresh() {  
        let filters = [];

        const state = dc.states.find(d => d.checked);
        filters.push(`${state ? state.name : "All states"}`);
        
        dc.chartRegistry.list().forEach(chart => {
            chart.filters().forEach(filter => filters.push(filter));
        });

        filters = filters.concat(
            dc.topics.reduce((list, topic) => {
                if (topic.checked)
                    list.push(topic.name);
                return list;
            }, [])
        );

        const cases = dc.facts.allFiltered().length;
        d3.select("#filters")
            .html(`<span class="case-count">${cases} cases</span> &nbsp;
                <span class="case-filters">${filters.join(', ')}</span>` );

        dc.map.update();    
        window.main.listCases();
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
        let html = [];
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
            types.forEach(d => d.dimension = this.facts.dimension(dc.pluck(d.field)));

            d3.select(divId)
                .selectAll("input")
                .data(types)
                .enter()
                .append('label')
                    .html((d, i) => {
                        return '<input type="checkbox" id="' + d.field + '" for="' + d.field + '">' + d.name;
                });
                d3.selectAll("input")
                    .on("change", update);
        };

        const update = (event) => {
            let check = window.checks.find(d => event.srcElement.id ===  d.field);
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

        makeGroup("#chart-topic", dc.topics);
    }

    addMonthChart() {
        //let monthDim = this.facts.dimension(dc.pluck("dateFiled"));
        let monthDim = dc.facts.dimension(d => +d.month);
        var monthGroup = monthDim.group().reduceSum(d => d.count);
        let monthChart = dc.barChart("#chart-month")
            .dimension(monthDim)
            .group(monthGroup)
            .x(d3.scaleLinear().domain([200, 280]))
            //.width(window.screen.innerWidth - 600)
            .height(110)
            .margins({ top: 5, right: 60, bottom: 5, left: 28 })
            .yAxisLabel('# cases')
            .brushOn(false)
            .on('filtered', this.refresh)
            .elasticY(true)
            .title(d => "Date: " + d.key)
            .renderlet(function (chart) {
                var svg = chart.select("svg");
                for (var i = 0; i < 10; i++) {
                    svg.append("text")
                        .attr("x", 120 * i + 100)
                        .attr("y", 70)
                        .text("2023")
                        .attr("font-size", "34px")
                        .attr("font-weight", 900)
                        .attr("opacity", "0.1")
                        .attr("fill", "black")
                };
          })
    
        monthChart.yAxis().ticks(3);
    }
}

const main = new Main();

window.addEventListener('resize', d => { window.addMonthChart()});
window.addMonthChart = main.addMonthChart;
