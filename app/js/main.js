//const { Map } = await import(window.jsImports.map);
import {Map} from "./map.js"; 
import {RowChart} from "./rowChart.js"; 


export class Main {
   
    constructor() {
        this.cases = this.getData();
        window.main = this;
    }

    async getData() {
        const [cases] = await Promise.all([
            d3.csv("/app/data/cases.csv")
        ]);
        console.log(cases);

        cases.forEach(d => d.count = 1);

        // SHouldn't happen - bug in importer
        cases.forEach(d => {
            if (d.caseStatus === "undefined") 
                d.caseStatus = "Decided"
        });


        this.cases = cases;        
        this.facts = crossfilter(this.cases);
        this.setupCharts();
        dc.renderAll();
    }

    setupCharts() {
        this.addCheckboxes();    
        new Map(d3.select("#chart-state"), this.cases);
        new RowChart(this.facts, "caseStatus", 180, 6, this.refresh, null, true);
        this.listCases();
    }

    refresh() {        
        window.main.listCases();
    }

    listCases() {
        let filtered = this.facts.allFiltered();
        let html = [];
        filtered.forEach(d => {
            html += `
            <div class="case"> 
                <div>
                <img class="state-img" "width="40" height="40" src="${d.stateImg}" class="attachment-rwd-rect-sm size-rwd-rect-sm" alt="State of Texas">
                </div>

                <div>
                    <b>${d.state}</b>  <span class="case-parties">${d.parties}</span>  <span class="case-excerpt">${d.excerpt}</span>
                    <p class="case-date">
                        <span class="case-date">Date Filed: ${d.dateFiled}</span>
                        <span class="case-date">Date Decided: ${d.dateDecided}</span>
                    </p>
                </div>
                <br>
            </div>
            `;
        })
        d3.select("#chart-list")
            .html(html);
    }

    addCheckboxes() {
        this.topics = [
            { name: 'Election Administration', field: 'electionAdministration' },
            { name: 'In-Person Voting', field: 'inPersonVoting' },
            { name: 'Post-Election Litigation', field: 'postElectionLitigation' },
            { name: 'Redistricting Litigation', field: 'redistrictingLitigation' },
            { name: 'Registration', field: 'registration' },
            { name: 'Vote by Mail', field: 'voteByMail' }
        ];

        let makeGroup = (divId, types) => {
            types.forEach(d => d.dimension = this.facts.dimension(dc.pluck(d.field)));

            d3.select(divId)
                .selectAll("input")
                .data(types)
                .enter()
                .append('label')
                    .html(function(d, i) {
                        return '<input type="checkbox" id="' + d.field + '" for="' + d.field + '">' + d.name;
                });
                d3.selectAll("input")
                    .on("change", update);
        };

        function update(event, d) {
            let check = window.checks.find(d => event.srcElement.id ===  d.field);
            if (this.checked) {
                check.dimension.filter("True");
                check.checked = true;
            }
            else {
                check.dimension.filterAll();
                check.checked = false;
            }

            dc.redrawAll();
            //listVolunteers();
        }
        //window.checks = window.actions.concat(window.skills);
        //window.checks.forEach(d => d.checked = false);

        makeGroup("#chart-topic", this.topics);
    }
}

const main = new Main();
