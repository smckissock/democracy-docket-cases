const cheerio = require("cheerio");
const fs = require("fs");

let $;

async function fetchPage(url) {    
    const resp = await fetch(url);
    const text = await resp.text();
    return text;
}

function getPage(cases) {
    $(".archive-card").each((i, e) => {        
        let aCase = {};

        // state, stateImg 
        const $stateDiv = $(e).find(".archive-card__state");       
        aCase.state = $($stateDiv).find("img").attr("alt")?.replace("State of ", "").trim() || '';
        aCase.stateImg = $($stateDiv).find("img").attr("src")?.trim() || '';

        // Topics...
        const $caseDiv = $(e).find(".archive-card__main");
        const $caseTagUl = $($caseDiv).find(".post__list-tags");
        const $caseTagLis = $($caseTagUl).find("li");
        
        aCase.electionAdministration = false;
        aCase.felonyDisenfranchisement = false;
        aCase.inPersonVoting = false;
        aCase.postElectionLitigation = false;
        aCase.redistrictingLitigation = false;
        aCase.registration = false;
        aCase.voteByMail = false;
        aCase.victory = false;
        
        $caseTagLis.each((i, el) => {
            const tag = $(el).find("li a").text().trim().toUpperCase();
    
            switch (tag) {
                case "ELECTION ADMINISTRATION":
                    aCase.electionAdministration = true; break;
                case "FELONY DISENFRANCHISEMENT":
                    aCase.felonyDisenfranchisement = true; break;
                case "IN-PERSON VOTING":
                    aCase.inPersonVoting = true; break;
                case "POST-ELECTION LITIGATION":
                    aCase.postElectionLitigation = true; break;
                case "REDISTRICTING LITIGATION":
                    aCase.redistrictingLitigation = true; break;
                case "REGISTRATION":
                    aCase.registration = true; break;
                case "VOTE BY MAIL":
                    aCase.voteByMail = true; break;
                case "VICTORY":
                    aCase.victory = true; break;
                case "APPEALED":
                    aCase.caseStatus = "Appealed"; break;
                case "DECIDED":
                    aCase.caseStatus = "Decided"; break;
                case "FILED":
                    aCase.caseStatus = "Filed"; break;
            }
        });
    
        aCase.parties = $(e).find("p.archive-card__parties").text().trim();                      

        const $excerptDiv = $(e).find("div.archive-card__excerpt");        
        aCase.excerpt = $($excerptDiv).find("p").text().trim();
  
        const $titleH2 = $(e).find("h2.archive-card__title");
        aCase.title = $($titleH2).find("a").text().trim();
        aCase.href = $($titleH2).find("a").attr("href")?.trim() || '';

        const $metaDiv = $(e).find("div.archive-card__meta");
        const $datePs = $($metaDiv).find(".archive-card__meta p");

        $datePs.each((i, el) => {            
            if (i === 0) 
                aCase.dateFiled = $(el).find("time").attr("datetime");
            if (i === 1) 
                aCase.dateDecided = $(el).find("time").attr("datetime");
        });

        cases.push(aCase);      
    });
    return cases;
}

async function scrape() {    
    const cases = [];
    const PAGES = 98;  // Set to 98 for full scrape or 2

    try {
        // Fetch main pages
        for (let i = 1; i <= PAGES; i++) {
            const url = i === 1 
                ? "https://www.democracydocket.com/cases"
                : `https://www.democracydocket.com/cases/page/${i}`;

            console.log(`Fetching page ${i}...`);
            const text = await fetchPage(url);
            $ = cheerio.load(text);
            getPage(cases);
            console.log(`Found ${cases.length} cases so far`);
        }

        // Fetch individual case details
        console.log("Fetching individual case details...");
        for (const aCase of cases) {
            try {
                const text = await fetchPage(aCase.href);
                $ = cheerio.load(text);

                aCase.body = $('.single-post__content-main p')
                    .not('.single-post__last-updated')
                    .map((i, el) => {
                        return $(el).text().trim();
                    })
                    .get()
                    .join('\n\n');

                console.log(`Retrieved details for ${aCase.href}`);
            } catch (error) {
                console.error(`Error fetching case ${aCase.href}:`, error);
            }
        }

        // Create CSV
        const csvStrings = [
            'state,stateImg,parties,title,href,dateFiled,dateDecided,excerpt,electionAdministration,felonyDisenfranchisement,inPersonVoting,postElectionLitigation,redistrictingLitigation,registration,voteByMail,victory,caseStatus'
        ];

        cases.forEach(d => {
            csvStrings.push(
                `${d.state},${d.stateImg},"${d.parties}","${d.title}","${d.href}",${d.dateFiled},${d.dateDecided},"${d.excerpt}",${d.electionAdministration},${d.felonyDisenfranchisement},${d.inPersonVoting},${d.postElectionLitigation},${d.redistrictingLitigation},${d.registration},${d.voteByMail},${d.victory},${d.caseStatus}`
            );
        });

        // Save CSV
        const csvData = csvStrings.join('\n');
        fs.writeFileSync('app/data/cases2.csv', csvData, 'utf8');
        
        // Save JSON
        fs.writeFileSync('app/data/cases.json', JSON.stringify(cases, null, 2), 'utf8');
        console.log("Done! Data saved to cases.csv and cases.json");

    } catch (error) {
        console.error("Scraping failed:", error);
    }
}

// Start the scraping process
scrape();