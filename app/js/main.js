import {Map} from "./map.js"; 
import {RowChart} from "./rowChart.js"; 
import {formatDate} from "./shared.js";


export class Main {

    constructor() {
        this.cases = this.getData();
        window.main = this;

        dc.topics = [
            { name: 'Election Administration', field: 'electionAdministration' },
            { name: 'In-Person Voting', field: 'inPersonVoting' },
            { name: 'Post-Election Litigation', field: 'postElectionLitigation' },
            { name: 'Redistricting Litigation', field: 'redistrictingLitigation' },
            { name: 'Registration', field: 'registration' },
            { name: 'Vote by Mail', field: 'voteByMail' }
        ];
    }

    async getData() {
        const [cases] = await Promise.all([
            d3.csv("/app/data/cases.csv")
        ]);
        
        cases.forEach(aCase => {
            aCase.count = 1;
            aCase.dateFiled = new Date(aCase.dateFiled);
            aCase.dateDecided = new Date(aCase.dateDecided);
            aCase.month = (aCase.dateFiled.getFullYear() - 2000) * 12 + aCase.dateFiled.getMonth();

            // Convert strings to Bools
            dc.topics.forEach(topic => {
                aCase[topic.field] = aCase[topic.field] === "true" ? true : false;
            }) 
        });

        console.table(cases);

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
        this.addMonthChart();
        this.listCases();
    }


    refresh() {       
        //dc.renderAll();

        let filterStrings = [];
        dc.chartRegistry.list().forEach(chart => {
            chart.filters().forEach(filter => filterStrings.push(filter));
        });

        //console.log(filterStrings);
        let dimFilters = filterStrings.join(", ");

        let topicFilters = dc.topics.reduce((list, topic) => {
            if (topic.checked)
                list.push(topic.name.toUpperCase());
            return list;
        }, []);


        const state = dc.states.find(d => d.checked);
        const cases = dc.facts.allFiltered().length;
        d3.select("#filters")
            .text(`${state ? state.name : "All states"} ${dimFilters}  ${topicFilters.join(',')}  ${cases} cases`);

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
            
            console.log("After Check: " +  this.facts.allFiltered().length);
            this.refresh();
            dc.redrawAll();
        }
        window.checks = dc.topics;
        window.checks.forEach(d => d.checked = false);

        makeGroup("#chart-topic", dc.topics);
    }


    addMonthChart() {
        let monthDim = this.facts.dimension(dc.pluck("dateFiled"));
        var monthGroup = monthDim.group().reduceSum(d => d.count);
        let monthChart = dc.barChart("#chart-month")
            .dimension(monthDim)
            .group(monthGroup)
            .x(d3.scaleTime().domain([new Date("2021-01-01"), new Date("2023-12-31")]))
            .xUnits(d3.timeMonths)
            //.centerBar(true)
            //.width(window.screen.innerWidth - 600)
            .height(80)
            .margins({ top: 5, right: 20, bottom: 5, left: 28 })
            //.ordinalColors(['#9ecae1'])
            .yAxisLabel('# cases')
            //.gap(1.3) // Adjust the gap between bars
            .on('filtered', this.refresh)
            //.elasticY(true)
    
        monthChart.yAxis().ticks(3);
        //monthChart.xAxis().ticks(4);
    
        // monthChart.xAxis().tickFormat(function (d) {
        //     return months[d].year + " " + months[d].quarter;
        // });  
    }
}

const main = new Main();
