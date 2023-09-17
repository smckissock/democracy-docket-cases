const { make_member_detail } = await import(window.jsImports.members);
const { Actions } = await import(window.jsImports.actions);
const { RowChart } = await import(window.jsImports.rowChart);


(function loadPage() {

    const params = new URLSearchParams(window.location.search)
    let appSlug = params.get('candidate');
    let id = params.get('candidate_id');

    var root = window.apiHost || `//${window.location.host}`;
    var volunteersPath = `/members_csv`;
    var actionsPath = `${root}/api/event/?format=json`;
    var articlesPath = `${root}/api/article/?format=json`;

    var listsPath = `${root}/api/lists/?format=json`;

    // Navigation within volunteers area
    // We use query instead of path to avoid complicating server side
    function goto(query, source) {
        if (query.member) {
            editMember(query.member);
        } else {
            listVolunteers();
        }

        // Don't create a new history entry when handling back button
        if (source !== "init" && source !== "popstate") {
            const params = new URLSearchParams(query);
            const path = `?${params}`;
            history.pushState({ query }, "", path);
        }
    }

    window.goto = goto;

    window.addEventListener('popstate', (event) => {
        goto(event.state?.query ?? {}, "popstate");
    });

    // Lookup tables for referencable entities
    let related;

    // ASSUMES `related` was initialized before this is used
    function editMember(id) {
        const members = window.facts.allFiltered();
        const member = members.find(d => d.id == id);
        const detail = make_member_detail(member, related);
        const main = document.querySelector('#dc-chart-list');
        main.innerHTML = '';
        main.append(detail);
    }

    async function getData() {
        const [volunteers, actions, articles, lists] = await Promise.all([
            d3.csv(volunteersPath)
            , d3.json(actionsPath)
            , d3.json(articlesPath)
            , d3.json(listsPath)
        ])

        window.unionActions = actions;
        // Make lookup tables from flat list of relatable items
        related = lists.reduce((acc, val) => {
            (acc[val.listType] ??= []).push(val);
            return acc;
        }, Object.create(null))
        // `1` is the id of an “unset” record, but it isn't in the related lists
        related.Recruiter?.unshift({ id: "1", name: "None" });

        volunteers.forEach(d => {
            d.count = 1;
            d.date = new Date(d.dateEntered);
            d.month = d.date.getFullYear() + ' ' + (d.date.getMonth() + 1);

            d.week = d3.timeMonday(d.date);
        });

        actions.forEach(d => {
            d.count = 1;
        });

        let facts = crossfilter(volunteers);
        window.facts = facts;

        //new RowChart(facts, "hours", 220, 10);
        new RowChart(facts, "recruiter", 180, 10, listVolunteers, null, true);
        new RowChart(facts, "state", 150, 55, listVolunteers);
        new RowChart(facts, "region", 150, 10, listVolunteers);

        var all = facts.groupAll();
        dc.dataCount('.dc-data-count')
            .crossfilter(facts)
            .groupAll(all);

        const weekDim = facts.dimension(d => d.week);
        const weekGroup = weekDim.group();
        const searchDim = facts.dimension(d =>
            `${d.specificSkills} ${d.projectsInterestedIn} ${d.anythingElse} ${d.firstName} ${d.lastName} ${d.email} ${d.languages}`)
        window.textFilter = new dc.TextFilterWidget("#search")
            .dimension(searchDim);

        // Shouldn't be on window...
        window.statusDim = facts.dimension(d => d.recruitStatus);
        window.statusGroup = statusDim.group();

        // BRING THIS BACK LATER!!
        // const dateChart = new dc.BarChart('#dc-chart-date');
        // dateChart
        //     .width(980)
        //     .height(160)
        //     .margins({top: 20, right: 50, bottom: 20, left: 40})
        //     .dimension(weekDim)
        //     .group(weekGroup)
        //     .elasticY(true)
        //     .on('filtered', listVolunteers)
        //     .centerBar(true)
        //     .gap(1)
        //     .round(Math.floor)
        //     .alwaysUseRounding(true)
        //     .x(d3.scaleTime().domain([new Date("2022-01-06"), new Date()]))
        //     .xUnits(d3.timeWeeks)
        //     .renderHorizontalGridLines(true)
            //Customize the filter displayed in the control span
            // .filterPrinter(filters => {
            //     const filter = filters[0];
            //     let s = '';
            //     s += `${filter[0]}% -> ${filter[1]}%`;
            //     return s;
            // });

        addModuleButtons();

        addStatusButtons();
        addCheckboxes();
        dc.renderAll();

        setupEvents();

        // TextFilterWidget does dc.redrawAll() but we need to call function to redraw the table
        // Note: this has to be set after initial render.
        // https://github.com/dc-js/dc.js/issues/1671
        window.textFilter._input.on('input.custom', listVolunteers);

        const { search } = location;
        const params = new URLSearchParams(search)
        const query = Object.fromEntries(params);
        goto(query, "init");
    }

    function addModuleButtons() {
        const mouseoverDuration = 100;
        const strokeWidthThick = 8;
        const strokeWidthThin = 4;

        const modules = [
            { name: "Volunteers", active: true },
            { name: "Core", active: false },
            { name: "Races", active: false },
            { name: "Actions", active: true },
            { name: "Articles", active: false },
            { name: "Mailings", active: false }
        ];

        let svg = d3.select("#dc-chart-date")
            .append("svg")
            .attr("width", 950)
            .attr("height", 200);

        svg.selectAll("rect")
            .data(modules)
            .enter()
            .append('rect')
            .attr("width", 130)
            .attr("height", 120)
            .attr("x", (d, i) => i * 150 + 20)
            .attr("y", 25)
            .attr("fill", d => d.active ? 'white' : 'LightGrey')
            .attr("stroke", "black")
            .attr("stroke-width", 2)
            .on('mouseover', function (d) {
                d3.select(this)
                    .transition()
                    .duration(mouseoverDuration)
                    .attr("stroke-width", strokeWidthThin)
            })
            .on('mouseout', function(d) {
                let dom = d3.select(this);
                dom
                    .transition()
                    .duration(mouseoverDuration)
                    .attr("stroke-width", strokeWidthThin - 2);
            })
            .on('click', function (d) {
                let rect = d3.select(this)
                let module = rect.data()[0];

                if (module.active)
                    switchModule(module.name);
            });

        svg.selectAll(".module-name")
            .data(modules)
            .enter()
            .append('text')
            .classed(".status-name", true)
            .attr("x", (d, i) => i * 150 + 30)
            .attr("y", 50)
            .text(d => d.name)
            .attr("font-size", "0.8em")
            .attr("font-weight", "bold")
            .attr("pointer-events", "none");
    }


    function switchModule(moduleName) {
        switch (moduleName) {
            case "Actions": {
                let module = new Actions(window.unionActions);
            }
        }
    }


    function addStatusButtons() {
        const mouseoverDuration = 100;
        const strokeWidthThick = 8;
        const strokeWidthThin = 3;

        window.statuses = [
            { name: "New" },
            { name: "Contacting" },
            { name: "No Response" },
            { name: "Not Interested" },
            { name: "Not Appropriate" },
            { name: "Screening" },
            { name: "Team Review" },
            { name: "Onboarding" }
        ];

        window.statuses.forEach(d => d.selected = false);

        let svg = d3.select("#status")
            .append("svg")
            .attr("width", 950)
            .attr("height", 40);

        svg.selectAll("rect")
            .data(window.statuses)
            .enter()
            .append('rect')
            .attr("width", 105)
            .attr("height", 40)
            .attr("x", (d, i) => i * 115 + 20)
            .attr("y", 0)
            .attr("fill", '#4682b4')
            .attr("stroke", "black")
            .attr("stroke-width", 0)
            .attr("id", d => "status-rect-" + d.name.replace(" ",""))
            .on('mouseover', function (d) {
                d3.select(this)
                    .transition()
                    .duration(mouseoverDuration)
                    .attr("stroke-width", strokeWidthThin)
            })
            .on('mouseout', function(d) {
                let dom = d3.select(this);
                dom
                    .transition()
                    .duration(mouseoverDuration)
                    .attr("stroke-width", 0);
            })
            .on('click', function (d) {
                let rect = d3.select(this)
                let status = rect.data()[0];
                if (!status.selected) {
                    window.statusDim.filter(status.name);

                    // These are a radio buttons, so de-select the others
                    window.statuses.forEach(d => {
                        const rect = d3.select("#status-rect-" + d.name.replace(" ",""));
                        if (rect.data()[0] !== status)
                        rect.data()[0].selected = false;
                    });
                } else {
                    window.statusDim.filterAll();
                }
                status.selected = !status.selected;

                window.statusGroup.all().forEach(d => {
                    d3.select("#" + d.key.replace(" ", ""))
                        .text(d.value)
                });

                dc.redrawAll();
                listVolunteers();
            })

        svg.selectAll(".status-name")
            .data(window.statuses)
            .enter()
            .append('text')
            .classed(".status-name", true)
            .attr("x", (d, i) => i * 115 + 25)
            .attr("y", 15)
            .text(d => d.name)
            .attr("font-size", "0.6em")
            .attr("fill", "black")
            .attr("pointer-events", "none");

        svg.selectAll(".status-count")
            .data(window.statuses)
            .enter()
            .append('text')
            .classed(".status-count", true)
            .attr("id", d => "status-count-" + d.name.replace(" ",""))
            .attr("x", (d, i) => i * 115 + 65)
            .attr("y", 36)
            .text("")
            .attr("font-size", "0.9em")
            .attr("font-weight", "bold")
            .attr("fill", "black")
            .attr("pointer-events", "none");
    }


    function addCheckboxes() {
        window.actions = [
            { name: 'Voter Protection', field: 'voterProtection' },
            { name: 'Voter Outreach', field: 'voterOutreach' },
            { name: 'Software/Technology', field: 'softwareTechnology' },
            { name: 'Communications', field: 'communications' },
            { name: 'Organizing/Management', field: 'organizingManagement' },
            { name: 'Wherever I’m needed most', field: 'whereverNeededMost' }
        ];

        window.skills = [
            { name: 'Lawyer', field: 'lawyer' },
            { name: 'Doctor/Scientist', field: 'doctorScientist' },
            { name: 'Design/Illustration', field: 'designIllustration' },
            { name: 'Software Development/IT', field: 'softwareDevelopmentIt' },
            { name: 'Audio/Video Production', field: 'audioVideoProduction' },
            { name: 'Writing/Editing', field: 'writingEditing' },
            { name: 'Social Media', field: 'socialMedia' },
            { name: 'Digital Marketing/Media Planning', field: 'digitalMarketingMediaPlanning' },
            { name: 'Political Campaign Volunteer', field: 'politicalCampaignVolunteer' },
            { name: 'Fundraising', field: 'fundraising' },
            { name: 'Data Science/Analytics', field: 'dataScienceAnalytics' },
            { name: 'Google Apps Script/Sheets', field: 'googleAppsScriptSheets' }
        ];


        function makeGroup(divId, types) {
            types.forEach(d => d.dimension = facts.dimension(dc.pluck(d.field)));

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
            listVolunteers();
        }
        window.checks = window.actions.concat(window.skills);
        window.checks.forEach(d => d.checked = false);

        makeGroup("#actions", window.actions);
        makeGroup("#skills",  window.skills);
    }

    getData();
})();


