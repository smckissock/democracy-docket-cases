import {Map} from "./map.js"; 
import {RowChart} from "./rowChart.js"; 
import {formatDate} from "./shared.js";


export class Main {

    constructor() {
        this.cases = this.getData();
        window.main = this;

        this.topics = [
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
            aCase.dateField = new Date(aCase.dateFiled);
            aCase.dateDecided = new Date(aCase.dateDecided);

            // Convert strings to Bools
            this.topics.forEach(topic => {
                aCase[topic.field] = aCase[topic.field] === "true" ? true : false;
            }) 
        });

        // Shouldn't happen - bug in importer
        cases.forEach(d => {
            if (d.caseStatus === "undefined") 
                d.caseStatus = "Decided"
        });
        

        console.log(cases[0]);

        this.cases = cases;        
        this.facts = crossfilter(this.cases);
        this.setupCharts();
        dc.renderAll();
        dc.facts = this.facts;
    }

    setupCharts() {
        this.addCheckboxes();    
        new Map(d3.select("#chart-state"), this.cases, this.facts.dimension(dc.pluck("state")), this.refresh);
        new RowChart(this.facts, "caseStatus", 180, 6, this.refresh, null, true);
        this.listCases();
    }

    refresh() {       
        const state = dc.states.find(d => d.checked);

        const cases = dc.facts.allFiltered().length;
        d3.select("#filters")
            .text(`${state ? state.name : "All states"} ${cases} cases`);

        window.main.listCases();
    }

    listCases() {

        const topicsAndStatus = d => {
            let tags = this.topics.reduce((tags, topic) => {
                if (d[topic.field])
                    tags.push(topic.name.toUpperCase());
                return tags;
            }, []);

            tags.push(d.caseStatus.toUpperCase());

            if (d.victory)
                tags.push("VICTORY");

            return tags.join('&nbsp;&nbsp;|&nbsp;&nbsp;');
        }

        const date = (name, val) => val !== 'undefined' ? `<span class="case-date">${name}: ${formatDate(val)}</span>` : '';

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
                    <span class="case-title"><b><a href="${d.href}">${d.title}</a></b><br></span>
                    <span class="case-parties">${d.parties}</span>
                    <p class="case-excerpt"><span>${d.excerpt}</span></p>
                    <p class="case-date">
                        ${date("Filed", d.dateField)}
                        ${date("Decided", d.dateDecided)}
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
            if (this.checked) {
                check.dimension.filter(true);
                check.checked = true;
            }
            else {
                check.dimension.filterAll();
                check.checked = false;
            }

            console.log(this.facts.allFiltered().length);
            this.refresh();
            dc.redrawAll();
        }
        //window.checks = window.actions.concat(this.topics);
        window.checks = this.topics;
        window.checks.forEach(d => d.checked = false);

        makeGroup("#chart-topic", this.topics);
    }
}

const main = new Main();