function setupEvents() {
    d3.select('#download')
        .on('click', function() {
            let data = window.facts.allFiltered();
            let blob = new Blob([d3.csvFormat(data)], {type: "text/csv;charset=utf-8"});
            saveAs(blob, 'data.csv');
        });
}

window.clearFilters = function () {

    // dc.filterAll does not remove filters for our checkboxes, so take them out first
    window.checks.forEach(d => d.dimension.filterAll());
    window.statusDim.filterAll();

    dc.filterAll();
    dc.renderAll();

    d3.selectAll("input")
        .property("checked", false);
    window.checks.forEach(d => d.checked = false);

    window.statuses.forEach(d => {
        const rect = d3.select("#status-rect-" + d.name.replace(" ",""));
        rect.data()[0].selected = false;
    });

    // Clearing the text filter widget seems to remove the event handler, so add it back.
    window.textFilter._input.on('input.custom', listVolunteers);
    listVolunteers();
}

let listVolunteers = function () {

    function filtersHtml() {
        var filterStrings = [];
        var charts = dc.chartRegistry.list();
        charts.forEach(function (chart) {
            chart.filters().forEach(function (filter) {
                // Only date filters have "filterTypes" - ignore them for now
                if (!filter.filterType) {
                    filterStrings.push(filter);
                }
            })
        })

        window.checks.forEach(d => {
            if (d.checked)
                filterStrings.push(d.name)
        });

        window.statuses.forEach(d => {
            if (d.selected)
                filterStrings.push(d.name)
        });

        if (searchText.length > 2)
            filterStrings.push(`"${searchText}"`)

        let filters = filterStrings.join(", ");
        if (filterStrings.length === 1)
            filters = "Filter: " + filters;
        else
            if (filterStrings.length > 1)
                filters = "Filters: " + filters;
        return filters;
    }

    function memberText(label, text) {
        return (text.trim() === "") ? "" : `<div class="member-text">${label}: ${text}</div>`;
    }

    function district (d) {
        if (d > 3)
            return d + "th";
        if (d === 3)
            return "3rd";
        if (d === 2)
            return "2nd"
        return "1st";
    }

    function checked(d) {
        let list = [];
        window.checks.forEach(def => {
            if (d[def.field] === "True")
                list.push(def.name);
        })
        if (list.length === 0)
            return "";
        else
            return "Interests/Experience: " + list.join(", ");
    }

    function dateAndHours(d) {
        const niceDate = `${d.date.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            ${d.recruitStatus === "Unspecified" ? "" : " / " + d.recruitStatus}`;
        if (d.lastName === "")
            return niceDate;

        return `${niceDate} / ${d.hours === "Unsure" ? "Unsure about hours" : d.hours + " hours per week"}`;
    }

    function nameAndEmail(d) {
        if (d.lastName === "")
            return d.email;
        return `${d.firstName} ${d.lastName}   (${d.email})`;
    }

    function stateAndDistrict(d) {
        if (d.state === "Unspecified")
            return `<span class="member-state">&nbsp;</span>`;
        return `<span class="member-state">${d.state} ${district(d.district)} district</span>`;
    }

   function memberHtml(d) {
        return `
            <div class="member" onclick="goto({member: '${d.id}'})">
                <div>${stateAndDistrict(d)}<span class="date-hours">${dateAndHours(d)}</span>
                    <h3 class="member-name">${nameAndEmail(d)}</h3>
                    <h5 class="member-info">${checked(d)}</h5>
                        ${memberText("Specific Skills", d.specificSkills)}
                        ${memberText("Projects interested in", d.projectsInterestedIn)}
                        ${memberText("Anything else", d.anythingElse)}
                    </div>
                </div>
        `;
    }

    if (!window.facts)
        return;


    let editBoxes = document.getElementsByClassName("dc-text-filter-input");
    let searchText = editBoxes[0].value.toLowerCase();

    let html = "";

    let volunteers = window.facts.allFiltered();
    // THIS SORT DOESN'T WORK

    //console.log(volunteers.length)
    volunteers = volunteers.slice(0, 100);
    //volunteers = volunteers.sort((a, b) => a.email - b.email);
    //var sortedVolunteers = volunteers.sort((a,b) => (a.email < b.email) ? -1 : ((b.email > a.email) ? 1 : 0))
    //console.table(sortedVolunteers)

    volunteers.forEach(d => {
        let member = memberHtml(d);
        if (searchText.length > 2) {
            // Case-insensitive search
            member = member.replace(new RegExp(searchText, "gi"), (d) => `<mark>${d}</mark>`);
        }
        html += member;
    });

    d3.selectAll('#dc-chart-list')
        .html(filtersHtml() + html)

    document.getElementById('dc-chart-list')
        .scrollTo({ top: 0, behavior: 'smooth' });

    // Update numbers on status buttons
    window.statusGroup.all().forEach(d => {
        d3.select("#status-count-" + d.key.replace(" ", ""))
            .text(d.value);
    });

    // Color status buttons based on whether they are selected
    const noneSelected = window.statuses.find(d => d.selected);
    window.statuses.forEach(d => {
        const rect = d3.select("#status-rect-" + d.name.replace(" ",""))
        rect
            .attr("fill", rect.data()[0].selected || noneSelected === undefined ? '#4682b4' : '#ccc') // blue or grey
    })
}
